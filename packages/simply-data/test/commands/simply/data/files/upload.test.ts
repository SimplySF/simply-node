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
import { parse } from 'csv-parse/sync';
import { Connection, SfError } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import sinon from 'sinon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import DataFilesUpload from '../../../../../src/commands/simply/data/files/upload.js';
import { ContentVersionToUpload } from '../../../../../src/common/contentVersionTypes.js';

describe('simply data files upload', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeEach(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
    fs.rmSync('upload', { recursive: true, force: true });
  });

  it('should error without required --target-org flag', async () => {
    try {
      await DataFilesUpload.run();
      expect.fail('should have thrown NoDefaultEnvError');
    } catch (err) {
      const error = err as SfError;
      expect(error.name).to.equal('NoDefaultEnvError');
      expect(error.message).to.include('Use -o or --target-org to specify an environment.');
    }
  });

  it('should refuse to start, and make no request, when the csv exceeds the API budget', async () => {
    const fetchStub = $$.SANDBOX.stub(globalThis, 'fetch');

    // The fixture csv has 3 rows, so the run costs 6 requests. A budget of 20% of 10 is 2.
    $$.SANDBOX.stub(Connection.prototype, 'limits').resolves({
      DailyApiRequests: { Max: 15_000, Remaining: 10 },
    });

    try {
      await DataFilesUpload.run([
        '--file-path',
        './test/reference-project/test-files/simply.data.files.upload.csv',
        '--target-org',
        testOrg.username,
      ]);
      expect.fail('should have thrown ApiBudgetExceededError');
    } catch (err) {
      expect((err as SfError).name).to.equal('ApiBudgetExceededError');
    }

    expect(fetchStub.called).to.equal(false);
    // No partial output either.
    expect(fs.existsSync('upload/success.csv')).to.equal(false);
  });

  it('should write results to csv', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'limits').resolves({
      DailyApiRequests: { Max: 15_000, Remaining: 15_000 },
    });

    // A fresh Response per call: a Response body can only be consumed once, and the
    // files command uploads more than one file.
    $$.SANDBOX.stub(globalThis, 'fetch').callsFake(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: '123', success: true }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    $$.SANDBOX.stub(Connection.prototype, 'singleRecordQuery').resolves({
      Id: '123',
      ContentDocumentId: '123',
      FileExtension: '.json',
      Title: 'coolFile',
    });

    await DataFilesUpload.run([
      '--file-path',
      './test/reference-project/test-files/simply.data.files.upload.csv',
      '--target-org',
      testOrg.username,
    ]);

    const errorResults = parse<ContentVersionToUpload>(fs.readFileSync('upload/error.csv'), {
      bom: true,
      columns: true,
    });
    const successResults = parse<ContentVersionToUpload>(fs.readFileSync('upload/success.csv'), {
      bom: true,
      columns: true,
    });

    expect(errorResults[0].Error).to.contain('Error: ENOENT: no such file or directory');
    expect(successResults).to.deep.equal([
      {
        ContentDocumentId: '123',
        FirstPublishLocationId: '',
        PathOnClient: 'test/reference-project/test-files/basicTextFile.txt',
        Title: 'Basic Text File',
      },
      {
        ContentDocumentId: '123',
        FirstPublishLocationId: '',
        PathOnClient: 'test/reference-project/test-files/watchDoge.jpg',
        Title: 'Watch Doges',
      },
    ]);
  });
});
