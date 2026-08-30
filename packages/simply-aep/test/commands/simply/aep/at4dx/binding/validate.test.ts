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
import At4dxBindingValidate from '../../../../../../src/commands/simply/aep/at4dx/binding/validate.js';

/* eslint-disable camelcase -- AT4DX Custom Metadata field API names (To__c, BindingInterface__c, etc.) */

describe('simply aep at4dx binding validate', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();
  let sourceDir: string;

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(() => {
    process.exitCode = undefined;
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-binding-validate-'));
  });

  afterEach(() => {
    $$.restore();
    process.exitCode = undefined;
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it('should error when neither --target-org nor --source-dir is specified', async () => {
    try {
      await At4dxBindingValidate.run([]);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify either --target-org or --source-dir');
    }
  });

  it('should error when both --target-org and --source-dir are specified', async () => {
    try {
      await At4dxBindingValidate.run(['--target-org', testOrg.username, '--source-dir', sourceDir]);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include('You must specify either --target-org or --source-dir');
    }
  });

  it('should error when none of the requested types exist in the target org', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').callsFake(async () => {
      const error = new Error('sObject type does not exist');
      error.name = 'INVALID_TYPE';
      throw error;
    });

    try {
      await At4dxBindingValidate.run(['--target-org', testOrg.username, '--type', 'service']);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include("AT4DX doesn't appear to be present");
    }
  });

  it('should error when local source has no matching CustomMetadata components', async () => {
    try {
      await At4dxBindingValidate.run(['--source-dir', sourceDir]);
      expect.fail('should have thrown Error');
    } catch (err) {
      expect((err as SfError).message).to.include("AT4DX doesn't appear to be present");
    }
  });

  function writeCustomMetadata(fileName: string, values: string): void {
    const dir = path.join(sourceDir, 'customMetadata');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, fileName),
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
        '  <label>Test</label>',
        '  <protected>false</protected>',
        values,
        '</CustomMetadata>',
        '',
      ].join('\n'),
    );
  }

  it('should leave process.exitCode unset and return no issues for a well-formed Selector binding', async () => {
    writeCustomMetadata(
      'ApplicationFactory_SelectorBinding.Account_Selector.md-meta.xml',
      [
        '  <values><field>To__c</field><value xsi:type="xsd:string">AccountsSelector</value></values>',
        '  <values><field>BindingSObject__c</field><value xsi:type="xsd:string">Account</value></values>',
        '  <values><field>BindingSObjectAlternate__c</field><value xsi:nil="true"/></values>',
        '  <values><field>Priority__c</field><value xsi:type="xsd:double">1</value></values>',
      ].join('\n'),
    );

    const result = await At4dxBindingValidate.run(['--source-dir', sourceDir, '--json']);

    expect(result.issues).to.deep.equal([]);
    expect(process.exitCode).to.equal(undefined);
  });

  it('should leave process.exitCode unset when only a warning-severity issue is found', async () => {
    writeCustomMetadata(
      'ApplicationFactory_SelectorBinding.Account_Selector.md-meta.xml',
      [
        '  <values><field>To__c</field><value xsi:type="xsd:string">AccountsSelector</value></values>',
        '  <values><field>BindingSObject__c</field><value xsi:nil="true"/></values>',
        '  <values><field>BindingSObjectAlternate__c</field><value xsi:type="xsd:string">Account</value></values>',
        '  <values><field>Priority__c</field><value xsi:type="xsd:double">1</value></values>',
      ].join('\n'),
    );

    const result = await At4dxBindingValidate.run(['--source-dir', sourceDir, '--json']);

    expect(result.issues).to.have.lengthOf(1);
    expect(result.issues[0].severity).to.equal('warning');
    expect(result.issues[0].rule).to.equal('unnecessary-entity-definition-alternate');
    expect(process.exitCode).to.equal(undefined);
  });

  it('should set process.exitCode to 1 and still return the full issues array when an error-severity issue is found', async () => {
    writeCustomMetadata(
      'ApplicationFactory_SelectorBinding.Account_Selector.md-meta.xml',
      [
        '  <values><field>To__c</field><value xsi:type="xsd:string">SharedImpl</value></values>',
        '  <values><field>BindingSObject__c</field><value xsi:type="xsd:string">Account</value></values>',
        '  <values><field>BindingSObjectAlternate__c</field><value xsi:nil="true"/></values>',
      ].join('\n'),
    );
    writeCustomMetadata(
      'ApplicationFactory_SelectorBinding.Contact_Selector.md-meta.xml',
      [
        '  <values><field>To__c</field><value xsi:type="xsd:string">SharedImpl</value></values>',
        '  <values><field>BindingSObject__c</field><value xsi:type="xsd:string">Contact</value></values>',
        '  <values><field>BindingSObjectAlternate__c</field><value xsi:nil="true"/></values>',
      ].join('\n'),
    );

    const result = await At4dxBindingValidate.run(['--source-dir', sourceDir, '--json']);

    expect(result.issues.filter((issue) => issue.rule === 'duplicate-to')).to.have.lengthOf(2);
    expect(process.exitCode).to.equal(1);
  });

  it('should surface a record with no resolvable SObject as a missing-sobject-reference error', async () => {
    writeCustomMetadata(
      'ApplicationFactory_SelectorBinding.Unresolvable.md-meta.xml',
      [
        '  <values><field>To__c</field><value xsi:type="xsd:string">SomeImpl</value></values>',
        '  <values><field>BindingSObject__c</field><value xsi:nil="true"/></values>',
        '  <values><field>BindingSObjectAlternate__c</field><value xsi:nil="true"/></values>',
      ].join('\n'),
    );

    const result = await At4dxBindingValidate.run(['--source-dir', sourceDir, '--json']);

    expect(result.issues).to.have.lengthOf(1);
    expect(result.issues[0]).to.deep.include({
      severity: 'error',
      rule: 'missing-sobject-reference',
      developerName: 'Unresolvable',
    });
    expect(process.exitCode).to.equal(1);
  });

  it('should surface a UnitOfWork record with no resolvable SObject as a missing-sobject-reference error', async () => {
    writeCustomMetadata(
      'ApplicationFactory_UnitOfWorkBinding.Unresolvable.md-meta.xml',
      [
        '  <values><field>BindingSequence__c</field><value xsi:type="xsd:double">1</value></values>',
        '  <values><field>BindingSObject__c</field><value xsi:nil="true"/></values>',
        '  <values><field>BindingSObjectAlternate__c</field><value xsi:nil="true"/></values>',
      ].join('\n'),
    );
    writeCustomMetadata(
      'ApplicationFactory_SelectorBinding.Account_Selector.md-meta.xml',
      [
        '  <values><field>To__c</field><value xsi:type="xsd:string">AccountsSelector</value></values>',
        '  <values><field>BindingSObject__c</field><value xsi:type="xsd:string">Account</value></values>',
        '  <values><field>BindingSObjectAlternate__c</field><value xsi:nil="true"/></values>',
      ].join('\n'),
    );

    const result = await At4dxBindingValidate.run(['--source-dir', sourceDir, '--json']);

    expect(result.issues).to.have.lengthOf(1);
    expect(result.issues[0]).to.deep.include({
      severity: 'error',
      rule: 'missing-sobject-reference',
      developerName: 'Unresolvable',
    });
    expect(process.exitCode).to.equal(1);
  });

  it('should flag a sequence-collision warning when two UnitOfWork records share BindingSequence__c', async () => {
    writeCustomMetadata(
      'ApplicationFactory_UnitOfWorkBinding.Account_UOW.md-meta.xml',
      [
        '  <values><field>BindingSequence__c</field><value xsi:type="xsd:double">10</value></values>',
        '  <values><field>BindingSObject__c</field><value xsi:type="xsd:string">Account</value></values>',
        '  <values><field>BindingSObjectAlternate__c</field><value xsi:nil="true"/></values>',
      ].join('\n'),
    );
    writeCustomMetadata(
      'ApplicationFactory_UnitOfWorkBinding.Contact_UOW.md-meta.xml',
      [
        '  <values><field>BindingSequence__c</field><value xsi:type="xsd:double">10</value></values>',
        '  <values><field>BindingSObject__c</field><value xsi:type="xsd:string">Contact</value></values>',
        '  <values><field>BindingSObjectAlternate__c</field><value xsi:nil="true"/></values>',
      ].join('\n'),
    );

    const result = await At4dxBindingValidate.run(['--source-dir', sourceDir, '--json']);

    const collisionIssues = result.issues.filter((issue) => issue.rule === 'sequence-collision');
    expect(collisionIssues).to.have.lengthOf(2);
    expect(collisionIssues[0].severity).to.equal('warning');
    expect(process.exitCode).to.equal(undefined);
  });
});
