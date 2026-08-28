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

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import sinon, { type SinonStub } from 'sinon';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import FlowDelete from '../../../../src/commands/simply/flow/delete.js';

const NO_FLOW_MANIFEST =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
  '  <types>\n    <members>My_Permission_Set</members>\n    <name>PermissionSet</name>\n  </types>\n' +
  '  <version>62.0</version>\n</Package>\n';

async function writeManifest(xml: string): Promise<string> {
  const filePath = path.join(
    os.tmpdir(),
    `simply-flow-delete-${Date.now()}-${Math.random().toString(36).slice(2)}.xml`,
  );
  await fs.writeFile(filePath, xml);
  return filePath;
}

describe('simply flow delete', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
    process.exitCode = undefined;
  });

  it('is a no-op when the manifest has no Flow members', async () => {
    const filePath = await writeManifest(NO_FLOW_MANIFEST);
    const autoFetchQuery = $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery');

    try {
      const result = await FlowDelete.run(['--manifest', filePath, '--target-org', testOrg.username]);

      expect(result).to.deep.equal({ deactivated: [], deleted: [], failures: [] });
      expect(autoFetchQuery.called).to.be.false;
    } finally {
      await fs.rm(filePath, { force: true });
    }
  });

  it('rejects --manifest combined with --flow-name', async () => {
    const filePath = await writeManifest(NO_FLOW_MANIFEST);

    try {
      await expect(
        FlowDelete.run(['--manifest', filePath, '--flow-name', 'My_Flow', '--target-org', testOrg.username]),
      ).rejects.toThrow();
    } finally {
      await fs.rm(filePath, { force: true });
    }
  });

  it('rejects when neither --manifest nor --flow-name is given', async () => {
    await expect(FlowDelete.run(['--target-org', testOrg.username])).rejects.toThrow();
  });

  it('records a deactivation failure but still deletes every version, for both flows', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').callsFake(async (soql: string) => {
      if (soql.startsWith('SELECT Definition.Id')) {
        return {
          records: [
            { Definition: { Id: '300000000000001AAA', DeveloperName: 'Flow_A' } },
            { Definition: { Id: '300000000000002AAA', DeveloperName: 'Flow_B' } },
          ],
          done: true,
          totalSize: 2,
        } as never;
      }
      if (soql.startsWith('SELECT Id, Definition.DeveloperName')) {
        return {
          records: [
            { Id: '301000000000001AAA', Definition: { DeveloperName: 'Flow_A' } },
            { Id: '301000000000002AAA', Definition: { DeveloperName: 'Flow_B' } },
          ],
          done: true,
          totalSize: 2,
        } as never;
      }
      throw new Error(`Unexpected query: ${soql}`);
    });

    (Connection.prototype.request as unknown as SinonStub).callsFake(
      async (request: { method: string; url: string }) => {
        const { method, url } = request;

        if (method === 'PATCH' && url.endsWith('/tooling/sobjects/FlowDefinition/300000000000001AAA')) {
          return { success: false, errors: [{ message: 'Cannot deactivate' }] };
        }
        if (method === 'PATCH' && url.endsWith('/tooling/sobjects/FlowDefinition/300000000000002AAA')) {
          return { id: '300000000000002AAA', success: true, errors: [] };
        }
        if (method === 'DELETE' && url.endsWith('/tooling/sobjects/Flow/301000000000001AAA')) {
          return { id: '301000000000001AAA', success: true, errors: [] };
        }
        if (method === 'DELETE' && url.endsWith('/tooling/sobjects/Flow/301000000000002AAA')) {
          return { id: '301000000000002AAA', success: true, errors: [] };
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      },
    );

    const result = await FlowDelete.run([
      '--flow-name',
      'Flow_A',
      '--flow-name',
      'Flow_B',
      '--target-org',
      testOrg.username,
    ]);

    expect(result.deactivated).to.deep.equal(['Flow_B']);
    expect(result.deleted).to.deep.equal(['Flow_A', 'Flow_B']);
    expect(result.failures).to.deep.equal([
      { developerName: 'Flow_A', stage: 'deactivate', message: 'Cannot deactivate' },
    ]);
    expect(process.exitCode).to.equal(1);
  });
});
