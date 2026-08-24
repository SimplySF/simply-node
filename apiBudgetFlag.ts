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
import { Flags } from '@salesforce/sf-plugins-core';
import { apiBudgetError, checkApiBudget, type ApiBudgetResult } from '@simplysf/simply-core';
import type { Connection } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-data', 'apiBudget');

/** Default share of the org's remaining API requests a single run may consume. */
export const DEFAULT_MAX_API_USAGE = 20;

/**
 * `--max-api-usage`, shared by every command that can count its requests in advance.
 *
 * Declared once so the three file commands cannot drift apart on the default or the bounds.
 */
export const apiBudgetFlags = {
  'max-api-usage': Flags.integer({
    summary: messages.getMessage('flags.max-api-usage.summary'),
    description: messages.getMessage('flags.max-api-usage.description'),
    default: DEFAULT_MAX_API_USAGE,
    min: 1,
    max: 100,
  }),
};

/**
 * Check a planned run against the org's remaining API allocation, and stop it if it does not fit.
 *
 * Call this before making any of the requests being counted — the value of the check is entirely
 * in nothing having happened when it fails.
 *
 * @param connection - The org connection.
 * @param plannedRequests - How many API requests the run is about to make.
 * @param maxUsagePercent - The `--max-api-usage` value.
 * @param warn - Called when the allocation could not be read, so the command can surface it.
 * @returns The check result, for inclusion in the command's JSON output.
 * @throws {SfError} If the run would exceed its budget.
 */
export async function assertApiBudget(
  connection: Connection,
  plannedRequests: number,
  maxUsagePercent: number,
  warn: (message: string) => void,
): Promise<ApiBudgetResult> {
  const result = await checkApiBudget(connection, plannedRequests, { maxUsagePercent });

  if (result.status === 'unavailable') {
    warn(messages.getMessage('warning.budgetUnavailable', [result.reason ?? 'unknown reason']));

    return result;
  }

  if (result.status === 'exceeded') {
    throw apiBudgetError(result, maxUsagePercent);
  }

  return result;
}
