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
import { chunk } from '@simplysf/simply-core';

/** Outcome of deleting a single `ApexLog` record. */
export type ApexLogsPurgeResult = {
  Id: string;
  Success: boolean;
  Error?: string;
};

/**
 * Maximum number of `ApexLog` records to delete per SObject Collections call, which is the API's
 * own ceiling and matches jsforce's `MAX_DML_COUNT`.
 */
const CHUNK_SIZE = 200;

/** @returns Every `ApexLog` Id matched by `query` (a full SOQL statement), via the Tooling API, which returns them in a single response. */
export async function queryApexLogIdsViaRest(connection: Connection, query: string): Promise<string[]> {
  const queryResult = await connection.tooling.query<{ Id: string }>(query);
  return queryResult.records.map((record) => record.Id);
}

/**
 * @returns Every `ApexLog` Id matched by `query` (a full SOQL statement), via a Bulk API v2 query
 * job. The job streams CSV back, so the IDs are gathered from the record stream rather than a
 * single response body.
 */
export async function queryApexLogIdsViaBulkApi(
  connection: Connection,
  query: string,
  pollTimeout: number,
): Promise<string[]> {
  const recordStream = await connection.bulk2.query(query, { pollTimeout });
  const logIds: string[] = [];

  for await (const record of recordStream) {
    const { Id: id } = record as { Id?: string };
    if (id) {
      logIds.push(id);
    }
  }

  return logIds;
}

/**
 * Deletes `ApexLog` records through the core connection's SObject Collections resource, 200
 * records per call.
 *
 * Deliberately not `.tooling`: `ApexLog` is exposed on both APIs, but only core REST implements
 * the Collections resource a bulk delete needs. `/tooling/composite/sobjects` does not exist and
 * answers 404 "The requested resource does not exist".
 *
 * @param onChunkComplete - Called after each 200-record chunk is deleted, with the running total —
 * a caller (the CLI) can use this to update a progress indicator. Optional; has no effect on the
 * delete itself.
 */
export async function deleteApexLogsViaCollections(
  connection: Connection,
  logIds: string[],
  onChunkComplete?: (purged: number, total: number) => void,
): Promise<ApexLogsPurgeResult[]> {
  const results: ApexLogsPurgeResult[] = [];
  let purged = 0;

  for (const idChunk of chunk(logIds, CHUNK_SIZE)) {
    // eslint-disable-next-line no-await-in-loop -- batches are sequential so progress reporting tracks real progress
    const deleteResults = await connection.delete('ApexLog', idChunk);
    const deleteResultsArray = Array.isArray(deleteResults) ? deleteResults : [deleteResults];

    deleteResultsArray.forEach((deleteResult, index) => {
      results.push({
        Id: deleteResult.id ?? idChunk[index] ?? 'unknown',
        Success: deleteResult.success,
        Error: deleteResult.success ? undefined : deleteResult.errors.map((e) => e.message).join(', '),
      });
    });

    purged += idChunk.length;
    onChunkComplete?.(purged, logIds.length);
  }

  return results;
}

/**
 * Deletes `ApexLog` records through a Bulk API v2 ingest job. The whole set goes up as one job
 * rather than in 200-record chunks, and the org processes it asynchronously without spending REST
 * request limit.
 */
export async function deleteApexLogsViaBulkApi(
  connection: Connection,
  logIds: string[],
  pollTimeout: number,
): Promise<ApexLogsPurgeResult[]> {
  const { successfulResults, failedResults } = await connection.bulk2.loadAndWaitForResults({
    object: 'ApexLog',
    operation: 'delete',
    input: logIds.map((Id) => ({ Id })),
    pollTimeout,
  });

  return [
    ...successfulResults.map((result) => ({ Id: result.sf__Id, Success: true })),
    ...failedResults.map((result) => {
      // A failed row reports an empty (not absent) `sf__Id`; the submitted `Id` column is echoed
      // back alongside it, so prefer that to keep every failure traceable to a specific log.
      const submittedId = (result as { Id?: string }).Id;
      return {
        Id: result.sf__Id.length > 0 ? result.sf__Id : (submittedId ?? 'unknown'),
        Success: false,
        Error: result.sf__Error,
      };
    }),
  ];
}
