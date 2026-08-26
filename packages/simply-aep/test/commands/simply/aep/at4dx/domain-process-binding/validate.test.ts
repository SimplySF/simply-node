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
import At4dxDomainProcessBindingValidate from '../../../../../../src/commands/simply/aep/at4dx/domain-process-binding/validate.js';

/* eslint-disable camelcase -- AT4DX Custom Metadata field API names (ClassToInject__c, TriggerOperation__c, etc.) */

describe('simply aep at4dx domain-process-binding validate', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(() => {
    process.exitCode = undefined;
  });

  afterEach(() => {
    $$.restore();
    process.exitCode = undefined;
  });

  it('should error when neither --target-org nor --source-dir is specified', async () => {
    try {
      await At4dxDomainProcessBindingValidate.run([]);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include('You must specify either --target-org or --source-dir');
    }
  });

  it('should error when both --target-org and --source-dir are specified', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-dpb-validate-'));
    try {
      await At4dxDomainProcessBindingValidate.run(['--target-org', testOrg.username, '--source-dir', directory]);
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
      await At4dxDomainProcessBindingValidate.run(['--target-org', testOrg.username]);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include("doesn't appear to be present");
    }
  });

  it('should error when local source has no matching CustomMetadata components', async () => {
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-dpb-validate-empty-'));
    try {
      try {
        await At4dxDomainProcessBindingValidate.run(['--source-dir', sourceDir]);
        expect.fail('should have thrown Error');
      } catch (err) {
        const error = err as SfError;
        expect(error.message).to.include("doesn't appear to be present");
      }
    } finally {
      fs.rmSync(sourceDir, { recursive: true, force: true });
    }
  });

  it('should leave process.exitCode unset and return no issues for well-formed bindings', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').callsFake(
      async () =>
        ({
          records: [
            {
              DeveloperName: 'Account_Action',
              RelatedDomainBindingSObject__c: null,
              RelatedDomainBindingSObject__r: null,
              RelatedDomainBindingSObjectAlternate__c: 'Account',
              ProcessContext__c: 'TriggerExecution',
              TriggerOperation__c: 'Before_Insert',
              DomainMethodToken__c: null,
              Type__c: 'Action',
              ClassToInject__c: 'AccountAction',
              OrderOfExecution__c: 1,
              IsActive__c: true,
              ExecuteAsynchronous__c: false,
              LogicalInverse__c: false,
              PreventRecursive__c: false,
              Description__c: null,
            },
          ],
          done: true,
          totalSize: 1,
        }) as never,
    );

    const result = await At4dxDomainProcessBindingValidate.run(['--target-org', testOrg.username, '--json']);

    expect(result.source).to.equal(testOrg.username);
    expect(result.bindingCount).to.equal(1);
    expect(result.issues).to.deep.equal([]);
    expect(process.exitCode).to.equal(undefined);
  });

  it('should leave process.exitCode unset when only warning-severity issues are found', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').callsFake(
      async () =>
        ({
          records: [
            {
              DeveloperName: 'Ambiguous',
              RelatedDomainBindingSObject__c: '01I000000000000',
              RelatedDomainBindingSObject__r: { QualifiedApiName: 'Account' },
              RelatedDomainBindingSObjectAlternate__c: 'Contact',
              ProcessContext__c: 'TriggerExecution',
              TriggerOperation__c: 'Before_Insert',
              DomainMethodToken__c: null,
              Type__c: 'Action',
              ClassToInject__c: 'AmbiguousAction',
              OrderOfExecution__c: 1,
              IsActive__c: true,
              ExecuteAsynchronous__c: false,
              LogicalInverse__c: false,
              PreventRecursive__c: false,
              Description__c: null,
            },
          ],
          done: true,
          totalSize: 1,
        }) as never,
    );

    const result = await At4dxDomainProcessBindingValidate.run(['--target-org', testOrg.username, '--json']);

    expect(result.issues).to.have.lengthOf(1);
    expect(result.issues[0].severity).to.equal('warning');
    expect(result.issues[0].rule).to.equal('ambiguous-sobject-reference');
    expect(process.exitCode).to.equal(undefined);
  });

  it('should set process.exitCode to 1 and still return the full issues array when an error-severity issue is found', async () => {
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

    const result = await At4dxDomainProcessBindingValidate.run(['--target-org', testOrg.username, '--json']);

    expect(result.issues.filter((issue) => issue.rule === 'order-collision')).to.have.lengthOf(2);
    expect(result.issues.every((issue) => issue.severity === 'error')).to.equal(true);
    expect(process.exitCode).to.equal(1);
  });

  it('should surface a record with no resolvable SObject as a missing-sobject-reference error from local source', async () => {
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-dpb-validate-local-'));
    try {
      const projectDir = path.join(sourceDir, 'my-project');
      const customMetadataDir = path.join(projectDir, 'customMetadata');
      fs.mkdirSync(customMetadataDir, { recursive: true });

      fs.writeFileSync(
        path.join(customMetadataDir, 'DomainProcessBinding.Unresolvable.md-meta.xml'),
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
          '  <label>Unresolvable</label>',
          '  <protected>false</protected>',
          '  <values><field>RelatedDomainBindingSObject__c</field><value xsi:nil="true"/></values>',
          '  <values><field>RelatedDomainBindingSObjectAlternate__c</field><value xsi:nil="true"/></values>',
          '</CustomMetadata>',
          '',
        ].join('\n'),
      );

      const result = await At4dxDomainProcessBindingValidate.run(['--source-dir', sourceDir, '--json']);

      expect(result.bindingCount).to.equal(0);
      expect(result.issues).to.have.lengthOf(1);
      expect(result.issues[0]).to.deep.include({
        severity: 'error',
        rule: 'missing-sobject-reference',
        scope: 'scan',
        message:
          'Unresolvable: neither RelatedDomainBindingSObject__c nor RelatedDomainBindingSObjectAlternate__c is set — this binding has no SObject to bind against.',
        developerName: 'Unresolvable',
        source: 'my-project',
      });
      expect(result.issues[0].filePath).to.include('DomainProcessBinding.Unresolvable.md-meta.xml');
      expect(process.exitCode).to.equal(1);
    } finally {
      fs.rmSync(sourceDir, { recursive: true, force: true });
    }
  });

  it('should report a duplicate DeveloperName shared across SObjects even when --sobject filters to one of them', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').callsFake(
      async () =>
        ({
          records: [
            {
              DeveloperName: 'Shared',
              RelatedDomainBindingSObject__c: null,
              RelatedDomainBindingSObject__r: null,
              RelatedDomainBindingSObjectAlternate__c: 'Account',
              ProcessContext__c: 'TriggerExecution',
              TriggerOperation__c: 'Before_Insert',
              DomainMethodToken__c: null,
              Type__c: 'Action',
              ClassToInject__c: 'AccountAction',
              OrderOfExecution__c: 1,
              IsActive__c: true,
              ExecuteAsynchronous__c: false,
              LogicalInverse__c: false,
              PreventRecursive__c: false,
              Description__c: null,
            },
            {
              DeveloperName: 'Shared',
              RelatedDomainBindingSObject__c: null,
              RelatedDomainBindingSObject__r: null,
              RelatedDomainBindingSObjectAlternate__c: 'Contact',
              ProcessContext__c: 'TriggerExecution',
              TriggerOperation__c: 'Before_Insert',
              DomainMethodToken__c: null,
              Type__c: 'Action',
              ClassToInject__c: 'ContactAction',
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

    const result = await At4dxDomainProcessBindingValidate.run([
      '--target-org',
      testOrg.username,
      '--sobject',
      'Account',
      '--json',
    ]);

    const duplicateIssues = result.issues.filter((issue) => issue.rule === 'duplicate-developer-name');
    expect(duplicateIssues).to.have.lengthOf(2);
    expect(duplicateIssues.every((issue) => issue.scope === 'scan')).to.equal(true);
    expect(process.exitCode).to.equal(1);
  });

  it('should not print a Scan-wide issues table when only in-scope issues are found', async () => {
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

    const result = await At4dxDomainProcessBindingValidate.run([
      '--target-org',
      testOrg.username,
      '--sobject',
      'Account',
      '--json',
    ]);

    expect(result.issues.filter((issue) => issue.rule === 'order-collision')).to.have.lengthOf(2);
    expect(result.issues.filter((issue) => issue.scope === 'scan')).to.have.lengthOf(0);
    expect(process.exitCode).to.equal(1);
  });
});
