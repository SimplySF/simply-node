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
import { Connection, SfError } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import sinon from 'sinon';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import At4dxPlatformEventSubscriptionSimulate from '../../../../../../src/commands/simply/aep/at4dx/platform-event-subscription/simulate.js';

describe('simply aep at4dx platform-event-subscription simulate', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();
  let sourceDir: string;

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(() => {
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-pes-simulate-'));
  });

  afterEach(() => {
    $$.restore();
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it('should error when neither --target-org nor --source-dir is specified', async () => {
    try {
      await At4dxPlatformEventSubscriptionSimulate.run(['--event-bus', 'Account_Change__e']);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify either --target-org or --source-dir');
    }
  });

  it('should error when both --target-org and --source-dir are specified', async () => {
    try {
      await At4dxPlatformEventSubscriptionSimulate.run([
        '--target-org',
        testOrg.username,
        '--source-dir',
        sourceDir,
        '--event-bus',
        'Account_Change__e',
      ]);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify either --target-org or --source-dir');
    }
  });

  it('should error when --event-bus is not specified', async () => {
    try {
      await At4dxPlatformEventSubscriptionSimulate.run(['--source-dir', sourceDir]);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include('event-bus');
    }
  });

  it('should error when the Custom Metadata Type does not exist in the target org', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').callsFake(async () => {
      const error = new Error('sObject type does not exist');
      error.name = 'INVALID_TYPE';
      throw error;
    });

    try {
      await At4dxPlatformEventSubscriptionSimulate.run([
        '--target-org',
        testOrg.username,
        '--event-bus',
        'Account_Change__e',
      ]);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include("AT4DX doesn't appear to be present");
    }
  });

  it('should error when local source has no matching CustomMetadata components', async () => {
    try {
      await At4dxPlatformEventSubscriptionSimulate.run(['--source-dir', sourceDir, '--event-bus', 'Account_Change__e']);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include("AT4DX doesn't appear to be present");
    }
  });

  function writeCustomMetadata(fileName: string, values: string): void {
    const dir = path.join(sourceDir, 'customMetadata');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, fileName),
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
        '  <label>Test</label>',
        '  <protected>false</protected>',
        values,
        '</CustomMetadata>',
        '',
      ].join('\n'),
    );
  }

  it('matches a MatchEventBus subscription once the pre-filter and bus align', async () => {
    writeCustomMetadata(
      'PlatformEvents_Subscription.Account_Change_Subscriber.md-meta.xml',
      [
        '  <values><field>EventBus__c</field><value xsi:type="xsd:string">Account_Change__e</value></values>',
        '  <values><field>Consumer__c</field><value xsi:type="xsd:string">AccountChangeConsumer</value></values>',
        '  <values><field>MatcherRule__c</field><value xsi:type="xsd:string">MatchEventBus</value></values>',
        '  <values><field>EventCategory__c</field><value xsi:type="xsd:string">Finance</value></values>',
        '  <values><field>Execute_Synchronous__c</field><value xsi:type="xsd:boolean">true</value></values>',
      ].join('\n'),
    );

    const result = await At4dxPlatformEventSubscriptionSimulate.run([
      '--source-dir',
      sourceDir,
      '--event-bus',
      'Account_Change__e',
      '--category',
      'Finance',
      '--json',
    ]);

    expect(result.matches).to.have.lengthOf(1);
    expect(result.matches[0]).to.deep.include({
      developerName: 'Account_Change_Subscriber',
      consumer: 'AccountChangeConsumer',
      eventBus: 'Account_Change__e',
      executeSynchronous: true,
    });
    expect(result.misses).to.deep.equal([]);
  });

  it('misses a record on a different event bus without reporting it at all', async () => {
    writeCustomMetadata(
      'PlatformEvents_Subscription.Other.md-meta.xml',
      [
        '  <values><field>EventBus__c</field><value xsi:type="xsd:string">Other_Bus__e</value></values>',
        '  <values><field>Consumer__c</field><value xsi:type="xsd:string">OtherConsumer</value></values>',
        '  <values><field>MatcherRule__c</field><value xsi:type="xsd:string">MatchEventBus</value></values>',
        '  <values><field>EventCategory__c</field><value xsi:type="xsd:string">Finance</value></values>',
      ].join('\n'),
    );

    const result = await At4dxPlatformEventSubscriptionSimulate.run([
      '--source-dir',
      sourceDir,
      '--event-bus',
      'Account_Change__e',
      '--category',
      'Finance',
      '--json',
    ]);

    expect(result.matches).to.deep.equal([]);
    expect(result.misses).to.deep.equal([]);
  });

  it('misses a record whose matcher rule dereferences a blank field, with reason matcher-rule-missing-field', async () => {
    writeCustomMetadata(
      'PlatformEvents_Subscription.Broken.md-meta.xml',
      [
        '  <values><field>EventBus__c</field><value xsi:type="xsd:string">Account_Change__e</value></values>',
        '  <values><field>Consumer__c</field><value xsi:type="xsd:string">BrokenConsumer</value></values>',
        '  <values><field>MatcherRule__c</field><value xsi:type="xsd:string">MatchEventBusAndCategory</value></values>',
        '  <values><field>Event__c</field><value xsi:type="xsd:string">AccountUpdated</value></values>',
      ].join('\n'),
    );

    const result = await At4dxPlatformEventSubscriptionSimulate.run([
      '--source-dir',
      sourceDir,
      '--event-bus',
      'Account_Change__e',
      '--event-name',
      'AccountUpdated',
      '--json',
    ]);

    expect(result.matches).to.deep.equal([]);
    expect(result.misses).to.have.lengthOf(1);
    expect(result.misses[0]).to.deep.include({
      developerName: 'Broken',
      reason: 'matcher-rule-missing-field',
    });
  });
});
