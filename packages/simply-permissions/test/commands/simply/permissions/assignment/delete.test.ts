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
import PermissionsAssignmentDelete from '../../../../../src/commands/simply/permissions/assignment/delete.js';

const BOTH_TYPES_MANIFEST =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
  '  <types>\n    <members>My_PS</members>\n    <name>PermissionSet</name>\n  </types>\n' +
  '  <types>\n    <members>My_PSG</members>\n    <name>PermissionSetGroup</name>\n  </types>\n' +
  '  <version>62.0</version>\n</Package>\n';

async function writeManifest(xml: string): Promise<string> {
  const filePath = path.join(
    os.tmpdir(),
    `simply-permissions-assignment-delete-${Date.now()}-${Math.random().toString(36).slice(2)}.xml`,
  );
  await fs.writeFile(filePath, xml);
  return filePath;
}

function stubDelete(): () => number {
  let callCount = 0;
  (Connection.prototype.request as unknown as SinonStub).callsFake(async (request: { method: string; url: string }) => {
    if (request.method === 'DELETE' && request.url.includes('/composite/sobjects?ids=')) {
      callCount++;
      const ids = new URL(request.url, 'https://example.com').searchParams.get('ids')?.split(',') ?? [];
      return ids.map((id) => ({ id, success: true, errors: [] }));
    }
    throw new Error(`Unexpected request: ${request.method} ${request.url}`);
  });
  return () => callCount;
}

describe('simply permissions assignment delete', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
    process.exitCode = undefined;
  });

  it('rejects --file combined with an explicit name flag', async () => {
    const filePath = await writeManifest(BOTH_TYPES_MANIFEST);

    try {
      await expect(
        PermissionsAssignmentDelete.run([
          '--file',
          filePath,
          '--permission-set-name',
          'My_PS',
          '--target-org',
          testOrg.username,
        ]),
      ).rejects.toThrow();
    } finally {
      await fs.rm(filePath, { force: true });
    }
  });

  it('queries both PermissionSet and PermissionSetGroup members from --file and deletes the union in one chunk', async () => {
    const filePath = await writeManifest(BOTH_TYPES_MANIFEST);

    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').callsFake(async (soql: string) => {
      if (soql.includes('PermissionSet.Name IN')) {
        return { records: [{ Id: 'assign1' }], done: true, totalSize: 1 } as never;
      }
      if (soql.includes('PermissionSetGroup.DeveloperName IN')) {
        return { records: [{ Id: 'assign2' }], done: true, totalSize: 1 } as never;
      }
      throw new Error(`Unexpected query: ${soql}`);
    });
    const deleteCallCount = stubDelete();

    try {
      const result = await PermissionsAssignmentDelete.run(['--file', filePath, '--target-org', testOrg.username]);

      expect([...result.deleted].sort()).to.deep.equal(['assign1', 'assign2']);
      expect(result.failures).to.deep.equal([]);
      expect(deleteCallCount()).to.equal(1);
    } finally {
      await fs.rm(filePath, { force: true });
    }
  });

  it('deletes more than 200 matching assignments in multiple chunks', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `assign${i}`);
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      records: ids.map((id) => ({ Id: id })),
      done: true,
      totalSize: ids.length,
    } as never);
    const deleteCallCount = stubDelete();

    const result = await PermissionsAssignmentDelete.run([
      '--permission-set-name',
      'My_PS',
      '--target-org',
      testOrg.username,
    ]);

    expect(result.deleted).to.have.length(250);
    expect(deleteCallCount()).to.equal(2);
  });
});
