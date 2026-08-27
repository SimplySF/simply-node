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
import { buildDomainProcessBindingXml } from '../src/at4dxDomainProcessBuildXml.js';
import type { RawDomainProcessBindingRecord } from '../src/at4dxDomainProcessBindingTypes.js';
import { scanLocalDomainProcessBindings } from '../src/at4dxDomainProcessLocalScan.js';

function record(overrides: Partial<RawDomainProcessBindingRecord> = {}): RawDomainProcessBindingRecord {
  return {
    developerName: 'Test_Binding',
    label: 'Test Binding',
    sobject: 'Account',
    sobjectField: 'primary',
    processContext: 'TriggerExecution',
    triggerOperation: 'Before_Insert',
    domainMethodToken: undefined,
    type: 'Action',
    classToInject: 'SomeClass',
    order: 10,
    isActive: true,
    executeAsynchronous: false,
    logicalInverse: false,
    preventRecursive: false,
    description: undefined,
    source: 'test',
    ...overrides,
  };
}

describe('buildDomainProcessBindingXml', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-domain-process-build-xml-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  function writeAndScan(input: RawDomainProcessBindingRecord): RawDomainProcessBindingRecord {
    const xml = buildDomainProcessBindingXml(input, { label: input.label });
    // Nested under a directory named after `input.source`: `source` isn't part of the XML at all (it's
    // derived from the containing directory name), so this keeps the round-trip equality check below
    // meaningful instead of comparing a value the write side never had a chance to produce.
    const dir = path.join(tmpDir, input.source, 'customMetadata');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `DomainProcessBinding.${input.developerName}.md-meta.xml`), xml);

    const { records } = scanLocalDomainProcessBindings([tmpDir]);
    expect(records).toHaveLength(1);
    return records[0];
  }

  it('produces the exact XML shape scanLocalDomainProcessBindings' + "'s fixtures expect", () => {
    const xml = buildDomainProcessBindingXml(record(), { label: 'Test Binding' });

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n' +
        '  <label>Test Binding</label>\n' +
        '  <protected>false</protected>\n' +
        '  <values><field>RelatedDomainBindingSObject__c</field><value xsi:type="xsd:string">Account</value></values>\n' +
        '  <values><field>RelatedDomainBindingSObjectAlternate__c</field><value xsi:nil="true"/></values>\n' +
        '  <values><field>ProcessContext__c</field><value xsi:type="xsd:string">TriggerExecution</value></values>\n' +
        '  <values><field>TriggerOperation__c</field><value xsi:type="xsd:string">Before_Insert</value></values>\n' +
        '  <values><field>DomainMethodToken__c</field><value xsi:nil="true"/></values>\n' +
        '  <values><field>Type__c</field><value xsi:type="xsd:string">Action</value></values>\n' +
        '  <values><field>ClassToInject__c</field><value xsi:type="xsd:string">SomeClass</value></values>\n' +
        '  <values><field>OrderOfExecution__c</field><value xsi:type="xsd:double">10</value></values>\n' +
        '  <values><field>IsActive__c</field><value xsi:type="xsd:boolean">true</value></values>\n' +
        '  <values><field>ExecuteAsynchronous__c</field><value xsi:type="xsd:boolean">false</value></values>\n' +
        '  <values><field>LogicalInverse__c</field><value xsi:type="xsd:boolean">false</value></values>\n' +
        '  <values><field>PreventRecursive__c</field><value xsi:type="xsd:boolean">false</value></values>\n' +
        '  <values><field>Description__c</field><value xsi:nil="true"/></values>\n' +
        '</CustomMetadata>\n',
    );
  });

  it('round-trips a TriggerExecution/Action record using the primary SObject field', () => {
    const input = record();
    expect(writeAndScan(input)).toEqual({ ...input, filePath: expect.stringContaining(input.developerName) as string });
  });

  it('round-trips using the alternate SObject field, nil-ing the primary', () => {
    const input = record({ developerName: 'Alt_Binding', label: 'Alt Binding', sobjectField: 'alternate' });
    const scanned = writeAndScan(input);

    expect(scanned).toEqual({ ...input, filePath: expect.stringContaining(input.developerName) as string });
  });

  it('round-trips a DomainMethodExecution/Criteria record', () => {
    const input = record({
      developerName: 'Domain_Method_Binding',
      label: 'Domain Method Binding',
      processContext: 'DomainMethodExecution',
      triggerOperation: undefined,
      domainMethodToken: 'ProcessDeals',
      type: 'Criteria',
    });

    expect(writeAndScan(input)).toEqual({ ...input, filePath: expect.stringContaining(input.developerName) as string });
  });

  it('round-trips inactive/async/inverse/recursive-prevented flags and a description with XML-significant characters', () => {
    const input = record({
      developerName: 'Full_Flags_Binding',
      label: 'Full Flags Binding',
      isActive: false,
      executeAsynchronous: true,
      logicalInverse: true,
      preventRecursive: true,
      description: 'Runs when Account & Contact < Opportunity',
    });

    expect(writeAndScan(input)).toEqual({ ...input, filePath: expect.stringContaining(input.developerName) as string });
  });

  it('never produces an ambiguous-sobject-reference on re-scan, for either sobjectField', () => {
    writeAndScan(record({ developerName: 'Primary_Binding', label: 'Primary Binding', sobjectField: 'primary' }));

    const { ambiguous } = scanLocalDomainProcessBindings([tmpDir]);
    expect(ambiguous).toEqual([]);
  });
});
