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
import { FieldSetInclusionWriteError, type CreateFieldSetInclusionInput } from '../src/at4dxFieldSetInclusionTypes.js';
import { createFieldSetInclusion, updateFieldSetInclusion } from '../src/at4dxFieldSetInclusionWrite.js';
import { scanLocalFieldSetInclusions } from '../src/at4dxFieldSetInclusionLocalScan.js';

/* eslint-disable camelcase -- AT4DX Custom Metadata field API names (BindingSObject__c, FieldsetName__c, etc.) */

function baseCreateInput(overrides: Partial<CreateFieldSetInclusionInput> = {}): CreateFieldSetInclusionInput {
  return {
    developerName: 'Account_Contact_Fields',
    sobject: 'Account',
    fieldsetName: 'ContactRelatedFields',
    ...overrides,
  };
}

describe('createFieldSetInclusion', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-field-set-inclusion-write-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('writes a new record to source-dir and returns its file path with no deploy', async () => {
    const result = await createFieldSetInclusion(baseCreateInput(), { sourceDir: tmpDir });

    expect(result.filePath).toBe(
      path.join(tmpDir, 'customMetadata', 'SelectorConfig_FieldSetInclusion.Account_Contact_Fields.md-meta.xml'),
    );
    expect(result.deploy).toBeUndefined();
    expect(result.issues).toEqual([]);

    const { records } = scanLocalFieldSetInclusions([tmpDir]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ developerName: 'Account_Contact_Fields', sobject: 'Account' });
  });

  it('defaults label to developerName and defaults isActive to true', async () => {
    await createFieldSetInclusion(baseCreateInput(), { sourceDir: tmpDir });

    const { records } = scanLocalFieldSetInclusions([tmpDir]);
    expect(records[0]).toMatchObject({ label: 'Account_Contact_Fields', isActive: true });
  });

  it('writes BindingSObjectAlternate__c when sobjectAlternate is true', async () => {
    await createFieldSetInclusion(baseCreateInput({ sobjectAlternate: true }), { sourceDir: tmpDir });

    const { records } = scanLocalFieldSetInclusions([tmpDir]);
    expect(records[0].sobjectField).toBe('alternate');
    expect(records[0].sobject).toBe('Account');
  });

  it('writes isActive: false when isActive is explicitly false', async () => {
    await createFieldSetInclusion(baseCreateInput({ isActive: false }), { sourceDir: tmpDir });

    const { records } = scanLocalFieldSetInclusions([tmpDir]);
    expect(records[0].isActive).toBe(false);
  });

  it('rejects a DeveloperName that already exists in the scanned scope, without writing a second file', async () => {
    await createFieldSetInclusion(baseCreateInput(), { sourceDir: tmpDir });

    await expect(
      createFieldSetInclusion(baseCreateInput({ fieldsetName: 'OtherFields' }), { sourceDir: tmpDir }),
    ).rejects.toThrow(expect.objectContaining({ code: 'developer-name-already-exists' }) as Error);

    const { records } = scanLocalFieldSetInclusions([tmpDir]);
    expect(records).toHaveLength(1);
    expect(records[0].fieldsetName).toBe('ContactRelatedFields');
  });

  it('rejects an unsupported-entity-definition-object without force, and includes the issue with force', async () => {
    const colliding = baseCreateInput({ sobject: 'ServiceResource' });

    let thrown: FieldSetInclusionWriteError | undefined;
    try {
      await createFieldSetInclusion(colliding, { sourceDir: tmpDir });
    } catch (error) {
      thrown = error as FieldSetInclusionWriteError;
    }
    expect(thrown?.code).toBe('validation-failed');
    expect(thrown?.issues?.some((issue) => issue.rule === 'unsupported-entity-definition-object')).toBe(true);
    expect(scanLocalFieldSetInclusions([tmpDir]).records).toHaveLength(0);

    const forced = await createFieldSetInclusion({ ...colliding, force: true }, { sourceDir: tmpDir });
    expect(forced.issues.some((issue) => issue.rule === 'unsupported-entity-definition-object')).toBe(true);
    expect(scanLocalFieldSetInclusions([tmpDir]).records).toHaveLength(1);
  });

  it('rejects an invalid DeveloperName before touching disk', async () => {
    await expect(
      createFieldSetInclusion(baseCreateInput({ developerName: '1Invalid' }), { sourceDir: tmpDir }),
    ).rejects.toThrow(expect.objectContaining({ code: 'invalid-developer-name' }) as Error);
    expect(fs.existsSync(path.join(tmpDir, 'customMetadata'))).toBe(false);
  });

  it('rejects a label over 40 characters', async () => {
    await expect(
      createFieldSetInclusion(baseCreateInput({ label: 'A'.repeat(41) }), { sourceDir: tmpDir }),
    ).rejects.toThrow(expect.objectContaining({ code: 'label-too-long' }) as Error);
  });

  it('requires at least one of sourceDir/connection', async () => {
    await expect(createFieldSetInclusion(baseCreateInput(), {})).rejects.toThrow(
      expect.objectContaining({ code: 'source-or-target-required' }) as Error,
    );
  });

  it('treats an empty local source-dir as the ordinary first-record case, not at4dx-not-detected', async () => {
    const result = await createFieldSetInclusion(baseCreateInput(), { sourceDir: tmpDir });
    expect(result.issues).toEqual([]);
  });
});

describe('updateFieldSetInclusion', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-field-set-inclusion-write-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('changes only the given fields, preserving everything else', async () => {
    await createFieldSetInclusion(baseCreateInput({ label: 'Original Label' }), { sourceDir: tmpDir });

    const result = await updateFieldSetInclusion(
      { developerName: 'Account_Contact_Fields', isActive: false },
      { sourceDirs: [tmpDir] },
    );

    expect(result.issues).toEqual([]);
    const { records } = scanLocalFieldSetInclusions([tmpDir]);
    expect(records[0]).toMatchObject({
      isActive: false,
      fieldsetName: 'ContactRelatedFields',
      label: 'Original Label',
      sobject: 'Account',
    });
  });

  it("preserves an alternate-field record's sobjectField when only an unrelated field changes", async () => {
    await createFieldSetInclusion(
      baseCreateInput({ sobject: 'ServiceResource', sobjectAlternate: true, fieldsetName: 'SkillFields' }),
      { sourceDir: tmpDir },
    );

    await updateFieldSetInclusion(
      { developerName: 'Account_Contact_Fields', isActive: false },
      { sourceDirs: [tmpDir] },
    );

    const { records } = scanLocalFieldSetInclusions([tmpDir]);
    expect(records[0].sobjectField).toBe('alternate');
    expect(records[0].sobject).toBe('ServiceResource');
    expect(records[0].isActive).toBe(false);
  });

  it('moves an alternate-field record to the primary field when sobjectAlternate is explicitly set to false', async () => {
    await createFieldSetInclusion(baseCreateInput({ sobjectAlternate: true }), { sourceDir: tmpDir });

    await updateFieldSetInclusion(
      { developerName: 'Account_Contact_Fields', sobjectAlternate: false },
      { sourceDirs: [tmpDir] },
    );

    const { records } = scanLocalFieldSetInclusions([tmpDir]);
    expect(records[0].sobjectField).toBe('primary');
  });

  it('changing --fieldset-name alone leaves the SObject reference untouched', async () => {
    await createFieldSetInclusion(baseCreateInput(), { sourceDir: tmpDir });

    await updateFieldSetInclusion(
      { developerName: 'Account_Contact_Fields', fieldsetName: 'NewFields' },
      { sourceDirs: [tmpDir] },
    );

    const { records } = scanLocalFieldSetInclusions([tmpDir]);
    expect(records[0].fieldsetName).toBe('NewFields');
    expect(records[0].sobject).toBe('Account');
  });

  it('rejects when the DeveloperName is not found', async () => {
    await createFieldSetInclusion(baseCreateInput(), { sourceDir: tmpDir });

    await expect(
      updateFieldSetInclusion({ developerName: 'Does_Not_Exist', isActive: false }, { sourceDirs: [tmpDir] }),
    ).rejects.toThrow(expect.objectContaining({ code: 'developer-name-not-found' }) as Error);
  });

  it('rejects when no field besides developerName is given', async () => {
    await createFieldSetInclusion(baseCreateInput(), { sourceDir: tmpDir });

    await expect(
      updateFieldSetInclusion({ developerName: 'Account_Contact_Fields' }, { sourceDirs: [tmpDir] }),
    ).rejects.toThrow(expect.objectContaining({ code: 'no-fields-to-update' }) as Error);
  });

  it('blocks a duplicate-fieldset-name introduced by the update unless force is passed', async () => {
    await createFieldSetInclusion(baseCreateInput(), { sourceDir: tmpDir });
    await createFieldSetInclusion(
      baseCreateInput({ developerName: 'Contact_Fields', sobject: 'Contact', fieldsetName: 'OtherFields' }),
      { sourceDir: tmpDir },
    );

    await expect(
      updateFieldSetInclusion(
        { developerName: 'Contact_Fields', fieldsetName: 'ContactRelatedFields' },
        {
          sourceDirs: [tmpDir],
        },
      ),
    ).rejects.toMatchObject({ code: 'validation-failed' });

    const forced = await updateFieldSetInclusion(
      { developerName: 'Contact_Fields', fieldsetName: 'ContactRelatedFields', force: true },
      { sourceDirs: [tmpDir] },
    );
    expect(forced.issues.some((issue) => issue.rule === 'duplicate-fieldset-name')).toBe(true);
  });

  it('requires at least one of sourceDirs/connection', async () => {
    await expect(updateFieldSetInclusion({ developerName: 'Anything', isActive: false }, {})).rejects.toThrow(
      expect.objectContaining({ code: 'source-or-target-required' }) as Error,
    );
  });

  it('reports at4dx-not-detected when the local scan finds nothing at all', async () => {
    await expect(
      updateFieldSetInclusion({ developerName: 'Anything', isActive: false }, { sourceDirs: [tmpDir] }),
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
        { fullName: 'Account_Contact_Fields', type: 'CustomMetadata', state: ComponentStatus.Created },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const result = await createFieldSetInclusion(baseCreateInput(), { connection, wait: Duration.minutes(1) });

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
          fullName: 'Account_Contact_Fields',
          type: 'CustomMetadata',
          state: ComponentStatus.Failed,
          error: 'INVALID_FIELD: bogus',
        },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-field-set-inclusion-write-org-'));
    try {
      await expect(
        createFieldSetInclusion(baseCreateInput(), { sourceDir: tmpDir, connection, wait: Duration.minutes(1) }),
      ).rejects.toThrow(expect.objectContaining({ code: 'deploy-failed' }) as Error);

      const filePath = path.join(
        tmpDir,
        'customMetadata',
        'SelectorConfig_FieldSetInclusion.Account_Contact_Fields.md-meta.xml',
      );
      expect(fs.existsSync(filePath)).toBe(true);
    } finally {
      await fsp.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('update: locates and updates a record directly in the org, with no local footprint', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(connection, 'autoFetchQuery').resolves({
      records: [
        {
          DeveloperName: 'Account_Contact_Fields',
          Label: 'Account Contact Fields',
          BindingSObject__c: '01I000000000001',
          BindingSObject__r: { QualifiedApiName: 'Account' },
          BindingSObjectAlternate__c: null,
          FieldsetName__c: 'ContactRelatedFields',
          IsActive__c: true,
        },
      ],
      done: true,
      totalSize: 1,
    } as never);

    const fakeDeployResult = {
      response: { id: '0Af000000000003', status: 'Succeeded', success: true },
      getFileResponses: () => [
        { fullName: 'Account_Contact_Fields', type: 'CustomMetadata', state: ComponentStatus.Changed },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const result = await updateFieldSetInclusion(
      { developerName: 'Account_Contact_Fields', isActive: false },
      { connection, wait: Duration.minutes(1) },
    );

    expect(result.filePath).toBeUndefined();
    expect(result.sobject).toBe('Account');
    expect(result.deploy).toEqual({ id: '0Af000000000003', status: 'Succeeded', success: true });
  });
});

describe('FieldSetInclusionWriteError', () => {
  it('carries its error code and optional issues', () => {
    const error = new FieldSetInclusionWriteError('developer-name-not-found', 'not found');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('FieldSetInclusionWriteError');
    expect(error.code).toBe('developer-name-not-found');
    expect(error.issues).toBeUndefined();
  });
});
