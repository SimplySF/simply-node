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
import { escapeSoqlLiteral } from '@simplysf/simply-core';

/** DeveloperName used for the FINEST/FINER debug level created for the Apex Replay Debugger. */
const DEBUG_LEVEL_NAME = 'ReplayDebuggerLevels';
/** How long a configured trace flag stays active before expiring, in milliseconds (24 hours). */
const TRACE_DURATION_MS = 24 * 60 * 60 * 1000;
/** Matches the ISO 8601 date-time format `--start-date`/`--end-date` require. */
export const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
/**
 * Matches `Field:Value` for `--on-behalf-of`. The field name is restricted to safe SOQL identifier
 * characters since, unlike the value, it can't be quoted/escaped in the query.
 */
export const ON_BEHALF_OF_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*):(.+)$/;

/** A `Field:Value` pair identifying the user to configure the trace flag for. */
export type OnBehalfOf = { field: string; value: string };

/** @returns `input` parsed as a `Field:Value` pair, or `undefined` if it doesn't match `ON_BEHALF_OF_PATTERN`. */
export function parseOnBehalfOf(input: string): OnBehalfOf | undefined {
  const match = ON_BEHALF_OF_PATTERN.exec(input);
  if (!match) {
    return undefined;
  }
  const [, field, value] = match;
  return { field, value };
}

export type ApexTraceSetupOptions = {
  /** Field:Value pair identifying the target user. Defaults to the connection's own username. */
  onBehalfOf?: OnBehalfOf;
  /** DebugLevel DeveloperName to use. Defaults to (and, if absent, creates) `ReplayDebuggerLevels`. */
  logLevel?: string;
  /** ISO 8601 date-time. Defaults to now. */
  startDate?: string;
  /** ISO 8601 date-time. Defaults to 24 hours after `startDate`. */
  endDate?: string;
};

/** IDs of the debug level and trace flag configured for the target user, and when it expires. */
export type ApexTraceSetupResult = {
  userId: string;
  debugLevelId: string;
  traceFlagId: string;
  expirationDate: string;
};

/** The error conditions `setupApexTrace` signals structurally (via `code`) rather than by message text, so a `Messages`-based caller (the CLI) can map each one to its own error key without string-matching. */
export type ApexTraceSetupErrorCode =
  | 'user-not-found'
  | 'ambiguous-on-behalf-of'
  | 'debug-level-not-found'
  | 'debug-level-create-failed'
  | 'trace-flag-create-failed'
  | 'invalid-date-range';

export class ApexTraceSetupError extends Error {
  public readonly code: ApexTraceSetupErrorCode;
  /** The raw values a `Messages`-based caller needs to reproduce its own error text (e.g. `[userIdentifier]`, `[expirationDate, startDate]`) — not necessarily the same as `message`, which is this error's own human-readable text. */
  public readonly args: string[];

  public constructor(code: ApexTraceSetupErrorCode, message: string, args: string[] = [message]) {
    super(message);
    this.name = 'ApexTraceSetupError';
    this.code = code;
    this.args = args;
  }
}

/** @returns The Id of the single user matching `onBehalfOf` (or `connection`'s own username if `onBehalfOf` is absent). @throws {ApexTraceSetupError} `user-not-found`/`ambiguous-on-behalf-of`. */
async function findTraceTargetUserId(connection: Connection, onBehalfOf: OnBehalfOf | undefined): Promise<string> {
  const userFilterField = onBehalfOf?.field ?? 'Username';
  const userFilterValue = onBehalfOf?.value ?? connection.getUsername() ?? '';
  const userIdentifier = onBehalfOf ? `${onBehalfOf.field}:${onBehalfOf.value}` : userFilterValue;

  const userQueryResult = await connection.query<{ Id: string }>(
    `SELECT Id FROM User WHERE ${userFilterField} = '${escapeSoqlLiteral(userFilterValue)}' LIMIT 2`,
  );

  if (userQueryResult.records.length === 0) {
    throw new ApexTraceSetupError('user-not-found', `No user found matching "${userIdentifier}".`, [userIdentifier]);
  }

  if (userQueryResult.records.length > 1) {
    throw new ApexTraceSetupError('ambiguous-on-behalf-of', `More than one user matches "${userIdentifier}".`, [
      userIdentifier,
    ]);
  }

  return userQueryResult.records[0].Id;
}

/** @returns The Id of `requestedLogLevel` if given (must already exist), or the shared `ReplayDebuggerLevels` debug level's Id (created if absent). @throws {ApexTraceSetupError} `debug-level-not-found`/`debug-level-create-failed`. */
async function findOrCreateDebugLevel(connection: Connection, requestedLogLevel: string | undefined): Promise<string> {
  const debugLevelName = requestedLogLevel ?? DEBUG_LEVEL_NAME;

  const debugLevelResult = await connection.tooling.query<{ Id: string }>(
    `SELECT Id FROM DebugLevel WHERE DeveloperName = '${debugLevelName}'`,
  );

  if (debugLevelResult.records.length > 0) {
    return debugLevelResult.records[0].Id;
  }

  if (requestedLogLevel) {
    throw new ApexTraceSetupError('debug-level-not-found', `No DebugLevel named "${debugLevelName}" was found.`, [
      debugLevelName,
    ]);
  }

  const createResult = await connection.tooling.sobject('DebugLevel').create({
    DeveloperName: DEBUG_LEVEL_NAME,
    MasterLabel: DEBUG_LEVEL_NAME,
    ApexCode: 'FINEST',
    Visualforce: 'FINER',
  });

  if (!createResult.success) {
    throw new ApexTraceSetupError('debug-level-create-failed', createResult.errors.map((e) => e.message).join(', '));
  }

  return createResult.id;
}

/** @returns The Id and expiration date of the DEVELOPER_LOG trace flag created/updated for `userId`. @throws {ApexTraceSetupError} `invalid-date-range`/`trace-flag-create-failed`. */
async function findOrUpdateTraceFlag(
  connection: Connection,
  userId: string,
  debugLevelId: string,
  options: Pick<ApexTraceSetupOptions, 'startDate' | 'endDate'>,
): Promise<{ traceFlagId: string; expirationDate: string }> {
  const traceFlagResult = await connection.tooling.query<{ Id: string }>(
    `SELECT Id FROM TraceFlag WHERE LogType = 'DEVELOPER_LOG' AND TracedEntityId = '${userId}'`,
  );

  const startDate = options.startDate ?? new Date().toISOString();
  const expirationDate = options.endDate ?? new Date(new Date(startDate).getTime() + TRACE_DURATION_MS).toISOString();

  if (new Date(expirationDate).getTime() <= new Date(startDate).getTime()) {
    throw new ApexTraceSetupError(
      'invalid-date-range',
      `The end date (${expirationDate}) must be after the start date (${startDate}).`,
      [expirationDate, startDate],
    );
  }

  if (traceFlagResult.records.length > 0) {
    const traceFlagId = traceFlagResult.records[0].Id;
    await connection.tooling.sobject('TraceFlag').update({
      Id: traceFlagId,
      DebugLevelId: debugLevelId,
      StartDate: startDate,
      ExpirationDate: expirationDate,
    });
    return { traceFlagId, expirationDate };
  }

  const createResult = await connection.tooling.sobject('TraceFlag').create({
    TracedEntityId: userId,
    LogType: 'DEVELOPER_LOG',
    DebugLevelId: debugLevelId,
    StartDate: startDate,
    ExpirationDate: expirationDate,
  });

  if (!createResult.success) {
    throw new ApexTraceSetupError('trace-flag-create-failed', createResult.errors.map((e) => e.message).join(', '));
  }

  return { traceFlagId: createResult.id, expirationDate };
}

/**
 * Creates or updates a DEVELOPER_LOG trace flag for a target user. The target user is the one
 * `connection` authenticates as by default, or the user identified by `options.onBehalfOf` if
 * given. By default the trace flag uses the FINEST/FINER `ReplayDebuggerLevels` debug level
 * suitable for the Apex Replay Debugger and runs for 24 hours starting now;
 * `options.logLevel`/`startDate`/`endDate` override those defaults.
 *
 * @param connection - The org connection to configure the trace flag in.
 * @param options - See `ApexTraceSetupOptions`.
 * @param onPhase - Called as each of the three phases (finding the user, checking the debug
 * level, configuring the trace flag) starts — a caller (the CLI) can use this to update a
 * spinner. Optional; has no effect on the operation itself.
 * @returns The IDs of the debug level and trace flag that were created or updated, and the trace
 * flag's new expiration date.
 * @throws {ApexTraceSetupError} See `ApexTraceSetupErrorCode`.
 */
export async function setupApexTrace(
  connection: Connection,
  options: ApexTraceSetupOptions = {},
  onPhase?: (phase: 'finding-user' | 'checking-debug-level' | 'configuring-trace-flag') => void,
): Promise<ApexTraceSetupResult> {
  onPhase?.('finding-user');
  const userId = await findTraceTargetUserId(connection, options.onBehalfOf);

  onPhase?.('checking-debug-level');
  const debugLevelId = await findOrCreateDebugLevel(connection, options.logLevel);

  onPhase?.('configuring-trace-flag');
  const { traceFlagId, expirationDate } = await findOrUpdateTraceFlag(connection, userId, debugLevelId, options);

  return { userId, debugLevelId, traceFlagId, expirationDate };
}
