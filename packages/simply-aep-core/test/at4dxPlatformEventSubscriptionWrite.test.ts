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
  PlatformEventSubscriptionWriteError,
  type CreatePlatformEventSubscriptionInput,
} from '../src/at4dxPlatformEventSubscriptionTypes.js';
import {
  createPlatformEventSubscription,
  updatePlatformEventSubscription,
} from '../src/at4dxPlatformEventSubscriptionWrite.js';
import { scanLocalPlatformEventSubscriptions } from '../src/at4dxPlatformEventSubscriptionLocalScan.js';

/* eslint-disable camelcase -- AT4DX Custom Metadata field API names (EventBus__c, Consumer__c, etc.) */

function baseCreateInput(
  overrides: Partial<CreatePlatformEventSubscriptionInput> = {},
): CreatePlatformEventSubscriptionInput {
  return {
    developerName: 'Account_Change_Subscriber',
    eventBus: 'Account_Change__e',
    consumer: 'AccountChangeConsumer',
    eventCategory: 'Finance',
    matcherRule: 'MatchEventBus',
    ...overrides,
  };
}

describe('createPlatformEventSubscription', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-platform-event-subscription-write-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('writes a new record to source-dir and returns its file path with no deploy', async () => {
    const result = await createPlatformEventSubscription(baseCreateInput(), { sourceDir: tmpDir });

    expect(result.filePath).toBe(
      path.join(tmpDir, 'customMetadata', 'PlatformEvents_Subscription.Account_Change_Subscriber.md-meta.xml'),
    );
    expect(result.deploy).toBeUndefined();
    expect(result.issues).toEqual([]);

    const { records } = scanLocalPlatformEventSubscriptions([tmpDir]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ developerName: 'Account_Change_Subscriber', eventBus: 'Account_Change__e' });
  });

  it('defaults label to developerName, isActive to true, and executeSynchronous to false', async () => {
    await createPlatformEventSubscription(baseCreateInput(), { sourceDir: tmpDir });

    const { records } = scanLocalPlatformEventSubscriptions([tmpDir]);
    expect(records[0]).toMatchObject({
      label: 'Account_Change_Subscriber',
      isActive: true,
      executeSynchronous: false,
    });
  });

  it('writes isActive: false and executeSynchronous: true when given', async () => {
    await createPlatformEventSubscription(baseCreateInput({ isActive: false, executeSynchronous: true }), {
      sourceDir: tmpDir,
    });

    const { records } = scanLocalPlatformEventSubscriptions([tmpDir]);
    expect(records[0].isActive).toBe(false);
    expect(records[0].executeSynchronous).toBe(true);
  });

  it('rejects a DeveloperName that already exists in the scanned scope, without writing a second file', async () => {
    await createPlatformEventSubscription(baseCreateInput(), { sourceDir: tmpDir });

    await expect(
      createPlatformEventSubscription(baseCreateInput({ consumer: 'OtherConsumer' }), { sourceDir: tmpDir }),
    ).rejects.toThrow(expect.objectContaining({ code: 'developer-name-already-exists' }) as Error);

    const { records } = scanLocalPlatformEventSubscriptions([tmpDir]);
    expect(records).toHaveLength(1);
    expect(records[0].consumer).toBe('AccountChangeConsumer');
  });

  it('rejects a matcher-rule-missing-field without force, and includes the issue with force', async () => {
    const candidate = baseCreateInput({ matcherRule: 'MatchEventBusAndCategory', eventCategory: undefined });

    let thrown: PlatformEventSubscriptionWriteError | undefined;
    try {
      await createPlatformEventSubscription(candidate, { sourceDir: tmpDir });
    } catch (error) {
      thrown = error as PlatformEventSubscriptionWriteError;
    }
    expect(thrown?.code).toBe('validation-failed');
    expect(thrown?.issues?.some((issue) => issue.rule === 'matcher-rule-missing-field')).toBe(true);
    expect(scanLocalPlatformEventSubscriptions([tmpDir]).records).toHaveLength(0);

    const forced = await createPlatformEventSubscription({ ...candidate, force: true }, { sourceDir: tmpDir });
    expect(forced.issues.some((issue) => issue.rule === 'matcher-rule-missing-field')).toBe(true);
    expect(scanLocalPlatformEventSubscriptions([tmpDir]).records).toHaveLength(1);
  });

  it('rejects an invalid DeveloperName before touching disk', async () => {
    await expect(
      createPlatformEventSubscription(baseCreateInput({ developerName: '1Invalid' }), { sourceDir: tmpDir }),
    ).rejects.toThrow(expect.objectContaining({ code: 'invalid-developer-name' }) as Error);
    expect(fs.existsSync(path.join(tmpDir, 'customMetadata'))).toBe(false);
  });

  it('rejects a label over 40 characters', async () => {
    await expect(
      createPlatformEventSubscription(baseCreateInput({ label: 'A'.repeat(41) }), { sourceDir: tmpDir }),
    ).rejects.toThrow(expect.objectContaining({ code: 'label-too-long' }) as Error);
  });

  it('requires at least one of sourceDir/connection', async () => {
    await expect(createPlatformEventSubscription(baseCreateInput(), {})).rejects.toThrow(
      expect.objectContaining({ code: 'source-or-target-required' }) as Error,
    );
  });

  it('treats an empty local source-dir as the ordinary first-record case, not at4dx-not-detected', async () => {
    const result = await createPlatformEventSubscription(baseCreateInput(), { sourceDir: tmpDir });
    expect(result.issues).toEqual([]);
  });
});

describe('updatePlatformEventSubscription', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-platform-event-subscription-write-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('changes only the given fields, preserving everything else', async () => {
    await createPlatformEventSubscription(baseCreateInput({ label: 'Original Label', eventCategory: 'Finance' }), {
      sourceDir: tmpDir,
    });

    const result = await updatePlatformEventSubscription(
      { developerName: 'Account_Change_Subscriber', isActive: false },
      { sourceDirs: [tmpDir] },
    );

    expect(result.issues).toEqual([]);
    const { records } = scanLocalPlatformEventSubscriptions([tmpDir]);
    expect(records[0]).toMatchObject({
      isActive: false,
      label: 'Original Label',
      eventBus: 'Account_Change__e',
      consumer: 'AccountChangeConsumer',
      eventCategory: 'Finance',
    });
  });

  it('changes Consumer__c as an ordinary value change, not a create-plus-delete', async () => {
    await createPlatformEventSubscription(baseCreateInput(), { sourceDir: tmpDir });

    await updatePlatformEventSubscription(
      { developerName: 'Account_Change_Subscriber', consumer: 'NewConsumer' },
      { sourceDirs: [tmpDir] },
    );

    const { records } = scanLocalPlatformEventSubscriptions([tmpDir]);
    expect(records).toHaveLength(1);
    expect(records[0].consumer).toBe('NewConsumer');
    expect(records[0].developerName).toBe('Account_Change_Subscriber');
  });

  it('changing --event-bus alone leaves everything else untouched', async () => {
    await createPlatformEventSubscription(baseCreateInput(), { sourceDir: tmpDir });

    await updatePlatformEventSubscription(
      { developerName: 'Account_Change_Subscriber', eventBus: 'Other_Bus__e' },
      { sourceDirs: [tmpDir] },
    );

    const { records } = scanLocalPlatformEventSubscriptions([tmpDir]);
    expect(records[0].eventBus).toBe('Other_Bus__e');
    expect(records[0].consumer).toBe('AccountChangeConsumer');
  });

  it('rejects when the DeveloperName is not found', async () => {
    await createPlatformEventSubscription(baseCreateInput(), { sourceDir: tmpDir });

    await expect(
      updatePlatformEventSubscription({ developerName: 'Does_Not_Exist', isActive: false }, { sourceDirs: [tmpDir] }),
    ).rejects.toThrow(expect.objectContaining({ code: 'developer-name-not-found' }) as Error);
  });

  it('rejects when no field besides developerName is given', async () => {
    await createPlatformEventSubscription(baseCreateInput(), { sourceDir: tmpDir });

    await expect(
      updatePlatformEventSubscription({ developerName: 'Account_Change_Subscriber' }, { sourceDirs: [tmpDir] }),
    ).rejects.toThrow(expect.objectContaining({ code: 'no-fields-to-update' }) as Error);
  });

  it('blocks a duplicate-consumer introduced by the update unless force is passed', async () => {
    await createPlatformEventSubscription(baseCreateInput(), { sourceDir: tmpDir });
    await createPlatformEventSubscription(
      baseCreateInput({ developerName: 'Other_Subscriber', consumer: 'OtherConsumer' }),
      { sourceDir: tmpDir },
    );

    await expect(
      updatePlatformEventSubscription(
        { developerName: 'Other_Subscriber', consumer: 'AccountChangeConsumer' },
        { sourceDirs: [tmpDir] },
      ),
    ).rejects.toMatchObject({ code: 'validation-failed' });

    const forced = await updatePlatformEventSubscription(
      { developerName: 'Other_Subscriber', consumer: 'AccountChangeConsumer', force: true },
      { sourceDirs: [tmpDir] },
    );
    expect(forced.issues.some((issue) => issue.rule === 'duplicate-consumer')).toBe(true);
  });

  it('requires at least one of sourceDirs/connection', async () => {
    await expect(updatePlatformEventSubscription({ developerName: 'Anything', isActive: false }, {})).rejects.toThrow(
      expect.objectContaining({ code: 'source-or-target-required' }) as Error,
    );
  });

  it('reports at4dx-not-detected when the local scan finds nothing at all', async () => {
    await expect(
      updatePlatformEventSubscription({ developerName: 'Anything', isActive: false }, { sourceDirs: [tmpDir] }),
    ).rejects.toThrow(expect.objectContaining({ code: 'at4dx-not-detected' }) as Error);
  });

  it("preserves an existing local file's shape (field order, indentation, comment) when only one field changes", async () => {
    const customMetadataDir = path.join(tmpDir, 'customMetadata');
    await fsp.mkdir(customMetadataDir, { recursive: true });
    const filePath = path.join(customMetadataDir, 'PlatformEvents_Subscription.Account_Change_Subscriber.md-meta.xml');
    const existingXml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <label>Account_Change_Subscriber</label>
    <protected>false</protected>
    <!-- hand-authored, non-canonical field order and indentation -->
    <values>
        <field>IsActive__c</field>
        <value xsi:type="xsd:boolean">true</value>
    </values>
    <values>
        <field>MatcherRule__c</field>
        <value xsi:type="xsd:string">MatchEventBus</value>
    </values>
    <values>
        <field>EventBus__c</field>
        <value xsi:type="xsd:string">Account_Change__e</value>
    </values>
    <values>
        <field>Consumer__c</field>
        <value xsi:type="xsd:string">AccountChangeConsumer</value>
    </values>
    <values>
        <field>EventCategory__c</field>
        <value xsi:type="xsd:string">Finance</value>
    </values>
    <values>
        <field>Event__c</field>
        <value xsi:nil="true"/>
    </values>
    <values>
        <field>Execute_Synchronous__c</field>
        <value xsi:type="xsd:boolean">false</value>
    </values>
</CustomMetadata>
`;
    await fsp.writeFile(filePath, existingXml, 'utf-8');

    const result = await updatePlatformEventSubscription(
      { developerName: 'Account_Change_Subscriber', isActive: false },
      { sourceDirs: [tmpDir] },
    );

    expect(result.issues).toEqual([]);
    const writtenXml = await fsp.readFile(filePath, 'utf-8');
    expect(writtenXml).toBe(
      existingXml.replace('<value xsi:type="xsd:boolean">true</value>', '<value xsi:type="xsd:boolean">false</value>'),
    );
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
        { fullName: 'Account_Change_Subscriber', type: 'CustomMetadata', state: ComponentStatus.Created },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const result = await createPlatformEventSubscription(baseCreateInput(), { connection, wait: Duration.minutes(1) });

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
          fullName: 'Account_Change_Subscriber',
          type: 'CustomMetadata',
          state: ComponentStatus.Failed,
          error: 'INVALID_FIELD: bogus',
        },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-platform-event-subscription-write-org-'));
    try {
      await expect(
        createPlatformEventSubscription(baseCreateInput(), {
          sourceDir: tmpDir,
          connection,
          wait: Duration.minutes(1),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: 'deploy-failed' }) as Error);

      const filePath = path.join(
        tmpDir,
        'customMetadata',
        'PlatformEvents_Subscription.Account_Change_Subscriber.md-meta.xml',
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
          DeveloperName: 'Account_Change_Subscriber',
          Label: 'Account Change Subscriber',
          EventBus__c: 'Account_Change__e',
          Consumer__c: 'AccountChangeConsumer',
          EventCategory__c: 'Finance',
          Event__c: null,
          MatcherRule__c: 'MatchEventBus',
          IsActive__c: true,
          Execute_Synchronous__c: false,
        },
      ],
      done: true,
      totalSize: 1,
    } as never);

    const fakeDeployResult = {
      response: { id: '0Af000000000003', status: 'Succeeded', success: true },
      getFileResponses: () => [
        { fullName: 'Account_Change_Subscriber', type: 'CustomMetadata', state: ComponentStatus.Changed },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const result = await updatePlatformEventSubscription(
      { developerName: 'Account_Change_Subscriber', isActive: false },
      { connection, wait: Duration.minutes(1) },
    );

    expect(result.filePath).toBeUndefined();
    expect(result.eventBus).toBe('Account_Change__e');
    expect(result.consumer).toBe('AccountChangeConsumer');
    expect(result.deploy).toEqual({ id: '0Af000000000003', status: 'Succeeded', success: true });
  });
});

describe('PlatformEventSubscriptionWriteError', () => {
  it('carries its error code and optional issues', () => {
    const error = new PlatformEventSubscriptionWriteError('developer-name-not-found', 'not found');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PlatformEventSubscriptionWriteError');
    expect(error.code).toBe('developer-name-not-found');
    expect(error.issues).toBeUndefined();
  });
});
