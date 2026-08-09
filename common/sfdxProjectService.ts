/*
 * Copyright (c) 2026, Clay Chipps; Copyright (c) 2026 Salesforce, Inc.
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
import { DependencyChange } from '../schemas/manage/dependencyChange.js';
import { ParsedDependency, parseDependency } from '../schemas/manage/parsedDependency.js';
import { PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION } from './packageUtils.js';

export type SfdxProjectService = {
  getDependenciesByDirectory(): Map<string, ParsedDependency[]>;
  getDependenciesToIgnore(): string[];
  getBranchesWithReleasedVersions(): string[];
  findAlias(id: string): string | undefined;
  resolveAlias(alias: string): string;
  applyChanges(changesByDirectory: Map<string, DependencyChange[]>): Promise<void>;
};

export async function buildProjectService(project: SfProject): Promise<SfdxProjectService> {
  const projectJson = await project.retrieveSfProjectJson();
  const contents = projectJson.getContents();

  function getAliases(): Record<string, string> {
    return (contents.packageAliases as Record<string, string>) ?? {};
  }

  function resolveAlias(alias: string): string {
    return project.getPackageIdFromAlias(alias) ?? alias;
  }

  function findAlias(id: string): string | undefined {
    const aliases = getAliases();
    for (const [k, v] of Object.entries(aliases)) {
      if (v === id) return k;
    }
    return undefined;
  }

  function getDependenciesByDirectory(): Map<string, ParsedDependency[]> {
    const result = new Map<string, ParsedDependency[]>();

    for (const dir of project.getPackageDirectories()) {
      const deps = isNamedPackagingDirectory(dir) ? dir.dependencies ?? [] : [];
      const parsed: ParsedDependency[] = [];

      for (const dep of deps) {
        const resolvedPackage = project.getPackageIdFromAlias(dep.package) ?? dep.package;
        parsed.push(parseDependency(resolvedPackage, dep.versionNumber));
      }

      result.set(dir.path, parsed);
    }

    return result;
  }

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

  function getDependenciesToIgnore(): string[] {
    return getPluginConfig<string[]>('plugins.simply.dependencies.ignore') ?? [];
  }

  function getBranchesWithReleasedVersions(): string[] {
    return getPluginConfig<string[]>('plugins.simply.package.brancheswithreleasedversions') ?? [];
  }

  async function applyChanges(changesByDirectory: Map<string, DependencyChange[]>): Promise<void> {
    // Deep-clone both structures so we can mutate them freely before calling set()
    const updatedDirs = JSON.parse(JSON.stringify(contents.packageDirectories ?? [])) as Array<Record<string, unknown>>;
    const updatedAliases = { ...getAliases() };

    for (const [dirPath, changes] of changesByDirectory) {
      const dir = updatedDirs.find((d) => d['path'] === dirPath);
      if (!dir) continue;

      const deps = (dir['dependencies'] ?? []) as Array<Record<string, string>>;

      for (const change of changes) {
        const dep = deps.find(
          (d) =>
            resolveAlias(d['package']) === change.oldDependency.package2Id ||
            resolveAlias(d['package']) === change.oldDependency.subscriberPackageVersionId
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    projectJson.set('packageDirectories', updatedDirs as any);
    projectJson.set('packageAliases', updatedAliases);
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
