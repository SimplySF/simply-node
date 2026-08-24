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
import { scanLocalBindings } from '../../src/common/at4dxLocalScan.js';

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

describe('scanLocalBindings', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-local-scan-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('parses a record with only one <values> element (fast-xml-parser collapses it to a bare object, not an array)', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'ApplicationFactory_ServiceBinding.My_Service.md-meta.xml',
      `${XML_HEADER}\n  <label>My Service</label>\n  <protected>false</protected>\n${values([
        { field: 'BindingInterface__c', value: 'IMyService' },
      ])}\n</CustomMetadata>\n`,
    );

    const records = scanLocalBindings([tmpDir], ['Service']);

    expect(records).toEqual([
      {
        bindingType: 'Service',
        developerName: 'My_Service',
        key: 'IMyService',
        to: undefined,
        priority: undefined,
        sequence: undefined,
        source: 'my-project',
      },
    ]);
  });

  it('parses a Service binding record (multiple <values> elements) with To__c and BindingInterface__c', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'ApplicationFactory_ServiceBinding.My_Service.md-meta.xml',
      `${XML_HEADER}\n  <label>My Service</label>\n  <protected>false</protected>\n${values([
        { field: 'To__c', value: 'MyServiceImpl' },
        { field: 'BindingInterface__c', value: 'IMyService' },
        { field: 'Priority__c' },
      ])}\n</CustomMetadata>\n`,
    );

    const records = scanLocalBindings([tmpDir], ['Service']);

    expect(records).toEqual([
      {
        bindingType: 'Service',
        developerName: 'My_Service',
        key: 'IMyService',
        to: 'MyServiceImpl',
        priority: undefined,
        sequence: undefined,
        source: 'my-project',
      },
    ]);
  });

  it('falls back to BindingSObjectAlternate__c when BindingSObject__c is blank', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'ApplicationFactory_SelectorBinding.Campaign_Selector.md-meta.xml',
      `${XML_HEADER}\n  <label>Campaign Selector</label>\n  <protected>false</protected>\n${values([
        { field: 'To__c', value: 'CampaignSObjectSelector' },
        { field: 'BindingSObject__c' },
        { field: 'BindingSObjectAlternate__c', value: 'Campaign' },
        { field: 'Priority__c', value: '1', type: 'double' },
      ])}\n</CustomMetadata>\n`,
    );

    const records = scanLocalBindings([tmpDir], ['Selector']);

    expect(records).toHaveLength(1);
    expect(records[0].key).toBe('Campaign');
    expect(records[0].priority).toBe(1);
  });

  it('only scans requested binding types', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'ApplicationFactory_ServiceBinding.My_Service.md-meta.xml',
      `${XML_HEADER}\n  <label>My Service</label>\n  <protected>false</protected>\n${values([
        { field: 'To__c', value: 'MyServiceImpl' },
        { field: 'BindingInterface__c', value: 'IMyService' },
      ])}\n</CustomMetadata>\n`,
    );
    writeCustomMetadata(
      projectDir,
      'ApplicationFactory_DomainBinding.Campaign_Domain.md-meta.xml',
      `${XML_HEADER}\n  <label>Campaign Domain</label>\n  <protected>false</protected>\n${values([
        { field: 'To__c', value: 'CampaignDomain' },
        { field: 'BindingSObject__c' },
        { field: 'BindingSObjectAlternate__c', value: 'Campaign' },
      ])}\n</CustomMetadata>\n`,
    );

    const records = scanLocalBindings([tmpDir], ['Service']);

    expect(records).toHaveLength(1);
    expect(records[0].bindingType).toBe('Service');
  });

  it('returns an empty array when no matching CustomMetadata components are found', () => {
    expect(scanLocalBindings([tmpDir], ['Service', 'Selector', 'Domain', 'UnitOfWork'])).toEqual([]);
  });
});
