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
import { scanLocalFieldSetInclusions } from '../src/at4dxFieldSetInclusionLocalScan.js';

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

describe('scanLocalFieldSetInclusions', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-field-set-inclusion-local-scan-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('parses a full SelectorConfig_FieldSetInclusion record with every field set', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'SelectorConfig_FieldSetInclusion.Account_Contact_Fields.md-meta.xml',
      `${XML_HEADER}\n  <label>Account Contact Fields</label>\n  <protected>false</protected>\n${values([
        { field: 'BindingSObject__c', value: 'Account' },
        { field: 'BindingSObjectAlternate__c' },
        { field: 'FieldsetName__c', value: 'ContactRelatedFields' },
        { field: 'IsActive__c', value: 'true', type: 'boolean' },
      ])}\n</CustomMetadata>\n`,
    );

    const { records } = scanLocalFieldSetInclusions([tmpDir]);

    expect(records).toEqual([
      {
        developerName: 'Account_Contact_Fields',
        label: 'Account Contact Fields',
        sobject: 'Account',
        sobjectField: 'primary',
        fieldsetName: 'ContactRelatedFields',
        isActive: true,
        source: 'my-project',
        filePath: expect.stringContaining(
          'SelectorConfig_FieldSetInclusion.Account_Contact_Fields.md-meta.xml',
        ) as string,
      },
    ]);
  });

  it('falls back to BindingSObjectAlternate__c when BindingSObject__c is blank', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'SelectorConfig_FieldSetInclusion.ServiceResource_Skills.md-meta.xml',
      `${XML_HEADER}\n  <label>ServiceResource Skills</label>\n  <protected>false</protected>\n${values([
        { field: 'BindingSObject__c' },
        { field: 'BindingSObjectAlternate__c', value: 'ServiceResource' },
        { field: 'FieldsetName__c', value: 'SkillFields' },
      ])}\n</CustomMetadata>\n`,
    );

    const { records } = scanLocalFieldSetInclusions([tmpDir]);

    expect(records).toHaveLength(1);
    expect(records[0].sobject).toBe('ServiceResource');
    expect(records[0].sobjectField).toBe('alternate');
  });

  it('defaults isActive to true when IsActive__c is absent', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'SelectorConfig_FieldSetInclusion.Account_Contact_Fields.md-meta.xml',
      `${XML_HEADER}\n  <label>Account Contact Fields</label>\n  <protected>false</protected>\n${values([
        { field: 'BindingSObject__c', value: 'Account' },
        { field: 'FieldsetName__c', value: 'ContactRelatedFields' },
      ])}\n</CustomMetadata>\n`,
    );

    const { records } = scanLocalFieldSetInclusions([tmpDir]);

    expect(records[0].isActive).toBe(true);
  });

  it('ignores CustomMetadata components for other object types', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'ApplicationFactory_SelectorBinding.Account_Selector.md-meta.xml',
      `${XML_HEADER}\n  <label>Account Selector</label>\n  <protected>false</protected>\n${values([
        { field: 'BindingSObject__c', value: 'Account' },
        { field: 'To__c', value: 'AccountsSelector' },
      ])}\n</CustomMetadata>\n`,
    );

    const { records } = scanLocalFieldSetInclusions([tmpDir]);

    expect(records).toEqual([]);
  });

  it('reports a record with neither BindingSObject__c nor BindingSObjectAlternate__c set as malformed, excluded from records', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'SelectorConfig_FieldSetInclusion.Unresolvable.md-meta.xml',
      `${XML_HEADER}\n  <label>Unresolvable</label>\n  <protected>false</protected>\n${values([
        { field: 'BindingSObject__c' },
        { field: 'BindingSObjectAlternate__c' },
        { field: 'FieldsetName__c', value: 'SomeFields' },
      ])}\n</CustomMetadata>\n`,
    );

    const { records, malformed } = scanLocalFieldSetInclusions([tmpDir]);

    expect(records).toEqual([]);
    expect(malformed).toEqual([
      {
        developerName: 'Unresolvable',
        source: 'my-project',
        filePath: expect.stringContaining('SelectorConfig_FieldSetInclusion.Unresolvable.md-meta.xml') as string,
      },
    ]);
  });

  it('reports a record with both SObject reference fields set to different values as ambiguous, still included in records using the primary value', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'SelectorConfig_FieldSetInclusion.Ambiguous.md-meta.xml',
      `${XML_HEADER}\n  <label>Ambiguous</label>\n  <protected>false</protected>\n${values([
        { field: 'BindingSObject__c', value: 'Account' },
        { field: 'BindingSObjectAlternate__c', value: 'Contact' },
        { field: 'FieldsetName__c', value: 'SomeFields' },
      ])}\n</CustomMetadata>\n`,
    );

    const { records, ambiguous } = scanLocalFieldSetInclusions([tmpDir]);

    expect(records).toHaveLength(1);
    expect(records[0].sobject).toBe('Account');
    expect(ambiguous).toEqual([
      {
        developerName: 'Ambiguous',
        sobject: 'Account',
        alternateSobject: 'Contact',
        source: 'my-project',
        filePath: expect.stringContaining('SelectorConfig_FieldSetInclusion.Ambiguous.md-meta.xml') as string,
      },
    ]);
  });

  it('does not flag a record as ambiguous when both SObject reference fields are set to the same value', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'SelectorConfig_FieldSetInclusion.NotAmbiguous.md-meta.xml',
      `${XML_HEADER}\n  <label>NotAmbiguous</label>\n  <protected>false</protected>\n${values([
        { field: 'BindingSObject__c', value: 'Account' },
        { field: 'BindingSObjectAlternate__c', value: 'Account' },
        { field: 'FieldsetName__c', value: 'SomeFields' },
      ])}\n</CustomMetadata>\n`,
    );

    const { ambiguous } = scanLocalFieldSetInclusions([tmpDir]);

    expect(ambiguous).toEqual([]);
  });

  it('returns an empty result when no matching CustomMetadata components are found', () => {
    expect(scanLocalFieldSetInclusions([tmpDir])).toEqual({ records: [], malformed: [], ambiguous: [] });
  });
});
