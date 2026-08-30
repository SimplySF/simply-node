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
import At4dxFieldSetInclusionCreate from '../../../../../../src/commands/simply/aep/at4dx/field-set-inclusion/create.js';

const BASE_FLAGS = [
  '--developer-name',
  'Account_Contact_Fields',
  '--sobject',
  'Account',
  '--fieldset-name',
  'ContactRelatedFields',
];

describe('simply aep at4dx field-set-inclusion create', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();
  let sourceDir: string;

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(() => {
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-fsi-create-'));
  });

  afterEach(() => {
    $$.restore();
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it('errors when neither --source-dir nor --target-org is specified', async () => {
    try {
      await At4dxFieldSetInclusionCreate.run(BASE_FLAGS);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify at least one of --source-dir or --target-org');
    }
  });

  it('creates a field set inclusion in local source and returns its file path', async () => {
    const result = await At4dxFieldSetInclusionCreate.run(['--source-dir', sourceDir, ...BASE_FLAGS, '--json']);

    expect(result.filePath).to.equal(
      path.join(sourceDir, 'customMetadata', 'SelectorConfig_FieldSetInclusion.Account_Contact_Fields.md-meta.xml'),
    );
    expect(result.issues).to.deep.equal([]);
    expect(fs.existsSync(result.filePath as string)).to.equal(true);
  });

  it('errors when the DeveloperName already exists', async () => {
    await At4dxFieldSetInclusionCreate.run(['--source-dir', sourceDir, ...BASE_FLAGS, '--json']);

    try {
      await At4dxFieldSetInclusionCreate.run(['--source-dir', sourceDir, ...BASE_FLAGS, '--json']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('already exists');
    }
  });

  it('blocks an unsupported-entity-definition-object without --force and writes it with --force', async () => {
    const colliding = [
      '--source-dir',
      sourceDir,
      '--developer-name',
      'ServiceResource_Skills',
      '--sobject',
      'ServiceResource',
      '--fieldset-name',
      'SkillFields',
      '--json',
    ];

    try {
      await At4dxFieldSetInclusionCreate.run(colliding);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('wiring problem');
    }

    const forced = await At4dxFieldSetInclusionCreate.run([...colliding, '--force']);
    expect(forced.issues.some((issue) => issue.rule === 'unsupported-entity-definition-object')).to.equal(true);
  });

  it('writes BindingSObjectAlternate__c when --sobject-alternate is passed', async () => {
    const result = await At4dxFieldSetInclusionCreate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'ServiceResource_Skills',
      '--sobject',
      'ServiceResource',
      '--sobject-alternate',
      '--fieldset-name',
      'SkillFields',
      '--json',
    ]);

    const xml = fs.readFileSync(result.filePath as string, 'utf-8');

    expect(xml).to.include(
      '<field>BindingSObjectAlternate__c</field><value xsi:type="xsd:string">ServiceResource</value>',
    );

    expect(xml).to.include('<field>BindingSObject__c</field><value xsi:nil="true"/>');
  });

  it('writes IsActive__c false when --no-active is passed', async () => {
    const result = await At4dxFieldSetInclusionCreate.run([
      '--source-dir',
      sourceDir,
      ...BASE_FLAGS,
      '--no-active',
      '--json',
    ]);

    const xml = fs.readFileSync(result.filePath as string, 'utf-8');

    expect(xml).to.include('<field>IsActive__c</field><value xsi:type="xsd:boolean">false</value>');
  });

  it('deploys to --target-org when given', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({ records: [], done: true, totalSize: 0 });
    const fakeDeployResult = {
      response: { id: '0Af000000000009', status: 'Succeeded', success: true },
      getFileResponses: () => [
        { fullName: 'Account_Contact_Fields', type: 'CustomMetadata', state: ComponentStatus.Created },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const result = await At4dxFieldSetInclusionCreate.run(['--target-org', testOrg.username, ...BASE_FLAGS, '--json']);

    expect(result.filePath).to.equal(undefined);
    expect(result.deploy).to.deep.equal({ id: '0Af000000000009', status: 'Succeeded', success: true });
  });
});
