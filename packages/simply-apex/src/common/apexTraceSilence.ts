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

import type { Connection } from '@salesforce/core';
import { loadJsonConfigSync } from '@simplysf/simply-core';
import { ClassesToSilenceSchema } from './schemas/classesToSilence.js';

/** DeveloperName used for the fully-suppressed (NONE) debug level created for class silencing. */
const DEBUG_LEVEL_NAME = 'Silence';
/** How long a configured trace flag stays active before expiring, in milliseconds (24 hours). */
const TRACE_DURATION_MS = 24 * 60 * 60 * 1000;

/** Classes silenced by the `fflib` preset. */
export const FFLIB_CLASSES = ['fflib_SObjectDescribe', 'fflib_SObjectDomain'];
/** Classes silenced by the `at4dx` preset. */
export const AT4DX_CLASSES = ['ApplicationSObjectDomain'];
/** Classes silenced by the `forceDi` preset. */
export const FORCE_DI_CLASSES = ['di_Binding', 'di_Module', 'di_PlatformCache', 'di_Injector'];

/** The trace flag created to silence debug logs for a single Apex class. */
export type ApexTraceSilenceResult = {
  class: string;
  classId: string;
  traceFlagId: string;
};

/** Everything `silenceApexClasses` found out along the way, beyond the classes it actually silenced — for a CLI (or other) caller to report however it likes. */
export type ApexTraceSilenceOutcome = {
  results: ApexTraceSilenceResult[];
  /** Requested class names that don't exist as an `ApexClass` in the org. */
  missingClassNames: string[];
  /** A class that was found but whose trace flag couldn't be created/updated, with the API's error text and which of the two operations was attempted. */
  failures: Array<{ class: string; action: 'create' | 'update'; error: string }>;
};

/** The error conditions `resolveClasses`/`silenceApexClasses` signal structurally (via `code`) rather than by message text, so a `Messages`-based caller (the CLI) can map each one to its own error key without string-matching. */
export type ApexTraceSilenceErrorCode = 'invalid-classes-file' | 'no-classes-specified' | 'debug-level-create-failed';

export class ApexTraceSilenceError extends Error {
  public readonly code: ApexTraceSilenceErrorCode;

  public constructor(code: ApexTraceSilenceErrorCode, message: string) {
    super(message);
    this.name = 'ApexTraceSilenceError';
    this.code = code;
  }
}

/**
 * Resolve the list of Apex class names to silence from an explicit list, a classes-file path (a
 * JSON config matching {@link ClassesToSilenceSchema}), and the `fflib`/`at4dx`/`forceDi` built-in
 * presets. All sources are combined and deduplicated.
 *
 * @param classNames - Explicit class names (e.g. from a `--classes` flag already split on commas).
 * @param classesFilePath - Path to a JSON config file, if one was given.
 * @param presets - Which of the built-in class presets were requested.
 * @returns The resolved, trimmed, deduplicated list of Apex class names.
 * @throws {ApexTraceSilenceError} `invalid-classes-file` if `classesFilePath` was given but fails
 * schema validation.
 */
export function resolveClasses(
  classNames: string[],
  classesFilePath: string | undefined,
  presets: { fflib: boolean; at4dx: boolean; forceDi: boolean },
): string[] {
  const classes: string[] = [...classNames];

  if (classesFilePath) {
    const parsed = loadJsonConfigSync(classesFilePath, ClassesToSilenceSchema);

    if (!parsed.success) {
      throw new ApexTraceSilenceError('invalid-classes-file', parsed.message);
    }

    classes.push(...parsed.data.classes);
  }

  if (presets.fflib) {
    classes.push(...FFLIB_CLASSES);
  }

  if (presets.at4dx) {
    classes.push(...AT4DX_CLASSES);
  }

  if (presets.forceDi) {
    classes.push(...FORCE_DI_CLASSES);
  }

  return [...new Set(classes)];
}

/**
 * Creates or updates a 24-hour CLASS_TRACING trace flag with a fully suppressed (NONE) debug level
 * for each of `classNames`, preventing those classes from generating debug log output. A class
 * that already has a trace flag has its expiration extended instead of getting a duplicate.
 *
 * @param connection - The org connection to silence classes in.
 * @param classNames - The Apex class names to silence — see `resolveClasses`.
 * @param onPhase - Called as each of the three phases (checking the debug level, finding the
 * classes, writing trace flags) starts — a caller (the CLI) can use this to update a spinner.
 * Optional; has no effect on the operation itself.
 * @returns The trace flag created/updated per successfully-silenced class, plus any class names
 * that don't exist in the org and any per-class create/update failures.
 * @throws {ApexTraceSilenceError} `no-classes-specified` if `classNames` is empty,
 * `debug-level-create-failed` if the shared `Silence` debug level doesn't exist yet and couldn't be
 * created.
 */
export async function silenceApexClasses(
  connection: Connection,
  classNames: string[],
  onPhase?: (phase: 'checking-debug-level' | 'finding-classes' | 'creating-trace-flags') => void,
): Promise<ApexTraceSilenceOutcome> {
  if (classNames.length === 0) {
    throw new ApexTraceSilenceError('no-classes-specified', 'No Apex classes were specified to silence.');
  }

  onPhase?.('checking-debug-level');
  const debugLevelResult = await connection.tooling.query<{ Id: string }>(
    `SELECT Id FROM DebugLevel WHERE DeveloperName = '${DEBUG_LEVEL_NAME}'`,
  );

  let debugLevelId: string;

  if (debugLevelResult.records.length > 0) {
    debugLevelId = debugLevelResult.records[0].Id;
  } else {
    const createResult = await connection.tooling.sobject('DebugLevel').create({
      DeveloperName: DEBUG_LEVEL_NAME,
      MasterLabel: DEBUG_LEVEL_NAME,
      ApexCode: 'NONE',
      ApexProfiling: 'NONE',
      Callout: 'NONE',
      Database: 'NONE',
      System: 'NONE',
      Validation: 'NONE',
      Visualforce: 'NONE',
      Workflow: 'NONE',
    });

    if (!createResult.success) {
      throw new ApexTraceSilenceError(
        'debug-level-create-failed',
        createResult.errors.map((e) => e.message).join(', '),
      );
    }

    debugLevelId = createResult.id;
  }

  onPhase?.('finding-classes');
  const classesClause = classNames.map((className) => `'${className}'`).join(',');
  const classResult = await connection.tooling.query<{ Id: string; Name: string }>(
    `SELECT Id, Name FROM ApexClass WHERE Name IN (${classesClause})`,
  );

  if (classResult.records.length === 0) {
    return { results: [], missingClassNames: classNames, failures: [] };
  }

  const foundNames = new Set(classResult.records.map((record) => record.Name));
  const missingClassNames = classNames.filter((className) => !foundNames.has(className));

  const now = new Date();
  const expiration = new Date(now.getTime() + TRACE_DURATION_MS);
  const startDate = now.toISOString();
  const expirationDate = expiration.toISOString();

  const classIdsClause = classResult.records.map((record) => `'${record.Id}'`).join(',');
  const existingTraceFlagResult = await connection.tooling.query<{ Id: string; TracedEntityId: string }>(
    `SELECT Id, TracedEntityId FROM TraceFlag WHERE LogType = 'CLASS_TRACING' AND TracedEntityId IN (${classIdsClause})`,
  );
  const existingTraceFlagIdByClassId = new Map(
    existingTraceFlagResult.records.map((record) => [record.TracedEntityId, record.Id]),
  );

  const results: ApexTraceSilenceResult[] = [];
  const failures: Array<{ class: string; action: 'create' | 'update'; error: string }> = [];

  onPhase?.('creating-trace-flags');
  for (const classRecord of classResult.records) {
    const existingTraceFlagId = existingTraceFlagIdByClassId.get(classRecord.Id);

    if (existingTraceFlagId) {
      // eslint-disable-next-line no-await-in-loop -- trace flags are written sequentially, matching the CLI's per-class progress reporting
      const updateResult = await connection.tooling.sobject('TraceFlag').update({
        Id: existingTraceFlagId,
        DebugLevelId: debugLevelId,
        StartDate: startDate,
        ExpirationDate: expirationDate,
      });

      if (!updateResult.success) {
        failures.push({
          class: classRecord.Name,
          action: 'update',
          error: updateResult.errors.map((e) => e.message).join(', '),
        });
        continue;
      }

      results.push({ class: classRecord.Name, classId: classRecord.Id, traceFlagId: existingTraceFlagId });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- trace flags are written sequentially, matching the CLI's per-class progress reporting
    const createResult = await connection.tooling.sobject('TraceFlag').create({
      StartDate: startDate,
      ExpirationDate: expirationDate,
      DebugLevelId: debugLevelId,
      TracedEntityId: classRecord.Id,
      LogType: 'CLASS_TRACING',
    });

    if (!createResult.success) {
      failures.push({
        class: classRecord.Name,
        action: 'create',
        error: createResult.errors.map((e) => e.message).join(', '),
      });
      continue;
    }

    results.push({ class: classRecord.Name, classId: classRecord.Id, traceFlagId: createResult.id });
  }

  return { results, missingClassNames, failures };
}
