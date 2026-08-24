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
import At4dxDomainProcessBindingList from '../../../../../../src/commands/simply/aep/at4dx/domain-process-binding/list.js';

/* eslint-disable camelcase -- AT4DX Custom Metadata field API names (ClassToInject__c, TriggerOperation__c, etc.) */

describe('simply aep at4dx domain-process-binding list', () => {
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
      await At4dxDomainProcessBindingList.run([]);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include('You must specify either --target-org or --source-dir');
    }
  });

  it('should error when both --target-org and --source-dir are specified', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-dpb-list-'));
    try {
      await At4dxDomainProcessBindingList.run(['--target-org', testOrg.username, '--source-dir', directory]);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include('You must specify either --target-org or --source-dir');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("should error when DomainProcessBinding__mdt doesn't exist in the target org", async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').callsFake(async () => {
      const error = new Error('sObject type does not exist');
      error.name = 'INVALID_TYPE';
      throw error;
    });

    try {
      await At4dxDomainProcessBindingList.run(['--target-org', testOrg.username]);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include("doesn't appear to be present");
    }
  });

  it('should sort bindings by order and flag order collisions when queried from an org', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').callsFake(
      async () =>
        ({
          records: [
            {
              DeveloperName: 'Account_Action_Two',
              RelatedDomainBindingSObject__c: null,
              RelatedDomainBindingSObject__r: null,
              RelatedDomainBindingSObjectAlternate__c: 'Account',
              ProcessContext__c: 'TriggerExecution',
              TriggerOperation__c: 'Before_Insert',
              DomainMethodToken__c: null,
              Type__c: 'Action',
              ClassToInject__c: 'AccountActionTwo',
              OrderOfExecution__c: 1,
              IsActive__c: true,
              ExecuteAsynchronous__c: false,
              LogicalInverse__c: false,
              PreventRecursive__c: false,
              Description__c: null,
            },
            {
              DeveloperName: 'Account_Action_One',
              RelatedDomainBindingSObject__c: null,
              RelatedDomainBindingSObject__r: null,
              RelatedDomainBindingSObjectAlternate__c: 'Account',
              ProcessContext__c: 'TriggerExecution',
              TriggerOperation__c: 'Before_Insert',
              DomainMethodToken__c: null,
              Type__c: 'Action',
              ClassToInject__c: 'AccountActionOne',
              OrderOfExecution__c: 1,
              IsActive__c: true,
              ExecuteAsynchronous__c: false,
              LogicalInverse__c: false,
              PreventRecursive__c: false,
              Description__c: null,
            },
          ],
          done: true,
          totalSize: 2,
        }) as never,
    );

    const result = await At4dxDomainProcessBindingList.run(['--target-org', testOrg.username, '--json']);

    expect(result.source).to.equal(testOrg.username);
    expect(result.bindings).to.have.lengthOf(2);
    expect(result.bindings.every((row) => row.orderCollision === true)).to.equal(true);
  });

  it('should resolve bindings sorted by order from local source', async () => {
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-dpb-list-local-'));
    try {
      const customMetadataDir = path.join(sourceDir, 'customMetadata');
      fs.mkdirSync(customMetadataDir, { recursive: true });

      const xml = (developerName: string, order: number, type: string): string =>
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
          `  <label>${developerName}</label>`,
          '  <protected>false</protected>',
          '  <values><field>RelatedDomainBindingSObjectAlternate__c</field><value xsi:type="xsd:string">Account</value></values>',
          '  <values><field>ProcessContext__c</field><value xsi:type="xsd:string">TriggerExecution</value></values>',
          '  <values><field>TriggerOperation__c</field><value xsi:type="xsd:string">Before_Insert</value></values>',
          `  <values><field>Type__c</field><value xsi:type="xsd:string">${type}</value></values>`,
          `  <values><field>ClassToInject__c</field><value xsi:type="xsd:string">${developerName}</value></values>`,
          `  <values><field>OrderOfExecution__c</field><value xsi:type="xsd:double">${order}</value></values>`,
          '</CustomMetadata>',
          '',
        ].join('\n');

      fs.writeFileSync(
        path.join(customMetadataDir, 'DomainProcessBinding.Second.md-meta.xml'),
        xml('Second', 2, 'Action'),
      );
      fs.writeFileSync(
        path.join(customMetadataDir, 'DomainProcessBinding.First.md-meta.xml'),
        xml('First', 1, 'Criteria'),
      );

      const result = await At4dxDomainProcessBindingList.run(['--source-dir', sourceDir, '--json']);

      expect(result.source).to.equal('local');
      expect(result.bindings.map((row) => row.developerName)).to.deep.equal(['First', 'Second']);
      expect(result.bindings.every((row) => row.orderCollision === undefined)).to.equal(true);
    } finally {
      fs.rmSync(sourceDir, { recursive: true, force: true });
    }
  });

  it('should error when local source has no matching CustomMetadata components', async () => {
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-dpb-list-empty-'));
    try {
      try {
        await At4dxDomainProcessBindingList.run(['--source-dir', sourceDir]);
        expect.fail('should have thrown Error');
      } catch (err) {
        const error = err as SfError;
        expect(error.message).to.include("doesn't appear to be present");
      }
    } finally {
      fs.rmSync(sourceDir, { recursive: true, force: true });
    }
  });
});
