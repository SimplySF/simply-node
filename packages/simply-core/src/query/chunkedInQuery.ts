/*
 * Copyright (c) 2026, SimplySF.
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

import { Connection } from '@salesforce/core';
import { chunk } from '../collection/chunk.js';
import { escapeSoqlLiteral } from './escapeSoqlLiteral.js';

export type ChunkedInQueryOptions = {
  /**
   * How many values to put in each `IN (...)` clause. Pick this per query: SOQL has a 100,000
   * character statement limit, so a query selecting many fields, or filtering on long API names,
   * needs a smaller chunk than one filtering on 15-character IDs.
   */
  chunkSize: number;
  /** Run against the Tooling API instead of the standard one. Defaults to `false`. */
  tooling?: boolean;
  /**
   * Swallow a chunk's query failure and carry on with the remaining chunks, rather than
   * rejecting. Use for queries that are expected to fail on some orgs — `Package2Member` isn't
   * available at all in orgs that have never had a 2GP package, and a caller that only wants
   * package attribution as an enrichment shouldn't fail the whole command over it.
   * Defaults to `false`.
   */
  tolerateFailure?: boolean;
};

/**
 * Run a SOQL query once per chunk of `values`, splicing each chunk into a quoted, comma-joined
 * `IN (...)` clause, and return every record from every chunk.
 *
 * SOQL statements are length-limited, so any query filtering on a caller-supplied list has to be
 * split. That splitting — chunk, quote, join, query, accumulate — is the same everywhere; only
 * the query text and the chunk size differ.
 *
 * @param connection - The org connection to query against.
 * @param values - The values to filter on. Quoted and escaped for you; pass them raw.
 * @param buildSoql - Builds the query for one chunk, given the ready-to-use `IN` clause body
 * (e.g. ``(clause) => `SELECT Id FROM Account WHERE Name IN (${clause})` ``).
 * @param options - Chunk size, and whether to use the Tooling API or tolerate failures.
 * @returns Every record returned across all chunks, in chunk order. Empty if `values` is empty.
 */
export async function chunkedInQuery<T>(
  connection: Connection,
  values: readonly string[],
  buildSoql: (inClause: string) => string,
  options: ChunkedInQueryOptions,
): Promise<T[]> {
  const records: T[] = [];

  for (const valueChunk of chunk(values, options.chunkSize)) {
    const inClause = valueChunk.map((value) => `'${escapeSoqlLiteral(value)}'`).join(',');

    try {
      // eslint-disable-next-line no-await-in-loop -- chunks must run in sequence to stay within org query limits
      const result = await connection.autoFetchQuery(buildSoql(inClause), { tooling: options.tooling });
      records.push(...(result.records as unknown as T[]));
    } catch (error) {
      if (!options.tolerateFailure) {
        throw error;
      }
    }
  }

  return records;
}
