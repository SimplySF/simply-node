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

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { logger } from './logger.js';

export type HasApexTestsOptions = {
  debugMode?: boolean;
};

export type RunApexTestsOptions = {
  alias?: string;
  testLevel?: string;
  testSuite?: string;
  wait?: string;
  debugMode?: boolean;
};

type ApexTestResult = {
  summary?: { outcome?: string; passing?: number; failing?: number; skipped?: number };
  tests?: Array<{ Outcome?: string; FullName?: string; Message?: string; StackTrace?: string }>;
};

/**
 * Checks if there are any Apex test classes defined in the package directories, by reading
 * `sfdx-project.json` to identify the package directories and searching each recursively
 * (case-insensitively) for `@isTest` in `.cls` files.
 */
export async function hasApexTests(options?: HasApexTestsOptions): Promise<boolean> {
  let packageDirs = ['force-app'];
  try {
    const sfdxProjectJson = JSON.parse(await fs.readFile('sfdx-project.json', 'utf-8')) as {
      packageDirectories?: Array<{ path?: string }>;
    };
    if (Array.isArray(sfdxProjectJson.packageDirectories)) {
      packageDirs = sfdxProjectJson.packageDirectories.map((d) => d.path).filter((p): p is string => Boolean(p));
    }
  } catch {
    if (options?.debugMode) {
      logger.warn('Could not read sfdx-project.json to identify package directories. Using default force-app.');
    }
  }

  for (const dir of packageDirs) {
    try {
      // eslint-disable-next-line no-await-in-loop -- stops at the first directory with a match
      await execa('grep', ['-q', '-r', '-i', '--include=*.cls', '@isTest\\b', dir]);
      return true;
    } catch (error) {
      if (options?.debugMode) {
        const err = error as { shortMessage?: string };
        logger.log(`No Apex tests found in ${dir} or an error occurred during search.`, err.shortMessage);
      }
    }
  }

  return false;
}

/**
 * Runs Apex tests in the specified target Salesforce organization. First checks that any Apex
 * tests exist before initiating the run. Test results are written to `./test-results/apex` in
 * JUnit and JSON formats. If tests fail, a detailed failure report is printed and this throws.
 */
export async function runApexTests(options: RunApexTestsOptions): Promise<void> {
  const { alias, testLevel = 'RunLocalTests', testSuite, wait = '60' } = options;

  if (!(await hasApexTests(options))) {
    logger.warn('No Apex test classes found. Skipping Apex tests.');
    return;
  }

  logger.info('Running Apex tests...');
  const testResultsDir = './test-results/apex';
  await fs.mkdir(testResultsDir, { recursive: true });

  const args = [
    'apex',
    'test',
    'run',
    '--code-coverage',
    '--result-format',
    'junit',
    '--output-dir',
    testResultsDir,
    '--wait',
    wait,
  ];

  if (alias) {
    args.push('--target-org', alias);
  }

  if (testSuite) {
    args.push('--suite-names', testSuite);
  } else {
    args.push('--test-level', testLevel);
  }

  let testRunId: string | undefined;
  let testRunOutcome: string | undefined;
  let execError: Error | undefined;

  try {
    await execa('sf', args, { stdio: 'pipe' });
  } catch (e) {
    execError = e as Error;
  }

  const testRunIdFile = path.join(testResultsDir, 'test-run-id.txt');
  try {
    testRunId = (await fs.readFile(testRunIdFile, 'utf-8')).trim();
  } catch (readIdError) {
    if (execError) {
      logger.error('Apex test run failed.', (execError as { shortMessage?: string }).shortMessage);
      throw execError;
    } else {
      logger.error(`Failed to read test run ID from ${testRunIdFile}.`, (readIdError as Error).message);
      throw readIdError;
    }
  }

  if (testRunId) {
    const resultFilePath = path.join(testResultsDir, `test-result-${testRunId}.json`);
    try {
      const resultsContent = await fs.readFile(resultFilePath, 'utf-8');
      const results = JSON.parse(resultsContent) as ApexTestResult;
      testRunOutcome = results.summary?.outcome;

      if (testRunOutcome === 'Failed') {
        logger.error('Apex test run failed.');
      } else {
        logger.success('Apex tests completed successfully.');
        return;
      }

      const failingTests = results.tests ? results.tests.filter((t) => t.Outcome === 'Fail') : [];

      if (failingTests.length > 0) {
        logger.raw('\n' + '='.repeat(80));
        logger.raw(`❌ APEX TEST FAILURE REPORT (${failingTests.length} failures found)`);
        logger.raw('='.repeat(80));

        failingTests.forEach((t, index) => {
          logger.raw(`\n[${index + 1}/${failingTests.length}] ❌ ${t.FullName ?? 'Unknown test'}`);
          logger.raw(`    Message:     ${t.Message ? t.Message.trim().replace(/\n/g, '\n                 ') : 'N/A'}`);
          if (t.StackTrace) {
            logger.raw(`    Stack Trace: ${t.StackTrace.trim().replace(/\n/g, '\n                 ')}`);
          }
          logger.raw('-'.repeat(80));
        });
        logger.raw();
      } else if (testRunOutcome === 'Failed') {
        logger.warn(
          'Test run was marked as failed, but no individual test failures were found. This could indicate a compile error or issue.',
        );
      } else {
        logger.info(
          `Test run summary: ${results.summary?.passing ?? 0} passed, ${results.summary?.failing ?? 0} failed, ${
            results.summary?.skipped ?? 0
          } skipped.`,
        );
      }
    } catch (fileError) {
      logger.error(`Failed to read or parse test result file at ${resultFilePath}.`, (fileError as Error).message);
      if (execError) {
        throw execError;
      }
      throw fileError;
    }
  }

  if (testRunOutcome === 'Failed') {
    throw new Error('Apex test run included failures.');
  }
}
