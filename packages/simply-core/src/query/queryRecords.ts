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

import { parse } from 'csv-parse';
import { Connection, SfError } from '@salesforce/core';
import { streamBulkQuery } from '../bulk/streamBulkQuery.js';

export type QueryRecordsOptions = {
  /** Query all records, including archived/deleted ones. Defaults to `false`. */
  scanAll?: boolean;
  /**
   * Row-count threshold at or under which the REST API is used instead of Bulk API v2.
   * Defaults to 2000.
   */
  bulkThreshold?: number;
  /** How often to poll a Bulk API v2 query job for completion, in milliseconds. Defaults to 5 seconds. */
  pollInterval?: number;
  /** How long to wait for a Bulk API v2 query job to complete, in milliseconds. Defaults to 30 minutes. */
  pollTimeout?: number;
};

const DEFAULT_BULK_THRESHOLD = 2000;

/**
 * Derive a `SELECT COUNT() ...` query from a SOQL query, for sizing it before deciding how to
 * run it. `SELECT COUNT()` doesn't accept a field list, ORDER BY, LIMIT, or OFFSET, so those are
 * stripped; the FROM object and WHERE clause (which determine cardinality) are kept as-is.
 *
 * @param soql - The SOQL query to derive a COUNT() query from.
 * @returns The equivalent `SELECT COUNT() FROM ...` query.
 * @throws {SfError} If the query has no `FROM` clause to anchor on.
 */
function toCountQuery(soql: string): string {
  const fromIndex = soql.search(/\bFROM\b/i);

  if (fromIndex === -1) {
    throw new SfError(`Unable to derive a COUNT() query from: ${soql}`, 'InvalidQueryError');
  }

  const fromClause = soql
    .slice(fromIndex)
    .replace(/\bORDER\s+BY\b[\s\S]*$/i, '')
    .replace(/\bLIMIT\s+\d+\b/i, '')
    .replace(/\bOFFSET\s+\d+\b/i, '')
    .trim();

  return `SELECT COUNT() ${fromClause}`;
}

/**
 * Flatten a REST query result record into the same shape Bulk API v2's CSV results use: parent
 * relationship fields (e.g. `Contact.Account.Name`) as dot-joined flat keys instead of nested
 * objects, every value stringified, and the `attributes` metadata property dropped.
 *
 * @param record - The REST query result record to flatten.
 * @param prefix - The dot-joined key prefix to prepend; used internally for recursive calls into
 * nested relationship objects. Callers should omit this.
 * @returns A flat record with dot-joined keys and stringified values.
 */
function flattenRestRecord(record: Record<string, unknown>, prefix = ''): Record<string, string> {
  const flat: Record<string, string> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === 'attributes') {
      continue;
    }

    const flatKey = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      flat[flatKey] = '';
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flat, flattenRestRecord(value as Record<string, unknown>, flatKey));
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint' ||
      Array.isArray(value)
    ) {
      flat[flatKey] = String(value);
    } else {
      flat[flatKey] = '';
    }
  }

  return flat;
}

/**
 * Run a SOQL query, automatically choosing the REST API or Bulk API v2 based on how many rows
 * it actually returns, and yield the results as a stream of flat, string-valued records
 * regardless of which one was used.
 *
 * Small queries pay real, fixed latency for a Bulk API v2 job (creation + polling), so this
 * first runs a cheap `SELECT COUNT()` version of the query. At or under `bulkThreshold`
 * (default 2000, matching the REST API's page size) it fetches the results via
 * `Connection#autoFetchQuery`; above that it streams them via {@link streamBulkQuery}, so memory
 * usage stays flat regardless of result set size.
 *
 * REST results are flattened to match Bulk's CSV shape (see {@link flattenRestRecord}) and every
 * field is stringified either way, so callers get one consistent record shape no matter which
 * path was taken. Not suitable for Tooling API queries — Bulk API v2 doesn't support them.
 *
 * @param conn - The org connection to run the query on.
 * @param soql - The SOQL query to run.
 * @param options - Optional thresholding/polling behavior overrides.
 * @yields Flat, string-valued records, in query result order.
 */
export async function* queryRecords(
  conn: Connection,
  soql: string,
  options: QueryRecordsOptions = {},
): AsyncGenerator<Record<string, string>> {
  const threshold = options.bulkThreshold ?? DEFAULT_BULK_THRESHOLD;

  const countResult = await conn.query(toCountQuery(soql), { scanAll: options.scanAll });

  if (countResult.totalSize <= threshold) {
    const result = await conn.autoFetchQuery(soql, { scanAll: options.scanAll });

    for (const record of result.records) {
      yield flattenRestRecord(record);
    }

    return;
  }

  const { stream } = await streamBulkQuery(conn, soql, options);

  for await (const record of stream.pipe(parse({ columns: true })) as AsyncIterable<Record<string, string>>) {
    yield record;
  }
}
