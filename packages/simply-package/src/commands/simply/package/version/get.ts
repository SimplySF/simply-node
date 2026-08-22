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

import { Messages } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { SfdxProject } from '@simplysf/simply-core';
import {
  findPackageVersions,
  PackageVersionMatch,
  PackageVersionSource,
} from '../../../../common/packageVersionLookup.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-package', 'simply.package.version.get');

/** The version a package is declared at in `sfdx-project.json`, and where that declaration lives. */
export type PackageVersionGetResult = {
  package: string;
  version: string;
  source: PackageVersionSource;
  packageDirectory: string;
  subscriberPackageVersionId?: string;
};

/**
 * Reads a package's version out of `sfdx-project.json` — either a dependency's version or the
 * version the project's own package is at. Local only: no org, Dev Hub, or auth involved.
 */
export default class PackageVersionGet extends SfCommand<PackageVersionGetResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly flags = {
    ...SfCommand.baseFlags,
    package: Flags.string({
      summary: messages.getMessage('flags.package.summary'),
      description: messages.getMessage('flags.package.description'),
      char: 'p',
      required: true,
    }),
    directory: Flags.string({
      summary: messages.getMessage('flags.directory.summary'),
      description: messages.getMessage('flags.directory.description'),
      char: 'd',
    }),
  };

  /**
   * @returns The declared version of `--package`, and where in the project file it was declared.
   * @throws {SfError} If the package isn't declared, is declared without a resolvable version, or
   * is declared at conflicting versions in more than one package directory.
   */
  public async run(): Promise<PackageVersionGetResult> {
    const { flags } = await this.parse(PackageVersionGet);

    const projectJson = await this.project!.retrieveSfProjectJson();
    const project = projectJson.getContents() as unknown as SfdxProject;

    const matches = findPackageVersions(project, flags.package, { directory: flags.directory });

    if (matches.length === 0) {
      throw messages.createError('errors.packageNotFound', [flags.package, describeSearchScope(project, flags)]);
    }

    const versionedMatches = matches.filter((match) => match.version);

    if (versionedMatches.length === 0) {
      throw messages.createError('errors.noVersionFound', [flags.package, matches[0].packageDirectory]);
    }

    const distinctVersions = new Set(versionedMatches.map((match) => match.version));

    if (distinctVersions.size > 1) {
      throw messages.createError('errors.ambiguousMatch', [flags.package, describeMatches(versionedMatches)]);
    }

    const match = versionedMatches[0];

    const result: PackageVersionGetResult = {
      package: match.package,
      version: match.version!,
      source: match.source,
      packageDirectory: match.packageDirectory,
      ...(match.subscriberPackageVersionId
        ? { subscriberPackageVersionId: match.subscriberPackageVersionId }
        : undefined),
    };

    // Nothing but the version, so `$(sf simply package version get -p foo)` is directly usable.
    // SfCommand.log is a no-op under --json, so this doesn't disturb the JSON output.
    this.log(result.version);

    return result;
  }
}

/**
 * @param project - The parsed `sfdx-project.json` contents.
 * @param flags - The command's parsed flags.
 * @returns A description of which package directories were searched, for the not-found error.
 */
function describeSearchScope(project: SfdxProject, flags: { directory?: string }): string {
  if (flags.directory) {
    return `package directory '${flags.directory}'`;
  }

  const paths = project.packageDirectories.map((directory) => directory.path ?? '<unnamed>');

  return `package directories: ${paths.join(', ')}`;
}

/**
 * @param matches - The conflicting matches.
 * @returns A `version (directory)` list, for the ambiguity error.
 */
function describeMatches(matches: PackageVersionMatch[]): string {
  return matches.map((match) => `${match.version!} (${match.packageDirectory})`).join(', ');
}
