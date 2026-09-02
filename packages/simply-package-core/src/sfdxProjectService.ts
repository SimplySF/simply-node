/*
 * Copyright (c) 2026, Clay Chipps.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SfProject, isNamedPackagingDirectory } from '@salesforce/core';
import { DependencyChange } from './schemas/manage/dependencyChange.js';
import { ParsedDependency, parseDependency } from './schemas/manage/parsedDependency.js';
import { PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION } from './packageUtils.js';

/** Read/write access to an SFDX project's package dependencies and related plugin config. */
export type SfdxProjectService = {
  getDependenciesByDirectory(): Map<string, ParsedDependency[]>;
  getDependenciesToIgnore(): string[];
  getBranchesWithReleasedVersions(): string[];
  findAlias(id: string): string | undefined;
  resolveAlias(alias: string): string;
  applyChanges(changesByDirectory: Map<string, DependencyChange[]>): Promise<void>;
};

/**
 * Load an SFDX project's `sfdx-project.json` and build an {@link SfdxProjectService} over it.
 *
 * @param project - The SFDX project to load.
 * @returns A service for reading/writing the project's package dependencies.
 */
export async function buildProjectService(project: SfProject): Promise<SfdxProjectService> {
  const projectJson = await project.retrieveSfProjectJson();
  const contents = projectJson.getContents();

  /** @returns The project's `packageAliases` map, or an empty object if there isn't one. */
  function getAliases(): Record<string, string> {
    return (contents.packageAliases as Record<string, string>) ?? {};
  }

  /** @returns The ID `alias` resolves to, or `alias` itself if it isn't a known alias. */
  function resolveAlias(alias: string): string {
    return project.getPackageIdFromAlias(alias) ?? alias;
  }

  /** @returns The first alias in `packageAliases` that resolves to `id`, if any. */
  function findAlias(id: string): string | undefined {
    const aliases = getAliases();
    for (const [k, v] of Object.entries(aliases)) {
      if (v === id) return k;
    }
    return undefined;
  }

  /** @returns Every package directory's parsed dependencies, keyed by directory path. */
  function getDependenciesByDirectory(): Map<string, ParsedDependency[]> {
    const result = new Map<string, ParsedDependency[]>();

    for (const dir of project.getPackageDirectories()) {
      const deps = isNamedPackagingDirectory(dir) ? (dir.dependencies ?? []) : [];
      const parsed: ParsedDependency[] = [];

      for (const dep of deps) {
        const resolvedPackage = project.getPackageIdFromAlias(dep.package) ?? dep.package;
        parsed.push(parseDependency(resolvedPackage, dep.versionNumber));
      }

      result.set(dir.path, parsed);
    }

    return result;
  }

  /**
   * @param keyPath - A dot-delimited path into `sfdx-project.json`'s contents, e.g.
   * `plugins.simply.dependencies.ignore`.
   * @returns The value at `keyPath`, or `undefined` if any segment along the path is missing.
   */
  function getPluginConfig<T>(keyPath: string): T | undefined {
    const parts = keyPath.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = contents;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      current = current[part];
    }
    return current as T;
  }

  /** @returns Package2Ids/aliases configured under `plugins.simply.dependencies.ignore`. */
  function getDependenciesToIgnore(): string[] {
    return getPluginConfig<string[]>('plugins.simply.dependencies.ignore') ?? [];
  }

  /** @returns Branch names configured under `plugins.simply.package.brancheswithreleasedversions`. */
  function getBranchesWithReleasedVersions(): string[] {
    return getPluginConfig<string[]>('plugins.simply.package.brancheswithreleasedversions') ?? [];
  }

  /**
   * Apply a set of dependency version changes to the in-memory project JSON and write it back to
   * disk, updating each affected directory's dependency entries and `packageAliases` as needed.
   *
   * @param changesByDirectory - The changes to apply, keyed by package directory path.
   */
  async function applyChanges(changesByDirectory: Map<string, DependencyChange[]>): Promise<void> {
    // Deep-clone both structures so we can mutate them freely before calling set()
    const updatedDirs = JSON.parse(JSON.stringify(contents.packageDirectories ?? [])) as Array<Record<string, unknown>>;
    const updatedAliases = { ...getAliases() };

    for (const [dirPath, changes] of changesByDirectory) {
      // `dirPath` comes from `SfProject.getPackageDirectories()`, which normalizes the path to the
      // OS separator. The raw JSON on disk always uses forward slashes, so compare both
      // slash-normalized to avoid a false mismatch (and a silent no-op write) on Windows.
      const dir = updatedDirs.find((d) => normalizePathSep(d['path'] as string) === normalizePathSep(dirPath));
      if (!dir) continue;

      const deps = (dir['dependencies'] ?? []) as Array<Record<string, string>>;

      for (const change of changes) {
        const dep = deps.find(
          (d) =>
            resolveAlias(d['package']) === change.oldDependency.package2Id ||
            resolveAlias(d['package']) === change.oldDependency.subscriberPackageVersionId,
        );

        if (!dep) continue;

        if (change.newSubscriberPackageVersionId) {
          // Pinned version: set alias, clear versionNumber
          dep['package'] = change.newAlias;
          delete dep['versionNumber'];
          updatedAliases[change.newAlias] = change.newSubscriberPackageVersionId;

          // Add package-level alias if provided
          if (change.newPackage2Id) {
            const pkgAlias = change.newAlias.split('@')[0];
            if (pkgAlias && !updatedAliases[pkgAlias]) {
              updatedAliases[pkgAlias] = change.newPackage2Id;
            }
          }

          // Remove old version alias if it changed and pointed to a subscriber package version
          if (change.oldAlias !== change.newAlias) {
            const oldTarget = updatedAliases[change.oldAlias];
            if (oldTarget?.startsWith(PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION)) {
              delete updatedAliases[change.oldAlias];
            }
          }
        } else if (change.newPackage2Id && change.newVersionNumber) {
          // Non-pinned version: set package 0Ho alias and versionNumber
          dep['package'] = change.newAlias;
          dep['versionNumber'] = change.newVersionNumber;
          updatedAliases[change.newAlias] = change.newPackage2Id;

          if (change.oldAlias !== change.newAlias) {
            const oldTarget = updatedAliases[change.oldAlias];
            if (oldTarget?.startsWith(PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION)) {
              delete updatedAliases[change.oldAlias];
            }
          }
        }
      }
    }

    const sortedAliases = Object.fromEntries(Object.entries(updatedAliases).sort(([a], [b]) => a.localeCompare(b)));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    projectJson.set('packageDirectories', updatedDirs as any);
    projectJson.set('packageAliases', sortedAliases);
    await projectJson.write();
  }

  return {
    getDependenciesByDirectory,
    getDependenciesToIgnore,
    getBranchesWithReleasedVersions,
    findAlias,
    resolveAlias,
    applyChanges,
  };
}

/** @returns `path` with backslashes converted to forward slashes, for OS-agnostic path comparison. */
function normalizePathSep(path: string): string {
  return path.replace(/\\/g, '/');
}
