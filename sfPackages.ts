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

import { promises as fs } from 'node:fs';
import { runSf, runSfJson } from './exec/sfCli.js';
import { logger } from './logger.js';
import { authenticateOrg } from './sfAuth.js';
import type { UpgradedPackage } from './schemas/deployProgress.js';

export type InstallPackageDependenciesConfig = {
  alias?: string;
  wait?: string;
  noPrompt?: boolean;
  debug?: boolean;
  installType?: 'All' | 'Delta' | 'Upgrade';
  /** When set, passed as `sf simply package dependencies install`'s `--output-file`. */
  outputFile?: string;
};

/** One entry from `sf simply package dependencies install --output-file`'s JSON report. */
type InstallReportEntry = {
  PackageName: string;
  ExistingSubscriberPackageVersionId: string;
  SubscriberPackageVersionId: string;
  Status: string;
};

/** The fields read off `sf package version report --package <id> --json`. */
type PackageVersionReport = { Version?: string; Description?: string; Tag?: string };

/**
 * Installs Salesforce package dependencies defined in `sfdx-project.json` using the
 * `@simplysf/simply` plugin's `sf simply package dependencies install` command.
 */
export async function installPackageDependencies(config: InstallPackageDependenciesConfig = {}): Promise<void> {
  const { alias, wait = '120', noPrompt = true, installType = 'Upgrade', outputFile } = config;

  logger.info('Installing packaged dependencies using the @simplysf/simply plugin...');
  try {
    const args = [
      'simply',
      'package',
      'dependencies',
      'install',
      '--apex-compile',
      'package',
      '--wait',
      wait,
      '--install-type',
      installType,
    ];
    if (alias) {
      args.push('--target-org', alias);
    }
    if (noPrompt) {
      args.push('--no-prompt');
    }
    if (outputFile) {
      args.push('--output-file', outputFile);
    }

    await runSf(args, { stdio: 'inherit' });
    logger.success('Packaged dependencies installed successfully.');
  } catch (error) {
    logger.error('Failed to install packaged dependencies.');
    logger.error(String(error));
    throw error;
  }
}

export type ResolveUpgradedPackagesConfig = {
  devhubToolingUsername?: string;
  devhubToolingClientId?: string;
  devhubToolingInstanceUrl?: string;
  jwtKeyFile?: string;
  debug?: boolean;
};

/** Reads an install report and returns the entries that upgraded an already-installed package. */
async function readUpgradedEntries(reportFile: string): Promise<InstallReportEntry[]> {
  const contents = await fs.readFile(reportFile, 'utf-8');
  const entries = JSON.parse(contents) as InstallReportEntry[];

  return entries.filter(
    (entry) =>
      entry.Status === 'Installed' &&
      Boolean(entry.ExistingSubscriberPackageVersionId) &&
      entry.ExistingSubscriberPackageVersionId !== entry.SubscriberPackageVersionId,
  );
}

/** Runs `sf package version report` for one subscriber package version. Returns `undefined` on failure. */
async function reportPackageVersion(subscriberPackageVersionId: string): Promise<PackageVersionReport | undefined> {
  try {
    const { result } = await runSfJson<{ result: PackageVersionReport }>([
      'package',
      'version',
      'report',
      '--package',
      subscriberPackageVersionId,
      '--json',
    ]);
    return result;
  } catch (error) {
    logger.warn(`Could not get package version report for ${subscriberPackageVersionId}: ${(error as Error).message}`);
    return undefined;
  }
}

/**
 * Reads an `sf simply package dependencies install --output-file` report, and for every package it
 * upgraded, fetches the previous and target version's `sf package version report` (for the origin
 * commit SHA and pipeline URL). A package whose version report can't be resolved is skipped with a
 * warning rather than failing the whole deployment — this data only feeds a later notification.
 */
export async function resolveUpgradedPackages(
  reportFile: string,
  config: ResolveUpgradedPackagesConfig,
): Promise<UpgradedPackage[]> {
  const upgradedEntries = await readUpgradedEntries(reportFile);
  if (upgradedEntries.length === 0) {
    return [];
  }

  const { devhubToolingUsername, devhubToolingClientId, devhubToolingInstanceUrl, jwtKeyFile, debug } = config;
  if (!(devhubToolingUsername && devhubToolingClientId && devhubToolingInstanceUrl && jwtKeyFile)) {
    logger.warn('Missing DevHub tooling credentials. Skipping origin lookup for upgraded packages.');
    return [];
  }

  try {
    const authResult = await authenticateOrg({
      username: devhubToolingUsername,
      clientId: devhubToolingClientId,
      instanceUrl: devhubToolingInstanceUrl,
      jwtKeyFile,
      setDefaultDevHub: true,
      debug,
    });
    if (!authResult.success) {
      logger.warn(`DevHub tooling auth failed: ${authResult.message ?? 'unknown error'}. Skipping origin lookup.`);
      return [];
    }
  } catch (error) {
    logger.warn(`DevHub tooling auth failed: ${(error as Error).message}. Skipping origin lookup.`);
    return [];
  }

  const upgradedPackages: UpgradedPackage[] = [];

  for (const entry of upgradedEntries) {
    // eslint-disable-next-line no-await-in-loop -- each package's prev/target reports are fetched concurrently, but packages themselves are processed one at a time
    const [prevReport, targetReport] = await Promise.all([
      reportPackageVersion(entry.ExistingSubscriberPackageVersionId),
      reportPackageVersion(entry.SubscriberPackageVersionId),
    ]);

    if (!prevReport || !targetReport) {
      continue;
    }

    upgradedPackages.push({
      packageName: entry.PackageName,
      prevVersionId: entry.ExistingSubscriberPackageVersionId,
      prevVersionNumber: prevReport.Version,
      prevTag: prevReport.Tag,
      targetVersionId: entry.SubscriberPackageVersionId,
      targetVersionNumber: targetReport.Version,
      targetTag: targetReport.Tag,
      targetDescription: targetReport.Description,
    });
  }

  return upgradedPackages;
}
