/*
 * Copyright (c) 2026, SimplySF.
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

import fs from 'node:fs';
import path from 'node:path';
import { SfError } from '@salesforce/core';

/** The conventional file name of a Salesforce DX project manifest. */
export const SFDX_PROJECT_FILE_NAME = 'sfdx-project.json';

/** A dependency declared by a package directory. */
export type SfdxPackageDirectoryDependency = {
  [key: string]: unknown;
  /** A package alias, or a `0Ho`/`04t` ID. */
  package?: string;
  versionNumber?: string;
  branch?: string;
};

/** One entry in `packageDirectories`. Unlisted properties stay reachable via the index signature. */
export type SfdxPackageDirectory = {
  [key: string]: unknown;
  path?: string;
  default?: boolean;
  /** The package alias this directory builds, for a packaging directory. */
  package?: string;
  versionNumber?: string;
  definitionFile?: string;
  branch?: string;
  dependencies?: SfdxPackageDirectoryDependency[];
  seedMetadata?: { path?: string };
  packageMetadataAccess?: { permissionSets?: string[]; permissionSetLicenses?: string[] };
};

/**
 * A parsed `sfdx-project.json`.
 *
 * Deliberately structural and permissive rather than an exhaustive schema: Salesforce adds
 * properties to this file regularly, and every consumer here reads a different handful of them.
 * The index signature keeps anything unlisted reachable without a cast.
 */
export type SfdxProject = {
  [key: string]: unknown;
  packageDirectories: SfdxPackageDirectory[];
  packageAliases?: Record<string, string>;
  namespace?: string;
  sourceApiVersion?: string;
  /** Plugin-specific configuration, keyed by plugin name. */
  plugins?: Record<string, unknown>;
};

/**
 * Read and parse a Salesforce DX project manifest.
 *
 * Validates only that `packageDirectories` is present and an array — the one invariant every
 * caller depends on. Anything beyond that is left to the caller, since each reads a different
 * subset and treats a missing value differently (some default, some throw).
 *
 * @param projectDir - Directory containing `sfdx-project.json`. Defaults to the current
 * working directory, matching how these commands run inside a CI job's checkout.
 * @returns The parsed project manifest.
 * @throws {NodeJS.ErrnoException} If the file can't be read — `code` is `'ENOENT'` when it's
 * simply absent, which callers treating a missing project as non-fatal can check for.
 * @throws {SyntaxError} If the file isn't valid JSON.
 * @throws {SfError} If `packageDirectories` is missing or isn't an array.
 */
export async function readSfdxProject(projectDir: string = process.cwd()): Promise<SfdxProject> {
  const filePath = path.join(projectDir, SFDX_PROJECT_FILE_NAME);
  const parsed = JSON.parse(await fs.promises.readFile(filePath, 'utf-8')) as SfdxProject;

  if (!Array.isArray(parsed?.packageDirectories)) {
    throw new SfError(
      `Invalid or missing packageDirectories array in ${SFDX_PROJECT_FILE_NAME}`,
      'InvalidSfdxProjectError',
    );
  }

  return parsed;
}

/**
 * Find the package directory marked `default: true`.
 *
 * Nearly every caller wants this one directory rather than the whole list — it's where a project's
 * own package, version number, and scratch definition live.
 *
 * @param project - The parsed project manifest.
 * @returns The default package directory, or `undefined` if none is marked.
 */
export function getDefaultPackageDirectory(project: SfdxProject): SfdxPackageDirectory | undefined {
  return project.packageDirectories.find((directory) => directory.default);
}

/**
 * Read a value out of `sfdx-project.json` by dot-delimited path, without casting through the
 * intervening objects.
 *
 * `sfdx-project.json` is the conventional home for per-plugin settings, nested under
 * `plugins.<name>`, and reading one means walking several optional levels that may each be
 * absent in a valid project file.
 *
 * @param source - The parsed project manifest, or any object to walk.
 * @param keyPath - Dot-delimited path, e.g. `plugins.simply.dependencies.ignore`.
 * @returns The value at `keyPath`, or `undefined` if any segment along the way is missing or
 * isn't an object. The return type is unchecked — the caller asserts what it expects to find.
 */
export function getPluginConfig<T>(source: Record<string, unknown>, keyPath: string): T | undefined {
  let current: unknown = source;

  for (const segment of keyPath.split('.')) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current as T | undefined;
}
