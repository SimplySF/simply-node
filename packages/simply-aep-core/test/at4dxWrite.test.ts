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
import { BindingWriteError, type CreateBindingInput } from '../src/at4dxBindingTypes.js';
import { createBinding, updateBinding } from '../src/at4dxWrite.js';
import { scanLocalBindings } from '../src/at4dxLocalScan.js';

/* eslint-disable camelcase -- AT4DX Custom Metadata field API names (BindingInterface__c, To__c, etc.) */

function baseSelectorCreateInput(overrides: Partial<CreateBindingInput> = {}): CreateBindingInput {
  return {
    bindingType: 'Selector',
    developerName: 'Account_Selector',
    sobject: 'Account',
    to: 'AccountsSelector',
    ...overrides,
  };
}

describe('createBinding', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-binding-write-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('writes a new Selector binding to source-dir and returns its file path with no deploy', async () => {
    const result = await createBinding(baseSelectorCreateInput(), { sourceDir: tmpDir });

    expect(result.filePath).toBe(
      path.join(tmpDir, 'customMetadata', 'ApplicationFactory_SelectorBinding.Account_Selector.md-meta.xml'),
    );
    expect(result.deploy).toBeUndefined();
    expect(result.issues).toEqual([]);

    const { records } = scanLocalBindings([tmpDir], ['Selector']);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ developerName: 'Account_Selector', key: 'Account', to: 'AccountsSelector' });
  });

  it('writes a Service binding using bindingInterface instead of sobject', async () => {
    const result = await createBinding(
      { bindingType: 'Service', developerName: 'My_Service', bindingInterface: 'IMyService', to: 'MyServiceImpl' },
      { sourceDir: tmpDir },
    );

    expect(result.filePath).toBe(
      path.join(tmpDir, 'customMetadata', 'ApplicationFactory_ServiceBinding.My_Service.md-meta.xml'),
    );
    const { records } = scanLocalBindings([tmpDir], ['Service']);
    expect(records[0]).toMatchObject({ key: 'IMyService', keyField: undefined, to: 'MyServiceImpl' });
  });

  it('writes a Domain binding with no priority field', async () => {
    await createBinding(
      { bindingType: 'Domain', developerName: 'Account_Domain', sobject: 'Account', to: 'AccountDomain' },
      { sourceDir: tmpDir },
    );

    const { records } = scanLocalBindings([tmpDir], ['Domain']);
    expect(records[0]).toMatchObject({ key: 'Account', to: 'AccountDomain', priority: undefined });
  });

  it('writes a UnitOfWork binding with sequence but no to/priority/bindingInterface field', async () => {
    await createBinding(
      { bindingType: 'UnitOfWork', developerName: 'Account_UOW', sobject: 'Account', sequence: 10 },
      { sourceDir: tmpDir },
    );

    const { records } = scanLocalBindings([tmpDir], ['UnitOfWork']);
    expect(records[0]).toMatchObject({ key: 'Account', sequence: 10, to: undefined, priority: undefined });

    const xml = fs.readFileSync(
      path.join(tmpDir, 'customMetadata', 'ApplicationFactory_UnitOfWorkBinding.Account_UOW.md-meta.xml'),
      'utf-8',
    );
    expect(xml).not.toContain('To__c');
    expect(xml).not.toContain('Priority__c');
    expect(xml).not.toContain('BindingInterface__c');
    expect(xml).toContain('BindingSequence__c');
  });

  it('writes a UnitOfWork binding using BindingSObjectAlternate__c when sobjectAlternate is true', async () => {
    await createBinding(
      {
        bindingType: 'UnitOfWork',
        developerName: 'ServiceResource_UOW',
        sobject: 'ServiceResource',
        sobjectAlternate: true,
      },
      { sourceDir: tmpDir },
    );

    const { records } = scanLocalBindings([tmpDir], ['UnitOfWork']);
    expect(records[0].keyField).toBe('alternate');
    expect(records[0].key).toBe('ServiceResource');
  });

  it('defaults label to developerName', async () => {
    await createBinding(baseSelectorCreateInput(), { sourceDir: tmpDir });

    const { records } = scanLocalBindings([tmpDir], ['Selector']);
    expect(records[0].label).toBe('Account_Selector');
  });

  it('writes BindingSObjectAlternate__c when sobjectAlternate is true', async () => {
    await createBinding(baseSelectorCreateInput({ sobjectAlternate: true }), { sourceDir: tmpDir });

    const { records } = scanLocalBindings([tmpDir], ['Selector']);
    expect(records[0].keyField).toBe('alternate');
    expect(records[0].key).toBe('Account');
  });

  it('rejects sobject given with bindingType Service', async () => {
    await expect(
      createBinding(
        { bindingType: 'Service', developerName: 'My_Service', to: 'MyServiceImpl', sobject: 'Account' },
        { sourceDir: tmpDir },
      ),
    ).rejects.toThrow(expect.objectContaining({ code: 'type-field-mismatch' }) as Error);
  });

  it('rejects bindingInterface given with bindingType Selector', async () => {
    await expect(
      createBinding(baseSelectorCreateInput({ bindingInterface: 'ISomething' }), { sourceDir: tmpDir }),
    ).rejects.toThrow(expect.objectContaining({ code: 'type-field-mismatch' }) as Error);
  });

  it('rejects priority given with bindingType Domain', async () => {
    await expect(
      createBinding(
        {
          bindingType: 'Domain',
          developerName: 'Account_Domain',
          sobject: 'Account',
          to: 'AccountDomain',
          priority: 1,
        },
        {
          sourceDir: tmpDir,
        },
      ),
    ).rejects.toThrow(expect.objectContaining({ code: 'type-field-mismatch' }) as Error);
  });

  it('rejects priority given with bindingType UnitOfWork', async () => {
    await expect(
      createBinding(
        { bindingType: 'UnitOfWork', developerName: 'Account_UOW', sobject: 'Account', priority: 1 },
        { sourceDir: tmpDir },
      ),
    ).rejects.toThrow(expect.objectContaining({ code: 'type-field-mismatch' }) as Error);
  });

  it('rejects to given with bindingType UnitOfWork', async () => {
    await expect(
      createBinding(
        { bindingType: 'UnitOfWork', developerName: 'Account_UOW', sobject: 'Account', to: 'SomeImpl' },
        { sourceDir: tmpDir },
      ),
    ).rejects.toThrow(expect.objectContaining({ code: 'type-field-mismatch' }) as Error);
  });

  it('rejects sequence given with a non-UnitOfWork bindingType', async () => {
    await expect(createBinding(baseSelectorCreateInput({ sequence: 10 }), { sourceDir: tmpDir })).rejects.toThrow(
      expect.objectContaining({ code: 'type-field-mismatch' }) as Error,
    );
  });

  it('rejects a Selector create with no to given', async () => {
    await expect(
      createBinding(
        { bindingType: 'Selector', developerName: 'Account_Selector', sobject: 'Account' },
        { sourceDir: tmpDir },
      ),
    ).rejects.toThrow(expect.objectContaining({ code: 'type-field-mismatch' }) as Error);
  });

  it('rejects a DeveloperName that already exists in the scanned scope (same binding type), without writing a file', async () => {
    await createBinding(baseSelectorCreateInput(), { sourceDir: tmpDir });

    await expect(createBinding(baseSelectorCreateInput({ sobject: 'Contact' }), { sourceDir: tmpDir })).rejects.toThrow(
      expect.objectContaining({ code: 'developer-name-already-exists' }) as Error,
    );

    const { records } = scanLocalBindings([tmpDir], ['Selector']);
    expect(records).toHaveLength(1);
    expect(records[0].key).toBe('Account');
  });

  it('allows the same DeveloperName across different binding types', async () => {
    await createBinding(baseSelectorCreateInput({ developerName: 'Shared' }), { sourceDir: tmpDir });

    const result = await createBinding(
      { bindingType: 'Domain', developerName: 'Shared', sobject: 'Contact', to: 'ContactDomain' },
      { sourceDir: tmpDir },
    );
    expect(result.issues).toEqual([]);
  });

  it('rejects an unsupported-entity-definition-object introduced by the create unless force is passed', async () => {
    const colliding = baseSelectorCreateInput({
      developerName: 'ServiceResource_Selector',
      sobject: 'ServiceResource',
    });

    let thrown: BindingWriteError | undefined;
    try {
      await createBinding(colliding, { sourceDir: tmpDir });
    } catch (error) {
      thrown = error as BindingWriteError;
    }
    expect(thrown?.code).toBe('validation-failed');
    expect(thrown?.issues?.some((issue) => issue.rule === 'unsupported-entity-definition-object')).toBe(true);
    expect(scanLocalBindings([tmpDir], ['Selector']).records).toHaveLength(0);

    const forced = await createBinding({ ...colliding, force: true }, { sourceDir: tmpDir });
    expect(forced.issues.some((issue) => issue.rule === 'unsupported-entity-definition-object')).toBe(true);
    expect(scanLocalBindings([tmpDir], ['Selector']).records).toHaveLength(1);
  });

  it('rejects an invalid DeveloperName before touching disk', async () => {
    await expect(
      createBinding(baseSelectorCreateInput({ developerName: '1Invalid' }), { sourceDir: tmpDir }),
    ).rejects.toThrow(expect.objectContaining({ code: 'invalid-developer-name' }) as Error);
    expect(fs.existsSync(path.join(tmpDir, 'customMetadata'))).toBe(false);
  });

  it('rejects a label over 40 characters', async () => {
    await expect(
      createBinding(baseSelectorCreateInput({ label: 'A'.repeat(41) }), { sourceDir: tmpDir }),
    ).rejects.toThrow(expect.objectContaining({ code: 'label-too-long' }) as Error);
  });

  it('requires at least one of sourceDir/connection', async () => {
    await expect(createBinding(baseSelectorCreateInput(), {})).rejects.toThrow(
      expect.objectContaining({ code: 'source-or-target-required' }) as Error,
    );
  });

  it('treats an empty local source-dir as the ordinary first-binding case, not at4dx-not-detected', async () => {
    const result = await createBinding(baseSelectorCreateInput(), { sourceDir: tmpDir });
    expect(result.issues).toEqual([]);
  });
});

describe('updateBinding', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-binding-write-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('changes only the given fields, preserving everything else', async () => {
    await createBinding(baseSelectorCreateInput({ priority: 1 }), { sourceDir: tmpDir });

    const result = await updateBinding(
      { bindingType: 'Selector', developerName: 'Account_Selector', priority: 5 },
      { sourceDirs: [tmpDir] },
    );

    expect(result.issues).toEqual([]);
    const { records } = scanLocalBindings([tmpDir], ['Selector']);
    expect(records[0]).toMatchObject({ priority: 5, to: 'AccountsSelector', key: 'Account' });
  });

  it("preserves an alternate-field binding's keyField when only an unrelated field changes", async () => {
    await createBinding(baseSelectorCreateInput({ sobject: 'ServiceResource', sobjectAlternate: true, priority: 1 }), {
      sourceDir: tmpDir,
    });

    await updateBinding(
      { bindingType: 'Selector', developerName: 'Account_Selector', priority: 2 },
      { sourceDirs: [tmpDir] },
    );

    const { records } = scanLocalBindings([tmpDir], ['Selector']);
    expect(records[0].keyField).toBe('alternate');
    expect(records[0].key).toBe('ServiceResource');
    expect(records[0].priority).toBe(2);
  });

  it('moves an alternate-field binding to the primary field when sobjectAlternate is explicitly set to false', async () => {
    await createBinding(baseSelectorCreateInput({ sobjectAlternate: true }), { sourceDir: tmpDir });

    await updateBinding(
      { bindingType: 'Selector', developerName: 'Account_Selector', sobjectAlternate: false },
      { sourceDirs: [tmpDir] },
    );

    const { records } = scanLocalBindings([tmpDir], ['Selector']);
    expect(records[0].keyField).toBe('primary');
  });

  it('changes only the sequence on a UnitOfWork binding, preserving the SObject reference', async () => {
    await createBinding(
      { bindingType: 'UnitOfWork', developerName: 'Account_UOW', sobject: 'Account', sequence: 10 },
      { sourceDir: tmpDir },
    );

    const result = await updateBinding(
      { bindingType: 'UnitOfWork', developerName: 'Account_UOW', sequence: 20 },
      { sourceDirs: [tmpDir] },
    );

    expect(result.issues).toEqual([]);
    const { records } = scanLocalBindings([tmpDir], ['UnitOfWork']);
    expect(records[0]).toMatchObject({ key: 'Account', sequence: 20 });
  });

  it('rejects when the DeveloperName is not found', async () => {
    await createBinding(baseSelectorCreateInput(), { sourceDir: tmpDir });

    await expect(
      updateBinding(
        { bindingType: 'Selector', developerName: 'Does_Not_Exist', priority: 1 },
        { sourceDirs: [tmpDir] },
      ),
    ).rejects.toThrow(expect.objectContaining({ code: 'developer-name-not-found' }) as Error);
  });

  it('rejects when no field besides developerName is given', async () => {
    await createBinding(baseSelectorCreateInput(), { sourceDir: tmpDir });

    await expect(
      updateBinding({ bindingType: 'Selector', developerName: 'Account_Selector' }, { sourceDirs: [tmpDir] }),
    ).rejects.toThrow(expect.objectContaining({ code: 'no-fields-to-update' }) as Error);
  });

  it('rejects a duplicate-to introduced by the update unless force is passed', async () => {
    await createBinding(baseSelectorCreateInput(), { sourceDir: tmpDir });
    await createBinding(
      baseSelectorCreateInput({ developerName: 'Contact_Selector', sobject: 'Contact', to: 'ContactsSelector' }),
      {
        sourceDir: tmpDir,
      },
    );

    await expect(
      updateBinding(
        { bindingType: 'Selector', developerName: 'Contact_Selector', to: 'AccountsSelector' },
        { sourceDirs: [tmpDir] },
      ),
    ).rejects.toMatchObject({ code: 'validation-failed' });

    const forced = await updateBinding(
      { bindingType: 'Selector', developerName: 'Contact_Selector', to: 'AccountsSelector', force: true },
      { sourceDirs: [tmpDir] },
    );
    expect(forced.issues.some((issue) => issue.rule === 'duplicate-to')).toBe(true);
  });

  it('requires at least one of sourceDirs/connection', async () => {
    await expect(
      updateBinding({ bindingType: 'Selector', developerName: 'Anything', priority: 1 }, {}),
    ).rejects.toThrow(expect.objectContaining({ code: 'source-or-target-required' }) as Error);
  });

  it('reports at4dx-not-detected when the local scan finds nothing at all', async () => {
    await expect(
      updateBinding({ bindingType: 'Selector', developerName: 'Anything', priority: 1 }, { sourceDirs: [tmpDir] }),
    ).rejects.toThrow(expect.objectContaining({ code: 'at4dx-not-detected' }) as Error);
  });
});

describe('org-connected create/update', () => {
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
        { fullName: 'Account_Selector', type: 'CustomMetadata', state: ComponentStatus.Created },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const result = await createBinding(baseSelectorCreateInput(), { connection, wait: Duration.minutes(1) });

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
          fullName: 'Account_Selector',
          type: 'CustomMetadata',
          state: ComponentStatus.Failed,
          error: 'INVALID_FIELD: bogus',
        },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-binding-write-org-'));
    try {
      await expect(
        createBinding(baseSelectorCreateInput(), { sourceDir: tmpDir, connection, wait: Duration.minutes(1) }),
      ).rejects.toThrow(expect.objectContaining({ code: 'deploy-failed' }) as Error);

      const filePath = path.join(
        tmpDir,
        'customMetadata',
        'ApplicationFactory_SelectorBinding.Account_Selector.md-meta.xml',
      );
      expect(fs.existsSync(filePath)).toBe(true);
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('update: locates and updates a binding directly in the org, with no local footprint', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(connection, 'autoFetchQuery').resolves({
      records: [
        {
          DeveloperName: 'Account_Selector',
          Label: 'Account Selector',
          BindingSObject__c: '01I000000000001',
          BindingSObject__r: { QualifiedApiName: 'Account' },
          BindingSObjectAlternate__c: null,
          To__c: 'AccountsSelector',
          Priority__c: 1,
        },
      ],
      done: true,
      totalSize: 1,
    } as never);

    const fakeDeployResult = {
      response: { id: '0Af000000000003', status: 'Succeeded', success: true },
      getFileResponses: () => [
        { fullName: 'Account_Selector', type: 'CustomMetadata', state: ComponentStatus.Changed },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const result = await updateBinding(
      { bindingType: 'Selector', developerName: 'Account_Selector', priority: 99 },
      { connection, wait: Duration.minutes(1) },
    );

    expect(result.filePath).toBeUndefined();
    expect(result.deploy).toEqual({ id: '0Af000000000003', status: 'Succeeded', success: true });
  });
});

describe('BindingWriteError', () => {
  it('carries its error code and optional issues', () => {
    const error = new BindingWriteError('developer-name-not-found', 'not found');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BindingWriteError');
    expect(error.code).toBe('developer-name-not-found');
    expect(error.issues).toBeUndefined();
  });
});
