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
import { SfError } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import sinon from 'sinon';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import At4dxPlatformEventSubscriptionCreate from '../../../../../../src/commands/simply/aep/at4dx/platform-event-subscription/create.js';
import At4dxPlatformEventSubscriptionUpdate from '../../../../../../src/commands/simply/aep/at4dx/platform-event-subscription/update.js';

describe('simply aep at4dx platform-event-subscription update', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();
  let sourceDir: string;

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(async () => {
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-pes-update-'));
    await At4dxPlatformEventSubscriptionCreate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'Account_Change_Subscriber',
      '--event-bus',
      'Account_Change__e',
      '--consumer',
      'AccountChangeConsumer',
      '--matcher-rule',
      'MatchCategory',
      '--event-category',
      'Finance',
    ]);
  });

  afterEach(() => {
    $$.restore();
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it('errors when neither --source-dir nor --target-org is specified', async () => {
    try {
      await At4dxPlatformEventSubscriptionUpdate.run(['--developer-name', 'Account_Change_Subscriber', '--no-active']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify at least one of --source-dir or --target-org');
    }
  });

  it('errors when no field besides --developer-name is given', async () => {
    try {
      await At4dxPlatformEventSubscriptionUpdate.run([
        '--source-dir',
        sourceDir,
        '--developer-name',
        'Account_Change_Subscriber',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('At least one field besides --developer-name');
    }
  });

  it('errors when the DeveloperName is not found', async () => {
    try {
      await At4dxPlatformEventSubscriptionUpdate.run([
        '--source-dir',
        sourceDir,
        '--developer-name',
        'Does_Not_Exist',
        '--no-active',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('No PlatformEvents_Subscription__mdt record named');
    }
  });

  it('updates only the given field, preserving everything else', async () => {
    const result = await At4dxPlatformEventSubscriptionUpdate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'Account_Change_Subscriber',
      '--no-active',
      '--json',
    ]);

    expect(result.issues).to.deep.equal([]);
    const xml = fs.readFileSync(result.filePath as string, 'utf-8');

    expect(xml).to.include('<field>IsActive__c</field><value xsi:type="xsd:boolean">false</value>');
    expect(xml).to.include('<field>Consumer__c</field><value xsi:type="xsd:string">AccountChangeConsumer</value>');
  });

  it('changes Consumer__c as an ordinary value change, not a create-plus-delete', async () => {
    const result = await At4dxPlatformEventSubscriptionUpdate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'Account_Change_Subscriber',
      '--consumer',
      'NewConsumer',
      '--json',
    ]);

    expect(result.developerName).to.equal('Account_Change_Subscriber');
    expect(result.consumer).to.equal('NewConsumer');
    const xml = fs.readFileSync(result.filePath as string, 'utf-8');
    expect(xml).to.include('<field>Consumer__c</field><value xsi:type="xsd:string">NewConsumer</value>');
  });

  it('blocks a duplicate-consumer introduced by the update unless --force is passed', async () => {
    await At4dxPlatformEventSubscriptionCreate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'Other_Subscriber',
      '--event-bus',
      'Account_Change__e',
      '--consumer',
      'OtherConsumer',
      '--matcher-rule',
      'MatchCategory',
      '--event-category',
      'Finance',
    ]);

    try {
      await At4dxPlatformEventSubscriptionUpdate.run([
        '--source-dir',
        sourceDir,
        '--developer-name',
        'Other_Subscriber',
        '--consumer',
        'AccountChangeConsumer',
        '--json',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('wiring problem');
    }

    const forced = await At4dxPlatformEventSubscriptionUpdate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'Other_Subscriber',
      '--consumer',
      'AccountChangeConsumer',
      '--force',
      '--json',
    ]);
    expect(forced.issues.some((issue) => issue.rule === 'duplicate-consumer')).to.equal(true);
  });
});
