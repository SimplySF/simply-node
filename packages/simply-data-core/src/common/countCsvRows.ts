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

import fs from 'node:fs';
import { parse } from 'csv-parse';

/**
 * Count the data rows in a CSV, excluding its header.
 *
 * Parses rather than counting newlines: a quoted field may contain line breaks, so `\n` counting
 * over-reports and would budget for uploads that never happen. The parser options match the ones
 * the upload itself uses, so the count and the work cannot disagree.
 *
 * This reads the file a second time rather than buffering the parsed rows. The trade is a cheap
 * sequential local read against unbounded memory on exactly the large inputs where checking the
 * budget matters most.
 *
 * @param filePath - Path to the CSV.
 * @returns The number of data rows.
 */
export async function countCsvRows(filePath: string): Promise<number> {
  const parser = fs.createReadStream(filePath).pipe(parse({ bom: true, columns: true }));

  let rows = 0;
  for await (const record of parser) {
    // The record itself is not needed, only that the parser produced one.
    void record;
    rows++;
  }

  return rows;
}
