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

import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import { SfError } from '@salesforce/core';
import { readSfdxProject } from '@simplysf/simply-core';
import { readNetworkSiteName } from './siteMetadataXml.js';

/** Normalize a filesystem path to forward slashes, which is what `glob` patterns expect. */
function toGlobPath(fsPath: string): string {
  return fsPath.split(path.sep).join('/');
}

/**
 * Resolve the root directories a site/network lookup should search under.
 *
 * When `--directory` is given, it's the sole root. Otherwise every package directory declared in
 * `sfdx-project.json` is searched — a project can (and often does) spread `sites`/`networks`
 * across more than one package directory.
 *
 * @param directory - The `--directory` flag value, if given.
 * @param projectDir - Directory to read `sfdx-project.json` from. Defaults to the current working
 * directory, matching `readSfdxProject`.
 * @returns Absolute root directories to search.
 */
export async function resolveSearchRoots(directory?: string, projectDir: string = process.cwd()): Promise<string[]> {
  if (directory) {
    return [path.resolve(directory)];
  }

  const project = await readSfdxProject(projectDir);

  return project.packageDirectories.map((packageDirectory) => path.resolve(projectDir, packageDirectory.path ?? '.'));
}

/**
 * Find the `sites/<site>.site-meta.xml` file for a CustomSite API name.
 *
 * @param site - The CustomSite API name (the basename of the site file, without its extension).
 * @param roots - Root directories to search, from {@link resolveSearchRoots}.
 * @returns The absolute path to the matched site file.
 * @throws {SfError} `CommunityUrlSiteFileNotFoundError` if no file matches.
 * @throws {SfError} `CommunityUrlSiteFileAmbiguousError` if more than one file matches.
 */
export async function resolveSiteFile(site: string, roots: string[]): Promise<string> {
  const patterns = roots.map((root) => `${toGlobPath(root)}/**/sites/${site}.site-meta.xml`);
  const matches = [...new Set((await Promise.all(patterns.map((pattern) => glob(pattern)))).flat())];

  if (matches.length === 0) {
    throw new SfError(
      `No site file found matching any of: ${patterns.join(', ')}`,
      'CommunityUrlSiteFileNotFoundError',
    );
  }

  if (matches.length > 1) {
    throw new SfError(
      `Multiple site files matched "${site}": ${matches.join(', ')}`,
      'CommunityUrlSiteFileAmbiguousError',
    );
  }

  return matches[0];
}

/**
 * Find the `networks/*.network-meta.xml` file whose `<site>` element names a CustomSite.
 *
 * Every `.network-meta.xml` file under the search roots is opened to check its `<site>` value,
 * since the Network's own file name doesn't have to match the CustomSite's API name.
 *
 * @param site - The CustomSite API name to search for.
 * @param roots - Root directories to search, from {@link resolveSearchRoots}.
 * @returns The absolute path to the matched network file.
 * @throws {SfError} `CommunityUrlNetworkFileNotFoundError` if no file's `<site>` matches.
 * @throws {SfError} `CommunityUrlNetworkFileAmbiguousError` if more than one file's `<site>` matches.
 */
export async function resolveNetworkFile(site: string, roots: string[]): Promise<string> {
  const patterns = roots.map((root) => `${toGlobPath(root)}/**/networks/*.network-meta.xml`);
  const candidates = [...new Set((await Promise.all(patterns.map((pattern) => glob(pattern)))).flat())];

  const matches: string[] = [];
  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const xml = await fs.readFile(candidate, 'utf-8');
    if (readNetworkSiteName(xml) === site) {
      matches.push(candidate);
    }
  }

  if (matches.length === 0) {
    throw new SfError(
      `No network file found whose <site> element is "${site}" under: ${patterns.join(', ')}`,
      'CommunityUrlNetworkFileNotFoundError',
    );
  }

  if (matches.length > 1) {
    throw new SfError(
      `Multiple network files reference site "${site}": ${matches.join(', ')}`,
      'CommunityUrlNetworkFileAmbiguousError',
    );
  }

  return matches[0];
}
