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

import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ComponentSet, type SourceComponent } from '@salesforce/source-deploy-retrieve';

/** Matches an `@IsTest` annotation (with or without arguments) at the start of a line. */
const IS_TEST_PATTERN = /^@istest\b/i;

/**
 * @returns The first non-blank, non-comment line of `source` (leading `//` line comments and
 * `/* ... *&#47;` block comments — including multi-line ones — are skipped), trimmed. `undefined`
 * if `source` has no such line (empty, or entirely comments/whitespace).
 */
function firstMeaningfulLine(source: string): string | undefined {
  let i = 0;
  const n = source.length;

  while (i < n) {
    while (i < n && /\s/.test(source[i])) {
      i++;
    }
    if (i >= n) {
      return undefined;
    }

    if (source.startsWith('//', i)) {
      const newlineIndex = source.indexOf('\n', i);
      i = newlineIndex === -1 ? n : newlineIndex + 1;
      continue;
    }

    if (source.startsWith('/*', i)) {
      const endIndex = source.indexOf('*/', i + 2);
      i = endIndex === -1 ? n : endIndex + 2;
      continue;
    }

    const newlineIndex = source.indexOf('\n', i);
    return source.slice(i, newlineIndex === -1 ? n : newlineIndex).trim();
  }

  return undefined;
}

/**
 * @returns Whether `source` (an Apex class file's full text) is `@IsTest`-annotated — its first
 * meaningful line (skipping leading blank lines and comments) starts with `@IsTest`, case-insensitive,
 * optionally followed by arguments (e.g. `@IsTest(SeeAllData=true)`).
 */
export function isTestClassSource(source: string): boolean {
  const line = firstMeaningfulLine(source);
  return line !== undefined && IS_TEST_PATTERN.test(line);
}

/** The error conditions `generateApexTestSuite` signals structurally (via `code`) rather than by message text, so a `Messages`-based caller (the CLI) can map each one to its own error key without string-matching. */
export type ApexTestSuiteErrorCode = 'no-test-classes-found' | 'scan-failed';

export class ApexTestSuiteError extends Error {
  public readonly code: ApexTestSuiteErrorCode;

  public constructor(code: ApexTestSuiteErrorCode, message: string) {
    super(message);
    this.name = 'ApexTestSuiteError';
    this.code = code;
  }
}

/**
 * Scans `sourceDirs` (recursively) for Apex classes and returns the full names of the ones that
 * are `@IsTest`-annotated, deduplicated and sorted alphabetically.
 *
 * @throws {ApexTestSuiteError} `scan-failed` if `ComponentSet.fromSource` can't resolve `sourceDirs`.
 */
export function scanTestClasses(sourceDirs: string[]): string[] {
  let components: ComponentSet;
  try {
    components = ComponentSet.fromSource(sourceDirs);
  } catch (error) {
    throw new ApexTestSuiteError('scan-failed', (error as Error).message);
  }

  const testClassNames = new Set<string>();

  for (const rawComponent of components) {
    const component = rawComponent as SourceComponent;

    if (component.type.id !== 'apexclass' || !component.content) {
      continue;
    }

    let text: string;
    try {
      text = readFileSync(component.content, 'utf-8');
    } catch {
      continue;
    }

    if (isTestClassSource(text)) {
      testClassNames.add(component.fullName);
    }
  }

  return [...testClassNames].sort((a, b) => a.localeCompare(b));
}

/** @returns A full `.testSuite-meta.xml` document listing `testClassNames`, in the shape `ApexTestSuite` requires (no `<label>` or other fields — identity is filename-only). */
export function buildApexTestSuiteXml(testClassNames: string[]): string {
  const entries = testClassNames.map((name) => `    <testClassName>${name}</testClassName>`).join('\n');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<ApexTestSuite xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
    `${entries}\n` +
    '</ApexTestSuite>\n'
  );
}

export type ApexTestSuiteGenerateResult = {
  filePath: string;
  testClassNames: string[];
};

/**
 * Scans `sourceDirs` for `@IsTest`-annotated Apex classes and writes `<name>.testSuite-meta.xml` to
 * `outputDir`, always overwriting whatever was there.
 *
 * @throws {ApexTestSuiteError} `scan-failed` — see `scanTestClasses`. `no-test-classes-found` if the
 * scan matches zero `@IsTest` classes (nothing useful to write).
 */
export async function generateApexTestSuite(
  sourceDirs: string[],
  outputDir: string,
  name: string,
): Promise<ApexTestSuiteGenerateResult> {
  const testClassNames = scanTestClasses(sourceDirs);

  if (testClassNames.length === 0) {
    throw new ApexTestSuiteError(
      'no-test-classes-found',
      `No @IsTest-annotated classes were found in ${sourceDirs.join(', ')}.`,
    );
  }

  const xml = buildApexTestSuiteXml(testClassNames);
  const filePath = path.join(outputDir, `${name}.testSuite-meta.xml`);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(filePath, xml, 'utf-8');

  return { filePath, testClassNames };
}
