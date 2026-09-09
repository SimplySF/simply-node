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
import { Transform } from 'node:stream';
import { finished, pipeline } from 'node:stream/promises';
import { stringify, type Options as StringifyOptions } from 'csv-stringify';

// csv-stringify's default boolean cast writes "1"/"" (a spreadsheet-friendly convention), unlike
// the plain String(value) coercion most callers here previously got from `csv-writer`. Cast
// explicitly so writing a real boolean value still reads "true"/"false" in the output CSV.
const CAST_OPTIONS: Pick<StringifyOptions, 'cast'> = {
  cast: {
    boolean: (value) => (value ? 'true' : 'false'),
  },
};

export type CsvFileWriter = {
  /**
   * Write one record to the CSV file. Resolves once it's safe to write the next record —
   * immediately if the underlying stream's internal buffer has room, or after its `'drain'`
   * event if not. Safe to call from multiple concurrently-running async tasks: writes are
   * ordered by call order, not completion order, since `stream.write()` itself is synchronous.
   */
  write(record: Record<string, unknown>): Promise<void>;
  /** Finish writing and wait for the file to be fully flushed to disk. */
  end(): Promise<void>;
};

/**
 * Open a CSV file for streaming, record-at-a-time writes.
 *
 * Backed by a real `csv-stringify` -> `fs.createWriteStream()` pipeline instead of buffering
 * records in memory or re-opening the file per write, so writing many records keeps memory flat.
 * `write()` respects the underlying stream's backpressure, so callers get naturally throttled
 * instead of building an unbounded queue of pending writes.
 *
 * @param outputPath - The filesystem path to write the CSV file to.
 * @param columns - The column names to use for the header row and field ordering.
 * @returns A writer with `write()`/`end()` methods for streaming records to the file.
 */
export function createCsvFileWriter(outputPath: string, columns: string[]): CsvFileWriter {
  const stringifier = stringify({ header: true, columns, ...CAST_OPTIONS });
  const fileStream = fs.createWriteStream(outputPath);

  const donePromise = finished(fileStream);
  // finished() attaches its listeners immediately, so without this the promise could be reported
  // as an unhandled rejection if a write error occurs before end() ever awaits it.
  donePromise.catch(() => {});

  stringifier.pipe(fileStream);

  return {
    write: (record) =>
      new Promise((resolve, reject) => {
        const canWriteMore = stringifier.write(record, (err) => {
          if (err) {
            reject(err);
          }
        });

        if (canWriteMore) {
          resolve();
        } else {
          stringifier.once('drain', resolve);
        }
      }),
    end: async (): Promise<void> => {
      stringifier.end();
      await donePromise;
    },
  };
}

/**
 * Stream every record from an async iterable straight into a CSV file via a single
 * `stream.pipeline()` — source -> a counting pass-through -> `csv-stringify` -> the file. Use
 * this instead of {@link createCsvFileWriter} when every record from a source goes to the same
 * file unconditionally (e.g. dumping a query's results to disk); `pipeline()` wires up
 * backpressure and error/completion handling for you, so there's no manual write-loop or
 * write()/end() bookkeeping. For per-record branching (e.g. routing records to one of several
 * files based on some condition) or writes from concurrent producers, use
 * {@link createCsvFileWriter} directly instead.
 *
 * @param records - The records to write, consumed in order as they're yielded.
 * @param outputPath - The filesystem path to write the CSV file to.
 * @param columns - The column names to use for the header row and field ordering.
 * @returns The total number of records written.
 */
export async function writeRecordsToCsvFile(
  records: AsyncIterable<Record<string, unknown>>,
  outputPath: string,
  columns: string[],
): Promise<{ recordCount: number }> {
  let recordCount = 0;
  const countRecords = new Transform({
    objectMode: true,
    transform(record: Record<string, unknown>, _encoding, callback): void {
      recordCount++;
      callback(null, record);
    },
  });

  await pipeline(
    records,
    countRecords,
    stringify({ header: true, columns, ...CAST_OPTIONS }),
    fs.createWriteStream(outputPath),
  );

  return { recordCount };
}
