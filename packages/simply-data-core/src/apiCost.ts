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

/**
 * API requests consumed per file uploaded.
 *
 * **Two, not one.** Salesforce's create response returns only the new `ContentVersion` id, so
 * `uploadContentVersion` follows it with a query for `ContentDocumentId`. Both count toward the
 * org's daily allocation. Counting one per file here would under-budget every upload by half.
 */
export const REQUESTS_PER_UPLOAD = 2;

/** API requests consumed per file downloaded — a single GET of the `VersionData` blob. */
export const REQUESTS_PER_DOWNLOAD = 1;

/**
 * Records jsforce returns per query round trip before it has to fetch another batch.
 *
 * Used to estimate how many requests a record query costs on top of the per-file work.
 */
export const QUERY_BATCH_SIZE = 2000;

/**
 * Estimate the API requests a record query costs, including its `queryMore` round trips.
 *
 * @param recordCount - How many records the query returns.
 * @returns The number of requests, at least 1.
 */
export function requestsForQuery(recordCount: number): number {
  return Math.max(1, Math.ceil(recordCount / QUERY_BATCH_SIZE));
}
