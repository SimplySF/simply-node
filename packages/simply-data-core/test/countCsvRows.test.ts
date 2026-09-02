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
import os from 'node:os';
import path from 'node:path';
import { parse } from 'csv-parse';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { countCsvRows } from '../src/countCsvRows.js';

describe('countCsvRows', () => {
  let tmpDir: string;

  /**
   * @param contents - CSV text to write.
   * @returns The path it was written to.
   */
  function writeCsv(contents: string): string {
    const filePath = path.join(tmpDir, 'files.csv');
    fs.writeFileSync(filePath, contents);

    return filePath;
  }

  /**
   * Count rows the way the upload command actually consumes them.
   *
   * The count and the work must never disagree, so the assertion compares against a real streaming
   * pass rather than against a hand-written expected number.
   *
   * @param filePath - The CSV to stream.
   * @returns How many records the streaming pass yields.
   */
  async function streamedRowCount(filePath: string): Promise<number> {
    const parser = fs.createReadStream(filePath).pipe(parse({ bom: true, columns: true }));
    let rows = 0;
    for await (const record of parser) {
      void record;
      rows++;
    }

    return rows;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-csv-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should not count the header row', async () => {
    const filePath = writeCsv('Title,PathOnClient\na,a.txt\nb,b.txt\n');

    expect(await countCsvRows(filePath)).to.equal(2);
  });

  it('should return zero for a header-only file', async () => {
    expect(await countCsvRows(writeCsv('Title,PathOnClient\n'))).to.equal(0);
  });

  it('should not over-count a quoted field containing newlines', async () => {
    // Counting '\n' would report 4 rows here; only 2 records exist.
    const filePath = writeCsv('Title,PathOnClient\n"a\nmultiline\ntitle",a.txt\nb,b.txt\n');

    expect(await countCsvRows(filePath)).to.equal(2);
    expect(await countCsvRows(filePath)).to.equal(await streamedRowCount(filePath));
  });

  it('should tolerate a missing trailing newline', async () => {
    expect(await countCsvRows(writeCsv('Title,PathOnClient\na,a.txt'))).to.equal(1);
  });

  it('should skip a BOM without treating it as a row', async () => {
    expect(await countCsvRows(writeCsv('﻿Title,PathOnClient\na,a.txt\n'))).to.equal(1);
  });

  it('should return the same count when called twice', async () => {
    const filePath = writeCsv('Title,PathOnClient\na,a.txt\nb,b.txt\nc,c.txt\n');

    expect(await countCsvRows(filePath)).to.equal(await countCsvRows(filePath));
  });
});
