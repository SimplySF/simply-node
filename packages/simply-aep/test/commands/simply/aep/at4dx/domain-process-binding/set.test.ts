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
import At4dxDomainProcessBindingCreate from '../../../../../../src/commands/simply/aep/at4dx/domain-process-binding/create.js';
import At4dxDomainProcessBindingSet from '../../../../../../src/commands/simply/aep/at4dx/domain-process-binding/set.js';

describe('simply aep at4dx domain-process-binding set', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();
  let sourceDir: string;

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(async () => {
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-dpb-set-'));
    await At4dxDomainProcessBindingCreate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'Account_Before_Insert_Test',
      '--sobject',
      'Account',
      '--process-context',
      'TriggerExecution',
      '--trigger-operation',
      'Before_Insert',
      '--type',
      'Action',
      '--class-to-inject',
      'SomeAction',
      '--order',
      '10',
    ]);
  });

  afterEach(() => {
    $$.restore();
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it('errors when neither --source-dir nor --target-org is specified', async () => {
    try {
      await At4dxDomainProcessBindingSet.run(['--developer-name', 'Account_Before_Insert_Test', '--order', '20']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify at least one of --source-dir or --target-org');
    }
  });

  it('errors when no field besides --developer-name is given', async () => {
    try {
      await At4dxDomainProcessBindingSet.run([
        '--source-dir',
        sourceDir,
        '--developer-name',
        'Account_Before_Insert_Test',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('At least one field besides --developer-name');
    }
  });

  it('errors when the DeveloperName is not found', async () => {
    try {
      await At4dxDomainProcessBindingSet.run([
        '--source-dir',
        sourceDir,
        '--developer-name',
        'Does_Not_Exist',
        '--order',
        '20',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('No DomainProcessBinding__mdt record named');
    }
  });

  it('updates only the given field, preserving everything else', async () => {
    const result = await At4dxDomainProcessBindingSet.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'Account_Before_Insert_Test',
      '--order',
      '20',
      '--json',
    ]);

    expect(result.issues).to.deep.equal([]);
    const xml = fs.readFileSync(result.filePath as string, 'utf-8');
    expect(xml).to.include('<field>OrderOfExecution__c</field><value xsi:type="xsd:double">20</value>');
    expect(xml).to.include('<field>ClassToInject__c</field><value xsi:type="xsd:string">SomeAction</value>');
  });

  it("preserves an alternate-field binding's SObject reference field when only an unrelated field changes", async () => {
    await At4dxDomainProcessBindingCreate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'ServiceResource_Before_Update_Sync',
      '--sobject',
      'ServiceResource',
      '--sobject-alternate',
      '--process-context',
      'TriggerExecution',
      '--trigger-operation',
      'Before_Update',
      '--type',
      'Action',
      '--class-to-inject',
      'ServiceResourceSyncAction',
      '--order',
      '10',
    ]);

    const result = await At4dxDomainProcessBindingSet.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'ServiceResource_Before_Update_Sync',
      '--order',
      '99',
      '--json',
    ]);

    const xml = fs.readFileSync(result.filePath as string, 'utf-8');
    expect(xml).to.include(
      '<field>RelatedDomainBindingSObjectAlternate__c</field><value xsi:type="xsd:string">ServiceResource</value>',
    );
    expect(xml).to.include('<field>RelatedDomainBindingSObject__c</field><value xsi:nil="true"/>');
  });

  it('blocks an order-collision introduced by the update unless --force is passed', async () => {
    await At4dxDomainProcessBindingCreate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'Account_Before_Insert_Other',
      '--sobject',
      'Account',
      '--process-context',
      'TriggerExecution',
      '--trigger-operation',
      'Before_Insert',
      '--type',
      'Action',
      '--class-to-inject',
      'OtherAction',
      '--order',
      '20',
    ]);

    try {
      await At4dxDomainProcessBindingSet.run([
        '--source-dir',
        sourceDir,
        '--developer-name',
        'Account_Before_Insert_Other',
        '--order',
        '10',
        '--json',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('wiring problem');
    }

    const forced = await At4dxDomainProcessBindingSet.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'Account_Before_Insert_Other',
      '--order',
      '10',
      '--force',
      '--json',
    ]);
    expect(forced.issues.some((issue) => issue.rule === 'order-collision')).to.equal(true);
  });
});
