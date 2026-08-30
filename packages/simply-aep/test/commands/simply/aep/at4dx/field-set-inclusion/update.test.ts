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
import At4dxFieldSetInclusionCreate from '../../../../../../src/commands/simply/aep/at4dx/field-set-inclusion/create.js';
import At4dxFieldSetInclusionUpdate from '../../../../../../src/commands/simply/aep/at4dx/field-set-inclusion/update.js';

describe('simply aep at4dx field-set-inclusion update', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();
  let sourceDir: string;

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(async () => {
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-fsi-update-'));
    await At4dxFieldSetInclusionCreate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'Account_Contact_Fields',
      '--sobject',
      'Account',
      '--fieldset-name',
      'ContactRelatedFields',
    ]);
  });

  afterEach(() => {
    $$.restore();
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it('errors when neither --source-dir nor --target-org is specified', async () => {
    try {
      await At4dxFieldSetInclusionUpdate.run(['--developer-name', 'Account_Contact_Fields', '--no-active']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify at least one of --source-dir or --target-org');
    }
  });

  it('errors when no field besides --developer-name is given', async () => {
    try {
      await At4dxFieldSetInclusionUpdate.run(['--source-dir', sourceDir, '--developer-name', 'Account_Contact_Fields']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('At least one field besides --developer-name');
    }
  });

  it('errors when the DeveloperName is not found', async () => {
    try {
      await At4dxFieldSetInclusionUpdate.run([
        '--source-dir',
        sourceDir,
        '--developer-name',
        'Does_Not_Exist',
        '--no-active',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('No SelectorConfig_FieldSetInclusion__mdt record named');
    }
  });

  it('updates only the given field, preserving everything else', async () => {
    const result = await At4dxFieldSetInclusionUpdate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'Account_Contact_Fields',
      '--no-active',
      '--json',
    ]);

    expect(result.issues).to.deep.equal([]);
    const xml = fs.readFileSync(result.filePath as string, 'utf-8');

    expect(xml).to.include('<field>IsActive__c</field><value xsi:type="xsd:boolean">false</value>');

    expect(xml).to.include('<field>FieldsetName__c</field><value xsi:type="xsd:string">ContactRelatedFields</value>');
  });

  it("preserves an alternate-field record's key field when only an unrelated field changes", async () => {
    await At4dxFieldSetInclusionCreate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'ServiceResource_Skills',
      '--sobject',
      'ServiceResource',
      '--sobject-alternate',
      '--fieldset-name',
      'SkillFields',
    ]);

    const result = await At4dxFieldSetInclusionUpdate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'ServiceResource_Skills',
      '--no-active',
      '--json',
    ]);

    const xml = fs.readFileSync(result.filePath as string, 'utf-8');

    expect(xml).to.include(
      '<field>BindingSObjectAlternate__c</field><value xsi:type="xsd:string">ServiceResource</value>',
    );

    expect(xml).to.include('<field>BindingSObject__c</field><value xsi:nil="true"/>');
  });

  it('blocks a duplicate-fieldset-name introduced by the update unless --force is passed', async () => {
    await At4dxFieldSetInclusionCreate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'Contact_Fields',
      '--sobject',
      'Contact',
      '--fieldset-name',
      'OtherFields',
    ]);

    try {
      await At4dxFieldSetInclusionUpdate.run([
        '--source-dir',
        sourceDir,
        '--developer-name',
        'Contact_Fields',
        '--fieldset-name',
        'ContactRelatedFields',
        '--json',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('wiring problem');
    }

    const forced = await At4dxFieldSetInclusionUpdate.run([
      '--source-dir',
      sourceDir,
      '--developer-name',
      'Contact_Fields',
      '--fieldset-name',
      'ContactRelatedFields',
      '--force',
      '--json',
    ]);
    expect(forced.issues.some((issue) => issue.rule === 'duplicate-fieldset-name')).to.equal(true);
  });
});
