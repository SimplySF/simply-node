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
import { ComponentSet, ComponentStatus } from '@salesforce/source-deploy-retrieve';
import sinon from 'sinon';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import At4dxDomainProcessBindingCreate from '../../../../../../src/commands/simply/aep/at4dx/domain-process-binding/create.js';

const REQUIRED_FLAGS = [
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
];

describe('simply aep at4dx domain-process-binding create', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();
  let sourceDir: string;

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(() => {
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-dpb-create-'));
  });

  afterEach(() => {
    $$.restore();
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it('errors when neither --source-dir nor --target-org is specified', async () => {
    try {
      await At4dxDomainProcessBindingCreate.run(REQUIRED_FLAGS);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify at least one of --source-dir or --target-org');
    }
  });

  it('errors when --trigger-operation is missing for a TriggerExecution context', async () => {
    try {
      await At4dxDomainProcessBindingCreate.run([
        '--source-dir',
        sourceDir,
        '--developer-name',
        'Account_Before_Insert_Test',
        '--sobject',
        'Account',
        '--process-context',
        'TriggerExecution',
        '--type',
        'Action',
        '--class-to-inject',
        'SomeAction',
        '--order',
        '10',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('--trigger-operation is required');
    }
  });

  it('errors on a non-numeric --order', async () => {
    try {
      await At4dxDomainProcessBindingCreate.run([
        '--source-dir',
        sourceDir,
        ...REQUIRED_FLAGS.slice(0, REQUIRED_FLAGS.length - 1),
        'not-a-number',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('not a valid --order');
    }
  });

  it('creates a binding in local source and returns its file path', async () => {
    const result = await At4dxDomainProcessBindingCreate.run(['--source-dir', sourceDir, ...REQUIRED_FLAGS, '--json']);

    expect(result.filePath).to.equal(
      path.join(sourceDir, 'customMetadata', 'DomainProcessBinding.Account_Before_Insert_Test.md-meta.xml'),
    );
    expect(result.issues).to.deep.equal([]);
    expect(fs.existsSync(result.filePath as string)).to.equal(true);
  });

  it('errors when the DeveloperName already exists', async () => {
    await At4dxDomainProcessBindingCreate.run(['--source-dir', sourceDir, ...REQUIRED_FLAGS, '--json']);

    try {
      await At4dxDomainProcessBindingCreate.run(['--source-dir', sourceDir, ...REQUIRED_FLAGS, '--json']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('already exists');
    }
  });

  it('blocks an order-collision without --force and writes it with --force', async () => {
    await At4dxDomainProcessBindingCreate.run(['--source-dir', sourceDir, ...REQUIRED_FLAGS, '--json']);

    const colliding = [
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
      '10',
      '--json',
    ];

    try {
      await At4dxDomainProcessBindingCreate.run(colliding);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('wiring problem');
    }

    const forced = await At4dxDomainProcessBindingCreate.run([...colliding, '--force']);
    expect(forced.issues.some((issue) => issue.rule === 'order-collision')).to.equal(true);
  });

  it('writes RelatedDomainBindingSObjectAlternate__c when --sobject-alternate is passed', async () => {
    const result = await At4dxDomainProcessBindingCreate.run([
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
      '--json',
    ]);

    const xml = fs.readFileSync(result.filePath as string, 'utf-8');
    expect(xml).to.include(
      '<field>RelatedDomainBindingSObjectAlternate__c</field><value xsi:type="xsd:string">ServiceResource</value>',
    );
    expect(xml).to.include('<field>RelatedDomainBindingSObject__c</field><value xsi:nil="true"/>');
  });

  it('deploys to --target-org when given', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({ records: [], done: true, totalSize: 0 });
    const fakeDeployResult = {
      response: { id: '0Af000000000009', status: 'Succeeded', success: true },
      getFileResponses: () => [
        { fullName: 'Account_Before_Insert_Test', type: 'CustomMetadata', state: ComponentStatus.Created },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const result = await At4dxDomainProcessBindingCreate.run([
      '--target-org',
      testOrg.username,
      ...REQUIRED_FLAGS,
      '--json',
    ]);

    expect(result.filePath).to.equal(undefined);
    expect(result.deploy).to.deep.equal({ id: '0Af000000000009', status: 'Succeeded', success: true });
  });
});
