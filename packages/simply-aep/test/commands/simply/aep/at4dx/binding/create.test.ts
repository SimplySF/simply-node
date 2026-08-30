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
import At4dxBindingCreate from '../../../../../../src/commands/simply/aep/at4dx/binding/create.js';

const SELECTOR_FLAGS = [
  '--type',
  'selector',
  '--developer-name',
  'Account_Selector',
  '--sobject',
  'Account',
  '--to',
  'AccountsSelector',
];

describe('simply aep at4dx binding create', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();
  let sourceDir: string;

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(() => {
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-binding-create-'));
  });

  afterEach(() => {
    $$.restore();
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it('errors when neither --source-dir nor --target-org is specified', async () => {
    try {
      await At4dxBindingCreate.run(SELECTOR_FLAGS);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify at least one of --source-dir or --target-org');
    }
  });

  it('errors on a non-numeric --priority', async () => {
    try {
      await At4dxBindingCreate.run(['--source-dir', sourceDir, ...SELECTOR_FLAGS, '--priority', 'not-a-number']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('not a valid --priority');
    }
  });

  it('errors on a non-numeric --sequence', async () => {
    try {
      await At4dxBindingCreate.run([
        '--source-dir',
        sourceDir,
        '--type',
        'unit-of-work',
        '--developer-name',
        'Account_UOW',
        '--sobject',
        'Account',
        '--sequence',
        'not-a-number',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('not a valid --sequence');
    }
  });

  it('errors when --type selector is given with no --to', async () => {
    try {
      await At4dxBindingCreate.run([
        '--source-dir',
        sourceDir,
        '--type',
        'selector',
        '--developer-name',
        'Account_Selector',
        '--sobject',
        'Account',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('to is required');
    }
  });

  it('creates a UnitOfWork binding with --sequence and no --to', async () => {
    const result = await At4dxBindingCreate.run([
      '--source-dir',
      sourceDir,
      '--type',
      'unit-of-work',
      '--developer-name',
      'Account_UOW',
      '--sobject',
      'Account',
      '--sequence',
      '10',
      '--json',
    ]);

    expect(result.filePath).to.equal(
      path.join(sourceDir, 'customMetadata', 'ApplicationFactory_UnitOfWorkBinding.Account_UOW.md-meta.xml'),
    );
    expect(result.issues).to.deep.equal([]);
    const xml = fs.readFileSync(result.filePath as string, 'utf-8');
    expect(xml).to.include('<field>BindingSequence__c</field><value xsi:type="xsd:double">10</value>');
    expect(xml).not.to.include('To__c');
  });

  it('errors when --to is given with --type unit-of-work', async () => {
    try {
      await At4dxBindingCreate.run([
        '--source-dir',
        sourceDir,
        '--type',
        'unit-of-work',
        '--developer-name',
        'Account_UOW',
        '--sobject',
        'Account',
        '--to',
        'SomeImpl',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('to cannot be set');
    }
  });

  it('creates a Selector binding in local source and returns its file path', async () => {
    const result = await At4dxBindingCreate.run(['--source-dir', sourceDir, ...SELECTOR_FLAGS, '--json']);

    expect(result.filePath).to.equal(
      path.join(sourceDir, 'customMetadata', 'ApplicationFactory_SelectorBinding.Account_Selector.md-meta.xml'),
    );
    expect(result.issues).to.deep.equal([]);
    expect(fs.existsSync(result.filePath as string)).to.equal(true);
  });

  it('creates a Service binding using --binding-interface', async () => {
    const result = await At4dxBindingCreate.run([
      '--source-dir',
      sourceDir,
      '--type',
      'service',
      '--developer-name',
      'My_Service',
      '--binding-interface',
      'IMyService',
      '--to',
      'MyServiceImpl',
      '--json',
    ]);

    expect(result.filePath).to.equal(
      path.join(sourceDir, 'customMetadata', 'ApplicationFactory_ServiceBinding.My_Service.md-meta.xml'),
    );
  });

  it('errors when --sobject is given with --type service', async () => {
    try {
      await At4dxBindingCreate.run([
        '--source-dir',
        sourceDir,
        '--type',
        'service',
        '--developer-name',
        'My_Service',
        '--sobject',
        'Account',
        '--to',
        'MyServiceImpl',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('sobject');
    }
  });

  it('errors when the DeveloperName already exists (same --type)', async () => {
    await At4dxBindingCreate.run(['--source-dir', sourceDir, ...SELECTOR_FLAGS, '--json']);

    try {
      await At4dxBindingCreate.run(['--source-dir', sourceDir, ...SELECTOR_FLAGS, '--json']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('already exists');
    }
  });

  it('blocks an unsupported-entity-definition-object without --force and writes it with --force', async () => {
    const colliding = [
      '--source-dir',
      sourceDir,
      '--type',
      'selector',
      '--developer-name',
      'ServiceResource_Selector',
      '--sobject',
      'ServiceResource',
      '--to',
      'ServiceResourceSelector',
      '--json',
    ];

    try {
      await At4dxBindingCreate.run(colliding);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('wiring problem');
    }

    const forced = await At4dxBindingCreate.run([...colliding, '--force']);
    expect(forced.issues.some((issue) => issue.rule === 'unsupported-entity-definition-object')).to.equal(true);
  });

  it('writes BindingSObjectAlternate__c when --sobject-alternate is passed', async () => {
    const result = await At4dxBindingCreate.run([
      '--source-dir',
      sourceDir,
      '--type',
      'selector',
      '--developer-name',
      'ServiceResource_Selector',
      '--sobject',
      'ServiceResource',
      '--sobject-alternate',
      '--to',
      'ServiceResourceSelector',
      '--json',
    ]);

    const xml = fs.readFileSync(result.filePath as string, 'utf-8');
    expect(xml).to.include(
      '<field>BindingSObjectAlternate__c</field><value xsi:type="xsd:string">ServiceResource</value>',
    );
    expect(xml).to.include('<field>BindingSObject__c</field><value xsi:nil="true"/>');
  });

  it('deploys to --target-org when given', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({ records: [], done: true, totalSize: 0 });
    const fakeDeployResult = {
      response: { id: '0Af000000000009', status: 'Succeeded', success: true },
      getFileResponses: () => [
        { fullName: 'Account_Selector', type: 'CustomMetadata', state: ComponentStatus.Created },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const result = await At4dxBindingCreate.run(['--target-org', testOrg.username, ...SELECTOR_FLAGS, '--json']);

    expect(result.filePath).to.equal(undefined);
    expect(result.deploy).to.deep.equal({ id: '0Af000000000009', status: 'Succeeded', success: true });
  });
});
