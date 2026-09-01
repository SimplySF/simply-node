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
import At4dxPlatformEventSubscriptionValidate from '../../../../../../src/commands/simply/aep/at4dx/platform-event-subscription/validate.js';

describe('simply aep at4dx platform-event-subscription validate', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();
  let sourceDir: string;

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(() => {
    process.exitCode = undefined;
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-pes-validate-'));
  });

  afterEach(() => {
    $$.restore();
    process.exitCode = undefined;
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it('should error when neither --target-org nor --source-dir is specified', async () => {
    try {
      await At4dxPlatformEventSubscriptionValidate.run([]);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify either --target-org or --source-dir');
    }
  });

  it('should error when both --target-org and --source-dir are specified', async () => {
    try {
      await At4dxPlatformEventSubscriptionValidate.run(['--target-org', testOrg.username, '--source-dir', sourceDir]);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify either --target-org or --source-dir');
    }
  });

  it('should error when the Custom Metadata Type does not exist in the target org', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').callsFake(async () => {
      const error = new Error('sObject type does not exist');
      error.name = 'INVALID_TYPE';
      throw error;
    });

    try {
      await At4dxPlatformEventSubscriptionValidate.run(['--target-org', testOrg.username]);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include("AT4DX doesn't appear to be present");
    }
  });

  it('should error when local source has no matching CustomMetadata components', async () => {
    try {
      await At4dxPlatformEventSubscriptionValidate.run(['--source-dir', sourceDir]);
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

  it('should leave process.exitCode unset and return no issues for a well-formed record', async () => {
    writeCustomMetadata(
      'PlatformEvents_Subscription.Account_Change_Subscriber.md-meta.xml',
      [
        '  <values><field>EventBus__c</field><value xsi:type="xsd:string">Account_Change__e</value></values>',
        '  <values><field>Consumer__c</field><value xsi:type="xsd:string">AccountChangeConsumer</value></values>',
        '  <values><field>MatcherRule__c</field><value xsi:type="xsd:string">MatchEventBus</value></values>',
        '  <values><field>EventCategory__c</field><value xsi:type="xsd:string">Finance</value></values>',
      ].join('\n'),
    );

    const result = await At4dxPlatformEventSubscriptionValidate.run(['--source-dir', sourceDir, '--json']);

    expect(result.issues).to.deep.equal([]);
    expect(process.exitCode).to.equal(undefined);
  });

  it('should leave process.exitCode unset when only a warning-severity issue is found', async () => {
    writeCustomMetadata(
      'PlatformEvents_Subscription.Account_Change_Subscriber.md-meta.xml',
      [
        '  <values><field>EventBus__c</field><value xsi:type="xsd:string">Account_Change__e</value></values>',
        '  <values><field>Consumer__c</field><value xsi:type="xsd:string">AccountChangeConsumer</value></values>',
        '  <values><field>MatcherRule__c</field><value xsi:type="xsd:string">MatchEventBus</value></values>',
      ].join('\n'),
    );

    const result = await At4dxPlatformEventSubscriptionValidate.run(['--source-dir', sourceDir, '--json']);

    expect(result.issues).to.have.lengthOf(1);
    expect(result.issues[0].severity).to.equal('warning');
    expect(result.issues[0].rule).to.equal('unreachable-subscription');
    expect(process.exitCode).to.equal(undefined);
  });

  it('should set process.exitCode to 1 and still return the full issues array when an error-severity issue is found', async () => {
    writeCustomMetadata(
      'PlatformEvents_Subscription.First.md-meta.xml',
      [
        '  <values><field>EventBus__c</field><value xsi:type="xsd:string">Account_Change__e</value></values>',
        '  <values><field>Consumer__c</field><value xsi:type="xsd:string">SharedConsumer</value></values>',
        '  <values><field>MatcherRule__c</field><value xsi:type="xsd:string">MatchEventBus</value></values>',
        '  <values><field>EventCategory__c</field><value xsi:type="xsd:string">Finance</value></values>',
      ].join('\n'),
    );
    writeCustomMetadata(
      'PlatformEvents_Subscription.Second.md-meta.xml',
      [
        '  <values><field>EventBus__c</field><value xsi:type="xsd:string">Account_Change__e</value></values>',
        '  <values><field>Consumer__c</field><value xsi:type="xsd:string">SharedConsumer</value></values>',
        '  <values><field>MatcherRule__c</field><value xsi:type="xsd:string">MatchEventBus</value></values>',
        '  <values><field>EventCategory__c</field><value xsi:type="xsd:string">Finance</value></values>',
      ].join('\n'),
    );

    const result = await At4dxPlatformEventSubscriptionValidate.run(['--source-dir', sourceDir, '--json']);

    expect(result.issues.filter((issue) => issue.rule === 'duplicate-consumer')).to.have.lengthOf(2);
    expect(process.exitCode).to.equal(1);
  });

  it('should surface a malformed record as a missing-event-bus-or-consumer error', async () => {
    writeCustomMetadata(
      'PlatformEvents_Subscription.Broken.md-meta.xml',
      [
        '  <values><field>EventBus__c</field><value xsi:nil="true"/></values>',
        '  <values><field>Consumer__c</field><value xsi:type="xsd:string">SomeConsumer</value></values>',
        '  <values><field>MatcherRule__c</field><value xsi:type="xsd:string">MatchEventBus</value></values>',
      ].join('\n'),
    );

    const result = await At4dxPlatformEventSubscriptionValidate.run(['--source-dir', sourceDir, '--json']);

    expect(result.issues).to.have.lengthOf(1);
    expect(result.issues[0]).to.deep.include({
      severity: 'error',
      rule: 'missing-event-bus-or-consumer',
      developerName: 'Broken',
    });
    expect(process.exitCode).to.equal(1);
  });
});
