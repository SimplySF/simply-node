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

import { Connection, SfError } from '@salesforce/core';

/** Where the remaining-allocation figure came from. */
export type ApiBudgetSource = 'header' | 'limits-api';

/** Outcome of an API budget check. */
export type ApiBudgetResult = {
  /**
   * `ok` — the run fits. `exceeded` — it does not. `unavailable` — the org's remaining allocation
   * could not be read, so no judgement was made.
   */
  status: 'ok' | 'exceeded' | 'unavailable';
  /** How many requests the run is expected to make, including the check's own if it made one. */
  plannedRequests: number;
  /** Requests the org has left today. Absent when `status` is `unavailable`. */
  remaining?: number;
  /** The org's daily maximum. Absent when `status` is `unavailable`. */
  limit?: number;
  /** `maxUsagePercent` of `remaining`, rounded down. Absent when `status` is `unavailable`. */
  budget?: number;
  /** Absent when `status` is `unavailable`. */
  source?: ApiBudgetSource;
  /** Why the allocation could not be read. Only set when `status` is `unavailable`. */
  reason?: string;
};

export type CheckApiBudgetOptions = {
  /** Maximum percentage of the org's *remaining* requests this run may consume. 1–100. */
  maxUsagePercent: number;
};

/** The `/limits` key holding the daily REST/SOAP API allocation. */
const DAILY_API_REQUESTS = 'DailyApiRequests';

/**
 * Read the org's remaining API allocation, preferring the free source.
 *
 * Salesforce returns `Sforce-Limit-Info: api-usage=used/limit` on every REST response, and jsforce
 * parses it into `connection.limitInfo`. That costs nothing, needs no extra permission, and is
 * exact as of the last request — so it is always preferred when a request has already been made.
 *
 * `/limits` is the fallback. It costs a request, requires "View Setup and Configuration", and
 * Salesforce documents it as accurate only within five minutes.
 *
 * @param connection - The org connection.
 * @returns The reading, plus how many requests obtaining it cost.
 */
async function readRemaining(
  connection: Connection,
): Promise<{ remaining: number; limit: number; source: ApiBudgetSource; cost: number } | { reason: string }> {
  const apiUsage = connection.limitInfo?.apiUsage;
  if (apiUsage) {
    return {
      remaining: Math.max(0, apiUsage.limit - apiUsage.used),
      limit: apiUsage.limit,
      source: 'header',
      cost: 0,
    };
  }

  try {
    const limits = await connection.limits();
    const daily = limits[DAILY_API_REQUESTS];

    if (!daily) {
      return { reason: `The org's limits response did not include ${DAILY_API_REQUESTS}.` };
    }

    // `Remaining` is reported after this call was counted, so it must not be decremented again —
    // but the call still has to be paid for out of the budget, hence `cost: 1`.
    return { remaining: daily.Remaining, limit: daily.Max, source: 'limits-api', cost: 1 };
  } catch (error) {
    return { reason: (error as Error).message };
  }
}

/**
 * Work out whether a run fits inside a share of the org's remaining API requests.
 *
 * The budget is a percentage of what the org has *left*, not of its daily maximum: an org that has
 * already burned most of its allocation should get a proportionally smaller budget, which is the
 * point of checking at all.
 *
 * Every Salesforce API call counts toward the daily allocation, including the `/limits` call this
 * may make to answer the question. When that fallback is used its own request is added to
 * `plannedRequests` so the accounting stays honest.
 *
 * This never throws for an unreadable allocation. Reading `/limits` requires a permission the
 * calling command does not otherwise need, and an advisory check must not turn that into a hard
 * requirement — callers get `status: 'unavailable'` and decide what to do.
 *
 * @param connection - The org connection.
 * @param plannedRequests - How many API requests the run is about to make.
 * @param options - The budget configuration.
 * @returns The check result. Callers decide whether `exceeded` is fatal.
 */
export async function checkApiBudget(
  connection: Connection,
  plannedRequests: number,
  options: CheckApiBudgetOptions,
): Promise<ApiBudgetResult> {
  const reading = await readRemaining(connection);

  if ('reason' in reading) {
    return { status: 'unavailable', plannedRequests, reason: reading.reason };
  }

  const { remaining, limit, source, cost } = reading;
  const totalPlanned = plannedRequests + cost;
  const budget = Math.floor((remaining * options.maxUsagePercent) / 100);

  return {
    status: totalPlanned > budget || totalPlanned > remaining ? 'exceeded' : 'ok',
    plannedRequests: totalPlanned,
    remaining,
    limit,
    budget,
    source,
  };
}

/**
 * Build the error thrown when a run does not fit its budget.
 *
 * The numbers matter more than the prose — what the operator does next depends on how far over
 * they are — so all four are named.
 *
 * @param result - An `exceeded` result.
 * @param maxUsagePercent - The percentage that was applied, for the remediation hint.
 * @returns The error to throw.
 */
export function apiBudgetError(result: ApiBudgetResult, maxUsagePercent: number): SfError {
  const planned = result.plannedRequests.toLocaleString();
  const remaining = (result.remaining ?? 0).toLocaleString();
  const limit = (result.limit ?? 0).toLocaleString();
  const budget = (result.budget ?? 0).toLocaleString();

  const detail =
    result.plannedRequests > (result.remaining ?? 0)
      ? `only ${remaining} of the org's ${limit} daily requests remain`
      : `only ${budget} of the org's ${remaining} remaining requests are budgeted (--max-api-usage ${maxUsagePercent})`;

  return new SfError(
    `This run needs ${planned} API requests but ${detail}. ` +
      'Raise --max-api-usage, split the input, or wait for the daily limit to reset.',
    'ApiBudgetExceededError',
  );
}
