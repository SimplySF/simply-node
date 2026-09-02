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

import { SfError, type Connection, type StatusResult } from '@salesforce/core';

/** The `BackgroundOperation` fields this needs, out of the full standard-object schema. */
type BackgroundOperationRecord = {
  Id: string;
  Status: string | null;
  FinishedAt: string | null;
  Error: string | null;
};

/**
 * Builds a `PollingClient`-compatible `poll()` function for a community publish job.
 *
 * `BackgroundOperation.FinishedAt` (populated once the job reaches a terminal state) is used as
 * the completion signal rather than matching specific `Status` picklist values, since that's a
 * reliable signal regardless of exact status wording. `Error` (populated on failure) determines
 * success vs. failure once finished.
 *
 * @param connection - The org connection to poll against.
 * @param jobId - The `jobId` returned by `POST /connect/communities/{id}/publish`.
 * @returns A `poll()` function for `PollingClient.create({ poll, ... })`.
 * @throws {SfError} `CommunityPublishFailedError` if the job reaches a terminal failure state.
 */
export function checkPublishStatus(connection: Connection, jobId: string): () => Promise<StatusResult> {
  return async (): Promise<StatusResult> => {
    const result = await connection.query<BackgroundOperationRecord>(
      `SELECT Id, Status, FinishedAt, Error FROM BackgroundOperation WHERE Id = '${jobId}'`,
    );
    const operation = result.records[0] as BackgroundOperationRecord | undefined;

    // The BackgroundOperation record may not be queryable in the instant right after the publish
    // request is submitted — treat "not found yet" the same as "still running", not as a failure.
    if (!operation?.FinishedAt) {
      return { completed: false };
    }

    if (operation.Error) {
      throw new SfError(
        `Community publish failed (status: ${operation.Status ?? 'unknown'}): ${operation.Error}`,
        'CommunityPublishFailedError',
      );
    }

    return { completed: true, payload: { status: operation.Status } };
  };
}
