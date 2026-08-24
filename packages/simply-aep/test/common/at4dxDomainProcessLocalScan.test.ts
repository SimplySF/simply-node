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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanLocalDomainProcessBindings } from '../../src/common/at4dxDomainProcessLocalScan.js';

function writeCustomMetadata(projectDir: string, fileName: string, xml: string): void {
  const dir = path.join(projectDir, 'customMetadata');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), xml);
}

const XML_HEADER =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">';

function values(entries: Array<{ field: string; value?: string; type?: string }>): string {
  return entries
    .map(({ field, value, type }) =>
      value === undefined
        ? `  <values><field>${field}</field><value xsi:nil="true"/></values>`
        : `  <values><field>${field}</field><value xsi:type="xsd:${type ?? 'string'}">${value}</value></values>`,
    )
    .join('\n');
}

describe('scanLocalDomainProcessBindings', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-domain-process-local-scan-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('parses a record with only one <values> element (fast-xml-parser collapses it to a bare object, not an array)', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'DomainProcessBinding.Account_Before_Insert_Test.md-meta.xml',
      `${XML_HEADER}\n  <label>Account Before Insert Test</label>\n  <protected>false</protected>\n${values([
        { field: 'RelatedDomainBindingSObjectAlternate__c', value: 'Account' },
      ])}\n</CustomMetadata>\n`,
    );

    const records = scanLocalDomainProcessBindings([tmpDir]);

    expect(records).toHaveLength(1);
    expect(records[0].sobject).toBe('Account');
    expect(records[0].developerName).toBe('Account_Before_Insert_Test');
  });

  it('parses a full DomainProcessBinding record with every field set', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'DomainProcessBinding.Account_Before_Insert_Test.md-meta.xml',
      `${XML_HEADER}\n  <label>Account Before Insert Test</label>\n  <protected>false</protected>\n${values([
        { field: 'RelatedDomainBindingSObjectAlternate__c', value: 'Account' },
        { field: 'ProcessContext__c', value: 'TriggerExecution' },
        { field: 'TriggerOperation__c', value: 'Before_Insert' },
        { field: 'Type__c', value: 'Action' },
        { field: 'ClassToInject__c', value: 'AccountBeforeInsertAction' },
        { field: 'OrderOfExecution__c', value: '1.1', type: 'double' },
        { field: 'IsActive__c', value: 'true', type: 'boolean' },
        { field: 'ExecuteAsynchronous__c', value: 'false', type: 'boolean' },
        { field: 'LogicalInverse__c', value: 'false', type: 'boolean' },
        { field: 'PreventRecursive__c', value: 'false', type: 'boolean' },
        { field: 'Description__c', value: 'A test action' },
      ])}\n</CustomMetadata>\n`,
    );

    const records = scanLocalDomainProcessBindings([tmpDir]);

    expect(records).toEqual([
      {
        developerName: 'Account_Before_Insert_Test',
        sobject: 'Account',
        processContext: 'TriggerExecution',
        triggerOperation: 'Before_Insert',
        domainMethodToken: undefined,
        type: 'Action',
        classToInject: 'AccountBeforeInsertAction',
        order: 1.1,
        isActive: true,
        executeAsynchronous: false,
        logicalInverse: false,
        preventRecursive: false,
        description: 'A test action',
        source: 'my-project',
      },
    ]);
  });

  it('falls back to RelatedDomainBindingSObjectAlternate__c when RelatedDomainBindingSObject__c is blank', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'DomainProcessBinding.Account_Criteria_Test.md-meta.xml',
      `${XML_HEADER}\n  <label>Account Criteria Test</label>\n  <protected>false</protected>\n${values([
        { field: 'RelatedDomainBindingSObject__c' },
        { field: 'RelatedDomainBindingSObjectAlternate__c', value: 'Account' },
        { field: 'ProcessContext__c', value: 'TriggerExecution' },
        { field: 'TriggerOperation__c', value: 'Before_Insert' },
        { field: 'Type__c', value: 'Criteria' },
        { field: 'ClassToInject__c', value: 'AccountCriteria' },
        { field: 'OrderOfExecution__c', value: '1', type: 'double' },
      ])}\n</CustomMetadata>\n`,
    );

    const records = scanLocalDomainProcessBindings([tmpDir]);

    expect(records).toHaveLength(1);
    expect(records[0].sobject).toBe('Account');
  });

  it('ignores CustomMetadata components for other object types', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'ApplicationFactory_ServiceBinding.My_Service.md-meta.xml',
      `${XML_HEADER}\n  <label>My Service</label>\n  <protected>false</protected>\n${values([
        { field: 'BindingInterface__c', value: 'IMyService' },
      ])}\n</CustomMetadata>\n`,
    );

    const records = scanLocalDomainProcessBindings([tmpDir]);

    expect(records).toEqual([]);
  });

  it('skips a record with neither RelatedDomainBindingSObject__c nor RelatedDomainBindingSObjectAlternate__c set', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'DomainProcessBinding.Unresolvable.md-meta.xml',
      `${XML_HEADER}\n  <label>Unresolvable</label>\n  <protected>false</protected>\n${values([
        { field: 'RelatedDomainBindingSObject__c' },
        { field: 'RelatedDomainBindingSObjectAlternate__c' },
      ])}\n</CustomMetadata>\n`,
    );

    expect(scanLocalDomainProcessBindings([tmpDir])).toEqual([]);
  });

  it('returns an empty array when no matching CustomMetadata components are found', () => {
    expect(scanLocalDomainProcessBindings([tmpDir])).toEqual([]);
  });
});
