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
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Duration } from '@salesforce/kit';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { ComponentSet, ComponentStatus } from '@salesforce/source-deploy-retrieve';
import sinon from 'sinon';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  DomainProcessBindingWriteError,
  type CreateDomainProcessBindingInput,
} from '../src/at4dxDomainProcessBindingTypes.js';
import { createDomainProcessBinding, setDomainProcessBinding } from '../src/at4dxDomainProcessWrite.js';
import { scanLocalDomainProcessBindings } from '../src/at4dxDomainProcessLocalScan.js';

/* eslint-disable camelcase -- AT4DX Custom Metadata field API names (ClassToInject__c, TriggerOperation__c, etc.) */

function baseCreateInput(overrides: Partial<CreateDomainProcessBindingInput> = {}): CreateDomainProcessBindingInput {
  return {
    developerName: 'Account_Before_Insert_Test',
    sobject: 'Account',
    processContext: 'TriggerExecution',
    triggerOperation: 'Before_Insert',
    type: 'Action',
    classToInject: 'SomeAction',
    order: 10,
    ...overrides,
  };
}

describe('createDomainProcessBinding', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-domain-process-write-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('writes a new binding to source-dir and returns its file path with no deploy', async () => {
    const result = await createDomainProcessBinding(baseCreateInput(), { sourceDir: tmpDir });

    expect(result.filePath).toBe(
      path.join(tmpDir, 'customMetadata', 'DomainProcessBinding.Account_Before_Insert_Test.md-meta.xml'),
    );
    expect(result.deploy).toBeUndefined();
    expect(result.issues).toEqual([]);

    const { records } = scanLocalDomainProcessBindings([tmpDir]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ developerName: 'Account_Before_Insert_Test', sobject: 'Account' });
  });

  it('defaults label to developerName and defaults isActive/executeAsynchronous/logicalInverse/preventRecursive', async () => {
    await createDomainProcessBinding(baseCreateInput(), { sourceDir: tmpDir });

    const { records } = scanLocalDomainProcessBindings([tmpDir]);
    expect(records[0]).toMatchObject({
      label: 'Account_Before_Insert_Test',
      isActive: true,
      executeAsynchronous: false,
      logicalInverse: false,
      preventRecursive: false,
    });
  });

  it('writes RelatedDomainBindingSObjectAlternate__c when sobjectAlternate is true', async () => {
    await createDomainProcessBinding(baseCreateInput({ sobjectAlternate: true }), { sourceDir: tmpDir });

    const { records } = scanLocalDomainProcessBindings([tmpDir]);
    expect(records[0].sobjectField).toBe('alternate');
    expect(records[0].sobject).toBe('Account');
  });

  it('rejects a DeveloperName that already exists in the scanned scope, without writing a file', async () => {
    await createDomainProcessBinding(baseCreateInput(), { sourceDir: tmpDir });

    await expect(createDomainProcessBinding(baseCreateInput({ order: 20 }), { sourceDir: tmpDir })).rejects.toThrow(
      expect.objectContaining({ code: 'developer-name-already-exists' }) as Error,
    );

    const { records } = scanLocalDomainProcessBindings([tmpDir]);
    expect(records).toHaveLength(1);
    expect(records[0].order).toBe(10);
  });

  it('rejects an order-collision with an existing active record unless force is passed, and includes the issue either way', async () => {
    await createDomainProcessBinding(baseCreateInput(), { sourceDir: tmpDir });

    const colliding = baseCreateInput({ developerName: 'Account_Before_Insert_Other' });

    // resolveDomainProcessBindings flags every colliding active record, not just the new one — see
    // docs/design/0008-at4dx-domain-process-binding-list.md — so both the pre-existing record and the
    // candidate show up in `issues`.
    let thrown: DomainProcessBindingWriteError | undefined;
    try {
      await createDomainProcessBinding(colliding, { sourceDir: tmpDir });
    } catch (error) {
      thrown = error as DomainProcessBindingWriteError;
    }
    expect(thrown?.code).toBe('validation-failed');
    expect(thrown?.issues?.filter((issue) => issue.rule === 'order-collision')).toHaveLength(2);
    expect(scanLocalDomainProcessBindings([tmpDir]).records).toHaveLength(1);

    const forced = await createDomainProcessBinding({ ...colliding, force: true }, { sourceDir: tmpDir });
    expect(forced.issues.some((issue) => issue.rule === 'order-collision')).toBe(true);
    expect(scanLocalDomainProcessBindings([tmpDir]).records).toHaveLength(2);
  });

  it('rejects an invalid DeveloperName before touching disk', async () => {
    await expect(
      createDomainProcessBinding(baseCreateInput({ developerName: '1Invalid' }), { sourceDir: tmpDir }),
    ).rejects.toThrow(expect.objectContaining({ code: 'invalid-developer-name' }) as Error);
    expect(fs.existsSync(path.join(tmpDir, 'customMetadata'))).toBe(false);
  });

  it('rejects a label over 40 characters', async () => {
    await expect(
      createDomainProcessBinding(baseCreateInput({ label: 'A'.repeat(41) }), { sourceDir: tmpDir }),
    ).rejects.toThrow(expect.objectContaining({ code: 'label-too-long' }) as Error);
  });

  it('rejects giving both triggerOperation and domainMethodToken', async () => {
    await expect(
      createDomainProcessBinding(baseCreateInput({ domainMethodToken: 'ProcessDeals' }), { sourceDir: tmpDir }),
    ).rejects.toThrow(expect.objectContaining({ code: 'context-field-mismatch' }) as Error);
  });

  it('rejects domainMethodToken given for a TriggerExecution context', async () => {
    await expect(
      createDomainProcessBinding(baseCreateInput({ triggerOperation: undefined, domainMethodToken: 'ProcessDeals' }), {
        sourceDir: tmpDir,
      }),
    ).rejects.toThrow(expect.objectContaining({ code: 'context-field-mismatch' }) as Error);
  });

  it('requires at least one of sourceDir/connection', async () => {
    await expect(createDomainProcessBinding(baseCreateInput(), {})).rejects.toThrow(
      expect.objectContaining({ code: 'source-or-target-required' }) as Error,
    );
  });

  it('treats an empty local source-dir as the ordinary first-binding case, not at4dx-not-detected', async () => {
    const result = await createDomainProcessBinding(baseCreateInput(), { sourceDir: tmpDir });
    expect(result.issues).toEqual([]);
  });
});

describe('setDomainProcessBinding', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-domain-process-write-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('changes only the given fields, preserving everything else', async () => {
    await createDomainProcessBinding(baseCreateInput({ description: 'original' }), { sourceDir: tmpDir });

    const result = await setDomainProcessBinding(
      { developerName: 'Account_Before_Insert_Test', order: 20 },
      { sourceDirs: [tmpDir] },
    );

    expect(result.issues).toEqual([]);
    const { records } = scanLocalDomainProcessBindings([tmpDir]);
    expect(records[0]).toMatchObject({
      order: 20,
      classToInject: 'SomeAction',
      description: 'original',
      sobject: 'Account',
    });
  });

  it("preserves an alternate-field binding's sobjectField when only an unrelated field changes", async () => {
    await createDomainProcessBinding(baseCreateInput({ sobject: 'ServiceResource', sobjectAlternate: true }), {
      sourceDir: tmpDir,
    });

    await setDomainProcessBinding({ developerName: 'Account_Before_Insert_Test', order: 50 }, { sourceDirs: [tmpDir] });

    const { records } = scanLocalDomainProcessBindings([tmpDir]);
    expect(records[0].sobjectField).toBe('alternate');
    expect(records[0].sobject).toBe('ServiceResource');
    expect(records[0].order).toBe(50);
  });

  it('moves an alternate-field binding to the primary field when sobjectAlternate is explicitly set to false', async () => {
    await createDomainProcessBinding(baseCreateInput({ sobject: 'ServiceResource', sobjectAlternate: true }), {
      sourceDir: tmpDir,
    });

    await setDomainProcessBinding(
      { developerName: 'Account_Before_Insert_Test', sobjectAlternate: false },
      { sourceDirs: [tmpDir] },
    );

    const { records } = scanLocalDomainProcessBindings([tmpDir]);
    expect(records[0].sobjectField).toBe('primary');
  });

  it('rejects when the DeveloperName is not found', async () => {
    await createDomainProcessBinding(baseCreateInput(), { sourceDir: tmpDir });

    await expect(
      setDomainProcessBinding({ developerName: 'Does_Not_Exist', order: 1 }, { sourceDirs: [tmpDir] }),
    ).rejects.toThrow(expect.objectContaining({ code: 'developer-name-not-found' }) as Error);
  });

  it('rejects when no field besides developerName is given', async () => {
    await createDomainProcessBinding(baseCreateInput(), { sourceDir: tmpDir });

    await expect(
      setDomainProcessBinding({ developerName: 'Account_Before_Insert_Test' }, { sourceDirs: [tmpDir] }),
    ).rejects.toThrow(expect.objectContaining({ code: 'no-fields-to-update' }) as Error);
  });

  it('rejects an order-collision introduced by the update unless force is passed', async () => {
    await createDomainProcessBinding(baseCreateInput(), { sourceDir: tmpDir });
    await createDomainProcessBinding(baseCreateInput({ developerName: 'Account_Before_Insert_Other', order: 20 }), {
      sourceDir: tmpDir,
    });

    await expect(
      setDomainProcessBinding({ developerName: 'Account_Before_Insert_Other', order: 10 }, { sourceDirs: [tmpDir] }),
    ).rejects.toMatchObject({ code: 'validation-failed' });

    const forced = await setDomainProcessBinding(
      { developerName: 'Account_Before_Insert_Other', order: 10, force: true },
      { sourceDirs: [tmpDir] },
    );
    expect(forced.issues.some((issue) => issue.rule === 'order-collision')).toBe(true);
  });

  it('clears the previous context field when switching processContext with its matching field', async () => {
    await createDomainProcessBinding(baseCreateInput(), { sourceDir: tmpDir });

    await setDomainProcessBinding(
      {
        developerName: 'Account_Before_Insert_Test',
        processContext: 'DomainMethodExecution',
        domainMethodToken: 'ProcessDeals',
      },
      { sourceDirs: [tmpDir] },
    );

    const { records } = scanLocalDomainProcessBindings([tmpDir]);
    expect(records[0]).toMatchObject({
      processContext: 'DomainMethodExecution',
      domainMethodToken: 'ProcessDeals',
      triggerOperation: undefined,
    });
  });

  it('rejects switching processContext without also giving the matching field', async () => {
    await createDomainProcessBinding(baseCreateInput(), { sourceDir: tmpDir });

    await expect(
      setDomainProcessBinding(
        { developerName: 'Account_Before_Insert_Test', processContext: 'DomainMethodExecution' },
        { sourceDirs: [tmpDir] },
      ),
    ).rejects.toThrow(expect.objectContaining({ code: 'context-field-mismatch' }) as Error);
  });

  it('requires at least one of sourceDirs/connection', async () => {
    await expect(setDomainProcessBinding({ developerName: 'Anything', order: 1 }, {})).rejects.toThrow(
      expect.objectContaining({ code: 'source-or-target-required' }) as Error,
    );
  });

  it('reports at4dx-not-detected when the local scan finds nothing at all', async () => {
    await expect(
      setDomainProcessBinding({ developerName: 'Anything', order: 1 }, { sourceDirs: [tmpDir] }),
    ).rejects.toThrow(expect.objectContaining({ code: 'at4dx-not-detected' }) as Error);
  });
});

describe('org-connected create/set', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  it('create: with only a connection, writes to a temp directory, deploys, and leaves no working-tree file', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(connection, 'autoFetchQuery').resolves({ records: [], done: true, totalSize: 0 });

    const fakeDeployResult = {
      response: { id: '0Af000000000001', status: 'Succeeded', success: true },
      getFileResponses: () => [
        { fullName: 'Account_Before_Insert_Test', type: 'CustomMetadata', state: ComponentStatus.Created },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const result = await createDomainProcessBinding(baseCreateInput(), { connection, wait: Duration.minutes(1) });

    expect(result.filePath).toBeUndefined();
    expect(result.deploy).toEqual({ id: '0Af000000000001', status: 'Succeeded', success: true });
  });

  it('create: throws deploy-failed when the deploy does not succeed, but a source-dir write is left in place', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(connection, 'autoFetchQuery').resolves({ records: [], done: true, totalSize: 0 });

    const fakeDeployResult = {
      response: { id: '0Af000000000002', status: 'Failed', success: false },
      getFileResponses: () => [
        {
          fullName: 'Account_Before_Insert_Test',
          type: 'CustomMetadata',
          state: ComponentStatus.Failed,
          error: 'INVALID_FIELD: bogus',
        },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-domain-process-write-org-'));
    try {
      await expect(
        createDomainProcessBinding(baseCreateInput(), { sourceDir: tmpDir, connection, wait: Duration.minutes(1) }),
      ).rejects.toThrow(expect.objectContaining({ code: 'deploy-failed' }) as Error);

      const filePath = path.join(
        tmpDir,
        'customMetadata',
        'DomainProcessBinding.Account_Before_Insert_Test.md-meta.xml',
      );
      expect(fs.existsSync(filePath)).toBe(true);
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('set: locates and updates a binding directly in the org, with no local footprint', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(connection, 'autoFetchQuery').resolves({
      records: [
        {
          DeveloperName: 'Account_Before_Insert_Test',
          Label: 'Account Before Insert Test',
          RelatedDomainBindingSObject__c: '01I000000000001',
          RelatedDomainBindingSObject__r: { QualifiedApiName: 'Account' },
          RelatedDomainBindingSObjectAlternate__c: null,
          ProcessContext__c: 'TriggerExecution',
          TriggerOperation__c: 'Before_Insert',
          DomainMethodToken__c: null,
          Type__c: 'Action',
          ClassToInject__c: 'SomeAction',
          OrderOfExecution__c: 10,
          IsActive__c: true,
          ExecuteAsynchronous__c: false,
          LogicalInverse__c: false,
          PreventRecursive__c: false,
          Description__c: null,
        },
      ],
      done: true,
      totalSize: 1,
    } as never);

    const fakeDeployResult = {
      response: { id: '0Af000000000003', status: 'Succeeded', success: true },
      getFileResponses: () => [
        { fullName: 'Account_Before_Insert_Test', type: 'CustomMetadata', state: ComponentStatus.Changed },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const result = await setDomainProcessBinding(
      { developerName: 'Account_Before_Insert_Test', order: 99 },
      { connection, wait: Duration.minutes(1) },
    );

    expect(result.filePath).toBeUndefined();
    expect(result.sobject).toBe('Account');
    expect(result.deploy).toEqual({ id: '0Af000000000003', status: 'Succeeded', success: true });
  });
});

describe('DomainProcessBindingWriteError', () => {
  it('carries its error code and optional issues', () => {
    const error = new DomainProcessBindingWriteError('developer-name-not-found', 'not found');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('DomainProcessBindingWriteError');
    expect(error.code).toBe('developer-name-not-found');
    expect(error.issues).toBeUndefined();
  });
});
