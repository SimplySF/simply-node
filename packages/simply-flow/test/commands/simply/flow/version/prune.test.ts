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
import { Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import sinon, { type SinonStub } from 'sinon';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import FlowVersionPrune from '../../../../../src/commands/simply/flow/version/prune.js';

describe('simply flow version prune', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();
  let tmpDir: string;

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-flow-version-prune-'));
    fs.writeFileSync(path.join(tmpDir, 'My_Flow.flow-meta.xml'), '<Flow/>');
  });

  afterEach(() => {
    $$.restore();
    fs.rmSync(tmpDir, { force: true, recursive: true });
    process.exitCode = undefined;
  });

  it('--dry-run lists candidates without deleting anything', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      records: [{ Id: '301000000000001AAA', Definition: { DeveloperName: 'My_Flow' } }],
      done: true,
      totalSize: 1,
    } as never);

    const result = await FlowVersionPrune.run(['--target-org', testOrg.username, '--source-dir', tmpDir, '--dry-run']);

    expect(result.dryRun).to.be.true;
    expect(result.candidates).to.deep.equal([{ id: '301000000000001AAA', developerName: 'My_Flow' }]);
    expect(result.deleted).to.deep.equal([]);
  });

  it('deletes every obsolete version found when not a dry run', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      records: [{ Id: '301000000000001AAA', Definition: { DeveloperName: 'My_Flow' } }],
      done: true,
      totalSize: 1,
    } as never);
    (Connection.prototype.request as unknown as SinonStub).callsFake(
      async (request: { method: string; url: string }) => {
        if (request.method === 'DELETE' && request.url.endsWith('/tooling/sobjects/Flow/301000000000001AAA')) {
          return { id: '301000000000001AAA', success: true, errors: [] };
        }
        throw new Error(`Unexpected request: ${request.method} ${request.url}`);
      },
    );

    const result = await FlowVersionPrune.run(['--target-org', testOrg.username, '--source-dir', tmpDir]);

    expect(result.dryRun).to.be.false;
    expect(result.deleted).to.deep.equal(['My_Flow']);
    expect(result.failures).to.deep.equal([]);
    expect(process.exitCode).to.equal(undefined);
  });
});
