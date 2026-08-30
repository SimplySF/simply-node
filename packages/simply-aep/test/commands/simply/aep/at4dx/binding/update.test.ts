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
import At4dxBindingCreate from '../../../../../../src/commands/simply/aep/at4dx/binding/create.js';
import At4dxBindingUpdate from '../../../../../../src/commands/simply/aep/at4dx/binding/update.js';

describe('simply aep at4dx binding update', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();
  let sourceDir: string;

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(async () => {
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-binding-update-'));
    await At4dxBindingCreate.run([
      '--source-dir',
      sourceDir,
      '--type',
      'selector',
      '--developer-name',
      'Account_Selector',
      '--sobject',
      'Account',
      '--to',
      'AccountsSelector',
      '--priority',
      '1',
    ]);
  });

  afterEach(() => {
    $$.restore();
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it('errors when neither --source-dir nor --target-org is specified', async () => {
    try {
      await At4dxBindingUpdate.run(['--type', 'selector', '--developer-name', 'Account_Selector', '--priority', '5']);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify at least one of --source-dir or --target-org');
    }
  });

  it('errors when no field besides --developer-name is given', async () => {
    try {
      await At4dxBindingUpdate.run([
        '--source-dir',
        sourceDir,
        '--type',
        'selector',
        '--developer-name',
        'Account_Selector',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('At least one field besides --developer-name');
    }
  });

  it('errors when the DeveloperName is not found', async () => {
    try {
      await At4dxBindingUpdate.run([
        '--source-dir',
        sourceDir,
        '--type',
        'selector',
        '--developer-name',
        'Does_Not_Exist',
        '--priority',
        '5',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('No ApplicationFactory_SelectorBinding__mdt record named');
    }
  });

  it('updates only the given field, preserving everything else', async () => {
    const result = await At4dxBindingUpdate.run([
      '--source-dir',
      sourceDir,
      '--type',
      'selector',
      '--developer-name',
      'Account_Selector',
      '--priority',
      '5',
      '--json',
    ]);

    expect(result.issues).to.deep.equal([]);
    const xml = fs.readFileSync(result.filePath as string, 'utf-8');
    expect(xml).to.include('<field>Priority__c</field><value xsi:type="xsd:double">5</value>');
    expect(xml).to.include('<field>To__c</field><value xsi:type="xsd:string">AccountsSelector</value>');
  });

  it("preserves an alternate-field binding's key field when only an unrelated field changes", async () => {
    await At4dxBindingCreate.run([
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
    ]);

    const result = await At4dxBindingUpdate.run([
      '--source-dir',
      sourceDir,
      '--type',
      'selector',
      '--developer-name',
      'ServiceResource_Selector',
      '--priority',
      '9',
      '--json',
    ]);

    const xml = fs.readFileSync(result.filePath as string, 'utf-8');
    expect(xml).to.include(
      '<field>BindingSObjectAlternate__c</field><value xsi:type="xsd:string">ServiceResource</value>',
    );
    expect(xml).to.include('<field>BindingSObject__c</field><value xsi:nil="true"/>');
  });

  it('blocks a duplicate-to introduced by the update unless --force is passed', async () => {
    await At4dxBindingCreate.run([
      '--source-dir',
      sourceDir,
      '--type',
      'selector',
      '--developer-name',
      'Contact_Selector',
      '--sobject',
      'Contact',
      '--to',
      'ContactsSelector',
    ]);

    try {
      await At4dxBindingUpdate.run([
        '--source-dir',
        sourceDir,
        '--type',
        'selector',
        '--developer-name',
        'Contact_Selector',
        '--to',
        'AccountsSelector',
        '--json',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).message).to.include('wiring problem');
    }

    const forced = await At4dxBindingUpdate.run([
      '--source-dir',
      sourceDir,
      '--type',
      'selector',
      '--developer-name',
      'Contact_Selector',
      '--to',
      'AccountsSelector',
      '--force',
      '--json',
    ]);
    expect(forced.issues.some((issue) => issue.rule === 'duplicate-to')).to.equal(true);
  });
});
