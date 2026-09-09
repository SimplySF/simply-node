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
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createCsvFileWriter, writeRecordsToCsvFile } from '../../src/csv/createCsvFileWriter.js';

describe('createCsvFileWriter', () => {
  let outputPath: string;

  afterEach(() => {
    if (outputPath && fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { force: true });
    }
  });

  it('writes a header row followed by each written record, in call order', async () => {
    outputPath = path.join(os.tmpdir(), `simply-core-csv-writer-test-${Date.now()}.csv`);

    const writer = createCsvFileWriter(outputPath, ['Id', 'Name']);
    await writer.write({ Id: '001', Name: 'Foo' });
    await writer.write({ Id: '002', Name: 'Bar' });
    await writer.end();

    expect(fs.readFileSync(outputPath, 'utf-8')).to.equal('Id,Name\n001,Foo\n002,Bar\n');
  });

  it('writes an empty cell for a column missing from a record', async () => {
    outputPath = path.join(os.tmpdir(), `simply-core-csv-writer-test-${Date.now()}.csv`);

    const writer = createCsvFileWriter(outputPath, ['Id', 'Name', 'Error']);
    await writer.write({ Id: '001', Name: 'Foo' });
    await writer.end();

    expect(fs.readFileSync(outputPath, 'utf-8')).to.equal('Id,Name,Error\n001,Foo,\n');
  });

  it('preserves write order when writes are issued concurrently', async () => {
    outputPath = path.join(os.tmpdir(), `simply-core-csv-writer-test-${Date.now()}.csv`);

    const writer = createCsvFileWriter(outputPath, ['Id']);
    await Promise.all([writer.write({ Id: '001' }), writer.write({ Id: '002' }), writer.write({ Id: '003' })]);
    await writer.end();

    expect(fs.readFileSync(outputPath, 'utf-8')).to.equal('Id\n001\n002\n003\n');
  });

  it('produces only the header row when no records are written', async () => {
    outputPath = path.join(os.tmpdir(), `simply-core-csv-writer-test-${Date.now()}.csv`);

    const writer = createCsvFileWriter(outputPath, ['Id', 'Name']);
    await writer.end();

    expect(fs.readFileSync(outputPath, 'utf-8')).to.equal('Id,Name\n');
  });

  it('writes real boolean values as "true"/"false" rather than csv-stringify\'s "1"/"" default', async () => {
    outputPath = path.join(os.tmpdir(), `simply-core-csv-writer-test-${Date.now()}.csv`);

    const writer = createCsvFileWriter(outputPath, ['Id', 'IsLatest']);
    await writer.write({ Id: '001', IsLatest: true });
    await writer.write({ Id: '002', IsLatest: false });
    await writer.end();

    expect(fs.readFileSync(outputPath, 'utf-8')).to.equal('Id,IsLatest\n001,true\n002,false\n');
  });
});

describe('writeRecordsToCsvFile', () => {
  let outputPath: string;

  afterEach(() => {
    if (outputPath && fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { force: true });
    }
  });

  async function* records(): AsyncGenerator<Record<string, unknown>> {
    yield { Id: '001', Name: 'Foo' };
    yield { Id: '002', Name: 'Bar' };
  }

  it('streams every record from an async iterable to the file and reports the count', async () => {
    outputPath = path.join(os.tmpdir(), `simply-core-csv-pipeline-test-${Date.now()}.csv`);

    const result = await writeRecordsToCsvFile(records(), outputPath, ['Id', 'Name']);

    expect(result).to.deep.equal({ recordCount: 2 });
    expect(fs.readFileSync(outputPath, 'utf-8')).to.equal('Id,Name\n001,Foo\n002,Bar\n');
  });

  it('produces only the header row for an empty source', async () => {
    outputPath = path.join(os.tmpdir(), `simply-core-csv-pipeline-test-${Date.now()}.csv`);

    async function* empty(): AsyncGenerator<Record<string, unknown>> {}

    const result = await writeRecordsToCsvFile(empty(), outputPath, ['Id', 'Name']);

    expect(result).to.deep.equal({ recordCount: 0 });
    expect(fs.readFileSync(outputPath, 'utf-8')).to.equal('Id,Name\n');
  });

  it('rejects and stops writing when the source iterable throws', async () => {
    outputPath = path.join(os.tmpdir(), `simply-core-csv-pipeline-test-${Date.now()}.csv`);

    async function* failing(): AsyncGenerator<Record<string, unknown>> {
      yield { Id: '001' };
      throw new Error('boom');
    }

    await expect(writeRecordsToCsvFile(failing(), outputPath, ['Id'])).rejects.toThrow('boom');
  });
});
