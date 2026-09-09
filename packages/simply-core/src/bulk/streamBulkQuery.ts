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

import fs from 'node:fs';
import { Readable, Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { QueryJobV2, type QueryJobInfoV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import { Connection, SfError } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { fetch } from 'undici';

export type StreamBulkQueryOptions = {
  /** Query all records, including archived/deleted ones. Defaults to `false`. */
  scanAll?: boolean;
  /** How often to poll the query job for completion, in milliseconds. Defaults to 5 seconds. */
  pollInterval?: number;
  /** How long to wait for the query job to complete before giving up, in milliseconds. Defaults to 30 minutes. */
  pollTimeout?: number;
};

/** @deprecated Use {@link StreamBulkQueryOptions} instead. */
export type StreamBulkQueryToFileOptions = StreamBulkQueryOptions;

export type StreamBulkQueryResult = {
  jobId: string;
  numberRecordsProcessed: number;
  /**
   * The merged CSV result stream, spanning every result page with duplicate header rows
   * stripped. Consume it directly (e.g. pipe it through a CSV parser) or pass it to
   * `stream.pipeline()`/`fs.createWriteStream()` yourself. See {@link streamBulkQueryToFile}
   * for a ready-made "write straight to a file" convenience wrapper.
   */
  stream: Readable;
};

export type StreamBulkQueryToFileResult = {
  jobId: string;
  numberRecordsProcessed: number;
};

/**
 * Transform stream that strips the first line (the CSV header row) from a chunked stream of
 * Buffers, without ever converting the buffered data to a string.
 *
 * Bulk API v2 query results are paginated; every page after the first repeats the header row,
 * so this is used to de-duplicate headers when appending subsequent pages to the same file.
 */
export class SkipFirstLineTransform extends Transform {
  /** Whether the header row has already been located and stripped. */
  private firstLineSkipped = false;
  /** Bytes buffered so far while still searching for the header row's terminating newline. */
  private buffer: Buffer = Buffer.alloc(0);

  /**
   * Buffers incoming chunks until the first newline is found (stripping everything up to and
   * including it), then passes all subsequent chunks through unchanged.
   *
   * @param chunk - The next chunk of raw CSV bytes.
   * @param _encoding - Unused; chunks are handled as raw `Buffer`s regardless of encoding.
   * @param callback - Node stream callback; invoked with the chunk to emit (or no chunk while
   * still buffering for the header's newline).
   */
  public _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (this.firstLineSkipped) {
      callback(null, chunk);
      return;
    }

    this.buffer = Buffer.concat([this.buffer, chunk]);

    const newlineIndex = this.buffer.indexOf(0x0a);

    if (newlineIndex === -1) {
      callback();
      return;
    }

    const remainingData = this.buffer.subarray(newlineIndex + 1);
    this.firstLineSkipped = true;
    this.buffer = Buffer.alloc(0);

    callback(null, remainingData);
  }

  /**
   * Releases the internal buffer at end-of-stream. Any bytes still buffered at this point
   * belong to a header row with no trailing newline, so they're discarded rather than emitted.
   *
   * @param callback - Node stream callback; invoked once cleanup is complete.
   */
  public _flush(callback: TransformCallback): void {
    this.buffer = Buffer.alloc(0);
    callback();
  }
}

/**
 * Fetch one page of Bulk API v2 query results as a raw, unbuffered stream.
 *
 * This bypasses jsforce's own HTTP transport on purpose: jsforce's `Transport.httpRequest()`
 * resolves its request promise on the underlying `request` library's `'complete'` event, which
 * only fires once the *entire* response body has been buffered into memory. That defeats
 * streaming for large result sets. Using `undici`'s `fetch()` directly and converting the Fetch
 * API response body to a Node `Readable` avoids that buffering entirely.
 *
 * @param conn - The org connection to fetch the page with; used for URL normalization and auth.
 * @param path - The Bulk API v2 results path (or locator-qualified continuation path) to fetch.
 * @returns The page's raw CSV byte stream, plus the locator for the next page if one exists.
 * @throws {SfError} If the HTTP response isn't OK, or has no body.
 */
async function fetchResultPage(conn: Connection, path: string): Promise<{ stream: Readable; locator?: string }> {
  const url = conn.normalizeUrl(path);

  await conn.refreshAuth();

  const headers: Record<string, string> = { 'content-Type': 'text/csv' };
  if (conn.accessToken) {
    headers.Authorization = `Bearer ${conn.accessToken}`;
  }

  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    throw new SfError(
      `Failed to fetch bulk query results: HTTP ${response.status} ${response.statusText}`,
      'BulkQueryResultFetchError',
    );
  }

  if (!response.body) {
    throw new SfError('No response body was returned while fetching bulk query results.', 'BulkQueryResultFetchError');
  }

  return {
    stream: Readable.fromWeb(response.body),
    locator: response.headers.get('sforce-locator') ?? undefined,
  };
}

/**
 * Lazily walk every Bulk API v2 result page for a job, yielding raw CSV bytes. Header rows on
 * pages after the first are stripped so the combined output reads as a single well-formed CSV.
 *
 * Pages can't be fetched in parallel: each page's locator (needed to request the next one) only
 * arrives in that page's response headers.
 *
 * @param conn - The org connection to fetch pages with.
 * @param resultsPath - The Bulk API v2 job results path, e.g. `/jobs/query/{jobId}/results`.
 * @yields Raw CSV byte chunks, in order, with duplicate header rows already stripped.
 */
async function* iterateResultChunks(conn: Connection, resultsPath: string): AsyncGenerator<Buffer> {
  let locator: string | undefined;
  let firstPage = true;

  while (locator !== 'null') {
    const page = await fetchResultPage(conn, locator ? `${resultsPath}?locator=${locator}` : resultsPath); // eslint-disable-line no-await-in-loop
    const source: AsyncIterable<Buffer> = firstPage ? page.stream : page.stream.pipe(new SkipFirstLineTransform());

    // eslint-disable-next-line no-await-in-loop
    for await (const chunk of source) {
      yield chunk;
    }

    firstPage = false;
    locator = page.locator ?? 'null';
  }
}

/**
 * Run a SOQL query through Bulk API v2 and return the merged CSV results as a single stream.
 *
 * Unlike `Connection.bulk2.query()`, which routes result pages through jsforce's HTTP transport
 * (buffering each page fully into memory before it can be consumed), this fetches each page's
 * HTTP response directly and exposes it as one continuous, backpressure-respecting `Readable`,
 * so memory usage stays flat regardless of result set size. Pages are fetched lazily, one at a
 * time, only as the returned stream is consumed.
 *
 * @param conn - The org connection to run the query on.
 * @param soql - The SOQL query to run.
 * @param options - Optional job/polling behavior overrides.
 * @returns The job ID, record count, and a merged CSV stream of the results.
 * @throws {SfError} If the query job doesn't report completion after polling.
 */
export async function streamBulkQuery(
  conn: Connection,
  soql: string,
  options: StreamBulkQueryOptions = {},
): Promise<StreamBulkQueryResult> {
  const queryJob = new QueryJobV2(conn, {
    bodyParams: {
      query: soql,
      operation: options.scanAll ? 'queryAll' : 'query',
    },
    pollingOptions: {
      pollInterval: options.pollInterval ?? 5000,
      pollTimeout: options.pollTimeout ?? Duration.minutes(30).milliseconds,
    },
  });

  let jobInfo: QueryJobInfoV2 | undefined;
  queryJob.on('jobComplete', (completedJob: QueryJobInfoV2) => {
    jobInfo = completedJob;
  });

  await queryJob.open();
  await queryJob.poll();

  if (!jobInfo) {
    throw new SfError('Bulk query job did not report completion after polling.', 'BulkQueryJobIncompleteError');
  }

  const resultsPath = `/jobs/query/${jobInfo.id}/results`;

  return {
    jobId: jobInfo.id,
    numberRecordsProcessed: jobInfo.numberRecordsProcessed,
    stream: Readable.from(iterateResultChunks(conn, resultsPath)),
  };
}

/**
 * Run a SOQL query through Bulk API v2 and stream the CSV results directly to a file.
 *
 * A thin convenience wrapper around {@link streamBulkQuery} for the common "just write it to
 * disk" case. Use {@link streamBulkQuery} directly if you want to consume or transform the
 * results without touching the filesystem (e.g. piping through a CSV parser).
 *
 * @param conn - The org connection to run the query on.
 * @param soql - The SOQL query to run.
 * @param outputPath - The filesystem path to write the merged CSV results to.
 * @param options - Optional job/polling behavior overrides.
 * @returns The job ID and record count.
 */
export async function streamBulkQueryToFile(
  conn: Connection,
  soql: string,
  outputPath: string,
  options: StreamBulkQueryOptions = {},
): Promise<StreamBulkQueryToFileResult> {
  const { jobId, numberRecordsProcessed, stream } = await streamBulkQuery(conn, soql, options);

  await pipeline(stream, fs.createWriteStream(outputPath));

  return { jobId, numberRecordsProcessed };
}
