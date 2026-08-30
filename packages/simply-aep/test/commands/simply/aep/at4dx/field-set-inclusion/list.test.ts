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
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import At4dxFieldSetInclusionList from '../../../../../../src/commands/simply/aep/at4dx/field-set-inclusion/list.js';

/* eslint-disable camelcase -- AT4DX Custom Metadata field API names (BindingSObject__c, FieldsetName__c, etc.) */

describe('simply aep at4dx field-set-inclusion list', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  it('should error when neither --target-org nor --source-dir is specified', async () => {
    try {
      await At4dxFieldSetInclusionList.run([]);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify either --target-org or --source-dir');
    }
  });

  it('should error when both --target-org and --source-dir are specified', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-fsi-list-'));
    try {
      await At4dxFieldSetInclusionList.run(['--target-org', testOrg.username, '--source-dir', directory]);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify either --target-org or --source-dir');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('should error when the Custom Metadata Type does not exist in the target org', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').callsFake(async () => {
      const error = new Error('sObject type does not exist');
      error.name = 'INVALID_TYPE';
      throw error;
    });

    try {
      await At4dxFieldSetInclusionList.run(['--target-org', testOrg.username]);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include("AT4DX doesn't appear to be present");
    }
  });

  it('should list field set inclusions queried from an org', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      records: [
        {
          DeveloperName: 'Account_Contact_Fields',
          Label: 'Account Contact Fields',
          BindingSObject__c: '01I000000000001',
          BindingSObject__r: { QualifiedApiName: 'Account' },
          BindingSObjectAlternate__c: null,
          FieldsetName__c: 'ContactRelatedFields',
          IsActive__c: true,
        },
      ],
      done: true,
      totalSize: 1,
    } as never);

    const result = await At4dxFieldSetInclusionList.run(['--target-org', testOrg.username, '--json']);

    expect(result.source).to.equal(testOrg.username);
    expect(result.records).to.have.lengthOf(1);
    expect(result.records[0]).to.include({ developerName: 'Account_Contact_Fields', sobject: 'Account' });
  });

  it('should list field set inclusions scanned from local source', async () => {
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-fsi-list-local-'));
    try {
      const customMetadataDir = path.join(sourceDir, 'customMetadata');
      fs.mkdirSync(customMetadataDir, { recursive: true });
      fs.writeFileSync(
        path.join(customMetadataDir, 'SelectorConfig_FieldSetInclusion.Account_Contact_Fields.md-meta.xml'),
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
          '  <label>Account Contact Fields</label>',
          '  <protected>false</protected>',
          '  <values><field>BindingSObject__c</field><value xsi:type="xsd:string">Account</value></values>',
          '  <values><field>FieldsetName__c</field><value xsi:type="xsd:string">ContactRelatedFields</value></values>',
          '</CustomMetadata>',
          '',
        ].join('\n'),
      );

      const result = await At4dxFieldSetInclusionList.run(['--source-dir', sourceDir, '--json']);

      expect(result.source).to.equal('local');
      expect(result.records).to.have.lengthOf(1);
      expect(result.records[0].fieldsetName).to.equal('ContactRelatedFields');
    } finally {
      fs.rmSync(sourceDir, { recursive: true, force: true });
    }
  });

  it('should error when local source has no matching CustomMetadata components', async () => {
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-fsi-list-empty-'));
    try {
      await At4dxFieldSetInclusionList.run(['--source-dir', sourceDir]);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include("AT4DX doesn't appear to be present");
    } finally {
      fs.rmSync(sourceDir, { recursive: true, force: true });
    }
  });
});
