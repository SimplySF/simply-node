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
import At4dxBindingList from '../../../../../../src/commands/simply/aep/at4dx/binding/list.js';

/* eslint-disable camelcase -- AT4DX Custom Metadata field API names (To__c, BindingInterface__c, etc.) */

describe('simply aep at4dx binding list', () => {
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
      await At4dxBindingList.run([]);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include('You must specify either --target-org or --source-dir');
    }
  });

  it('should error when both --target-org and --source-dir are specified', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-list-'));
    try {
      await At4dxBindingList.run(['--target-org', testOrg.username, '--source-dir', directory]);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include('You must specify either --target-org or --source-dir');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('should error when none of the requested types exist in the target org', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').callsFake(async () => {
      const error = new Error('sObject type does not exist');
      error.name = 'INVALID_TYPE';
      throw error;
    });

    try {
      await At4dxBindingList.run(['--target-org', testOrg.username, '--type', 'service']);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include("AT4DX doesn't appear to be present");
    }
  });

  it('should resolve Service bindings by priority and Domain bindings as ambiguous when queried from an org', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').callsFake(async (soql: string) => {
      if (soql.includes('ApplicationFactory_ServiceBinding__mdt')) {
        return {
          records: [
            { DeveloperName: 'Low', To__c: 'LowImpl', BindingInterface__c: 'IMyService', Priority__c: 1 },
            { DeveloperName: 'High', To__c: 'HighImpl', BindingInterface__c: 'IMyService', Priority__c: 5 },
          ],
          done: true,
          totalSize: 2,
        } as never;
      }
      if (soql.includes('ApplicationFactory_DomainBinding__mdt')) {
        return {
          records: [
            {
              DeveloperName: 'First',
              To__c: 'FirstDomain',
              BindingSObject__c: null,
              BindingSObject__r: null,
              BindingSObjectAlternate__c: 'Campaign',
            },
            {
              DeveloperName: 'Second',
              To__c: 'SecondDomain',
              BindingSObject__c: null,
              BindingSObject__r: null,
              BindingSObjectAlternate__c: 'Campaign',
            },
          ],
          done: true,
          totalSize: 2,
        } as never;
      }
      return { records: [], done: true, totalSize: 0 };
    });

    const result = await At4dxBindingList.run(['--target-org', testOrg.username, '--type', 'service,domain', '--json']);

    expect(result.source).to.equal(testOrg.username);
    expect(result.bindings).to.have.lengthOf(4);

    const service = result.bindings.filter((row) => row.bindingType === 'Service');
    expect(service.find((row) => row.developerName === 'High')?.effective).to.equal(true);
    expect(service.find((row) => row.developerName === 'Low')?.effective).to.equal(false);

    const domain = result.bindings.filter((row) => row.bindingType === 'Domain');
    expect(domain.every((row) => row.ambiguous === true)).to.equal(true);
    expect(domain.every((row) => row.effective === false)).to.equal(true);
  });

  it('should resolve UnitOfWork bindings, ordered by sequence, from local source', async () => {
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-list-local-'));
    try {
      const customMetadataDir = path.join(sourceDir, 'customMetadata');
      fs.mkdirSync(customMetadataDir, { recursive: true });

      const xml = (developerName: string, sequence: number, sobject: string): string =>
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
          `  <label>${developerName}</label>`,
          '  <protected>false</protected>',
          '  <values><field>BindingSequence__c</field><value xsi:type="xsd:double">' + sequence + '</value></values>',
          '  <values><field>BindingSObject__c</field><value xsi:nil="true"/></values>',
          `  <values><field>BindingSObjectAlternate__c</field><value xsi:type="xsd:string">${sobject}</value></values>`,
          '</CustomMetadata>',
          '',
        ].join('\n');

      fs.writeFileSync(
        path.join(customMetadataDir, 'ApplicationFactory_UnitOfWorkBinding.Second.md-meta.xml'),
        xml('Second', 20, 'Contact'),
      );
      fs.writeFileSync(
        path.join(customMetadataDir, 'ApplicationFactory_UnitOfWorkBinding.First.md-meta.xml'),
        xml('First', 10, 'Account'),
      );

      const result = await At4dxBindingList.run(['--source-dir', sourceDir, '--type', 'unit-of-work', '--json']);

      expect(result.source).to.equal('local');
      expect(result.bindings.map((row) => row.developerName)).to.deep.equal(['First', 'Second']);
      expect(result.bindings.every((row) => row.effective === true)).to.equal(true);
    } finally {
      fs.rmSync(sourceDir, { recursive: true, force: true });
    }
  });

  it('should error when local source has no matching CustomMetadata components', async () => {
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-list-empty-'));
    try {
      try {
        await At4dxBindingList.run(['--source-dir', sourceDir]);
        expect.fail('should have thrown Error');
      } catch (err) {
        const error = err as SfError;
        expect(error.message).to.include("AT4DX doesn't appear to be present");
      }
    } finally {
      fs.rmSync(sourceDir, { recursive: true, force: true });
    }
  });
});
