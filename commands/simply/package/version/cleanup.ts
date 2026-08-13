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

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Logger } from '@salesforce/core';
import {
  Package,
  PackageSaveResult,
  PackageVersion,
  PackageVersionListOptions,
  PackageVersionOptions,
} from '@salesforce/packaging';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-package', 'simply.package.version.cleanup');

/** Outcome of deleting a single (unreleased) package version. */
export type PackageVersionCleanupResult = {
  Error?: string;
  Success: boolean;
  SubscriberPackageVersionId: string;
};

/** A parsed, validated MAJOR.MINOR.PATCH matcher. */
type ParsedMatcher = {
  major: string;
  minor: string;
  patch: string;
};

/**
 * Parse and validate a MAJOR.MINOR.PATCH matcher string.
 *
 * @param matcher - The raw `--matcher`/`--exclude-matcher` flag value.
 * @returns The matcher's parsed major/minor/patch components.
 * @throws {SfError} If `matcher` isn't in MAJOR.MINOR.PATCH format.
 */
function parseMatcher(matcher: string): ParsedMatcher {
  const matcherRegex = new RegExp(/^\d+\.\d+\.\d+$/);

  if (!matcherRegex.test(matcher)) {
    throw messages.createError('errors.matcherFormatMismatch');
  }

  const [major, minor, patch] = matcher.split('.');

  return { major, minor, patch };
}

/**
 * Deletes package versions for a given package matching a MAJOR.MINOR.PATCH matcher, or - if an
 * exclusion matcher is provided instead - every unreleased version that does *not* match it.
 * Does not delete released package versions.
 */
export default class PackageVersionCleanup extends SfCommand<PackageVersionCleanupResult[]> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  // This is annoying, but the underlying Salesforce Packaging API expects you to be in a project context
  // https://github.com/forcedotcom/packaging/blob/49e2f0b76a8d206369bf99906d02f6c54d89247d/src/package/package.ts#L144
  public static readonly requiresProject = true;

  public static readonly flags = {
    ...SfCommand.baseFlags,
    'api-version': Flags.orgApiVersion(),
    matcher: Flags.string({
      summary: messages.getMessage('flags.matcher.summary'),
      description: messages.getMessage('flags.matcher.description'),
      char: 's',
      exclusive: ['exclude-matcher'],
    }),
    'exclude-matcher': Flags.string({
      summary: messages.getMessage('flags.exclude-matcher.summary'),
      description: messages.getMessage('flags.exclude-matcher.description'),
      char: 'x',
      exclusive: ['matcher'],
    }),
    package: Flags.string({
      summary: messages.getMessage('flags.package.summary'),
      description: messages.getMessage('flags.package.description'),
      char: 'p',
      required: true,
    }),
    'target-dev-hub': Flags.requiredHub(),
  };

  /**
   * @returns The delete outcome for every unreleased version matching `--matcher`, or every
   * unreleased version *not* matching `--exclude-matcher`.
   */
  public async run(): Promise<PackageVersionCleanupResult[]> {
    const log = await Logger.child(this.ctor.name);

    const { flags } = await this.parse(PackageVersionCleanup);

    // Create a connection to the org
    const connection = flags['target-dev-hub']?.getConnection(flags['api-version']);

    if (!connection) {
      throw messages.createError('errors.connectionFailed');
    }

    if (!flags.matcher && !flags['exclude-matcher']) {
      throw messages.createError('errors.matcherRequired');
    }

    const isExclusion = Boolean(flags['exclude-matcher']);
    const {
      major: majorMatcher,
      minor: minorMatcher,
      patch: patchMatcher,
    } = parseMatcher((flags.matcher ?? flags['exclude-matcher'])!);

    log.info(
      `${isExclusion ? 'Exclude' : 'Include'} Matcher - Major: ${majorMatcher} Minor: ${minorMatcher} Patch: ${patchMatcher}`,
    );

    const packageVersionListOptions: PackageVersionListOptions = {
      concise: false,
      createdLastDays: undefined,
      modifiedLastDays: undefined,
      orderBy: 'MajorVersion, MinorVersion, PatchVersion, BuildNumber',
      packages: [flags.package],
      isReleased: false,
      verbose: true,
    };

    this.spinner.start('Analyzing which package versions to delete...');

    const packageVersions = await Package.listVersions(connection, this.project, packageVersionListOptions);

    const targetVersions = packageVersions.filter((packageVersion) => {
      if (packageVersion.IsReleased !== false) {
        return false;
      }

      const matchesMatcher =
        packageVersion.MajorVersion.toString() === majorMatcher &&
        packageVersion.MinorVersion.toString() === minorMatcher &&
        packageVersion.PatchVersion.toString() === patchMatcher;

      return isExclusion ? !matchesMatcher : matchesMatcher;
    });

    const packageVersionDeletePromiseRequests: Array<Promise<PackageSaveResult>> = [];

    targetVersions.forEach((targetVersion) => {
      const packageVersionOptions: PackageVersionOptions = {
        connection,
        project: this.project,
        idOrAlias: targetVersion.SubscriberPackageVersionId,
      };

      packageVersionDeletePromiseRequests.push(new PackageVersion(packageVersionOptions).delete());
    });

    const results: PackageVersionCleanupResult[] = [];

    this.spinner.stop();

    this.spinner.start('Deleting the package versions...');

    const promiseResults = await Promise.allSettled(packageVersionDeletePromiseRequests);

    promiseResults.forEach((promiseResult, index) => {
      switch (promiseResult.status) {
        case 'fulfilled':
          results.push({
            Success: promiseResult?.value?.success,
            SubscriberPackageVersionId: targetVersions[index].SubscriberPackageVersionId,
          });
          break;
        case 'rejected':
          results.push({
            Success: false,
            Error: promiseResult.reason as string,
            SubscriberPackageVersionId: targetVersions[index].SubscriberPackageVersionId,
          });
          break;
      }
    });

    this.spinner.stop();

    this.displayDeletionResults(results);

    return results;
  }

  /** Render the deletion results as a table on stdout. */
  private displayDeletionResults(packageCleanupResults: PackageVersionCleanupResult[]): void {
    this.styledHeader('Package Version Cleanup Results');
    this.table({
      data: packageCleanupResults,
      columns: [
        { key: 'SubscriberPackageVersionId', name: 'PACKAGE VERSION ID' },
        { key: 'Success', name: 'SUCCESS' },
        { key: 'Error', name: 'ERROR' },
      ],
    });
  }
}
