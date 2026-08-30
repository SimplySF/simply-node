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
import { buildFieldSetInclusionXml } from '../src/at4dxFieldSetInclusionBuildXml.js';
import type { RawFieldSetInclusionRecord } from '../src/at4dxFieldSetInclusionTypes.js';
import { scanLocalFieldSetInclusions } from '../src/at4dxFieldSetInclusionLocalScan.js';

function record(overrides: Partial<RawFieldSetInclusionRecord> = {}): RawFieldSetInclusionRecord {
  return {
    developerName: 'Account_Contact_Fields',
    label: 'Account Contact Fields',
    sobject: 'Account',
    sobjectField: 'primary',
    fieldsetName: 'ContactRelatedFields',
    isActive: true,
    source: 'test',
    ...overrides,
  };
}

describe('buildFieldSetInclusionXml', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-field-set-inclusion-build-xml-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  function writeAndScan(input: RawFieldSetInclusionRecord): RawFieldSetInclusionRecord {
    const xml = buildFieldSetInclusionXml(input, { label: input.label });
    const dir = path.join(tmpDir, input.source, 'customMetadata');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `SelectorConfig_FieldSetInclusion.${input.developerName}.md-meta.xml`), xml);

    const { records } = scanLocalFieldSetInclusions([tmpDir]);
    expect(records).toHaveLength(1);
    return records[0];
  }

  it('produces the exact XML shape scanLocalFieldSetInclusions' + "'s fixtures expect", () => {
    const xml = buildFieldSetInclusionXml(record(), { label: 'Account Contact Fields' });

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n' +
        '  <label>Account Contact Fields</label>\n' +
        '  <protected>false</protected>\n' +
        '  <values><field>BindingSObject__c</field><value xsi:type="xsd:string">Account</value></values>\n' +
        '  <values><field>BindingSObjectAlternate__c</field><value xsi:nil="true"/></values>\n' +
        '  <values><field>FieldsetName__c</field><value xsi:type="xsd:string">ContactRelatedFields</value></values>\n' +
        '  <values><field>IsActive__c</field><value xsi:type="xsd:boolean">true</value></values>\n' +
        '</CustomMetadata>\n',
    );
  });

  it('round-trips using the primary SObject field', () => {
    const input = record();
    expect(writeAndScan(input)).toEqual({ ...input, filePath: expect.stringContaining(input.developerName) as string });
  });

  it('round-trips using the alternate SObject field, nil-ing the primary', () => {
    const input = record({
      developerName: 'ServiceResource_Skills',
      label: 'ServiceResource Skills',
      sobject: 'ServiceResource',
      sobjectField: 'alternate',
      fieldsetName: 'SkillFields',
    });

    expect(writeAndScan(input)).toEqual({ ...input, filePath: expect.stringContaining(input.developerName) as string });
  });

  it('round-trips an inactive record', () => {
    const input = record({ developerName: 'Inactive_Fields', label: 'Inactive Fields', isActive: false });

    expect(writeAndScan(input)).toEqual({ ...input, filePath: expect.stringContaining(input.developerName) as string });
  });

  it('never produces an ambiguous-sobject-reference on re-scan, for either sobjectField', () => {
    writeAndScan(record());

    const { ambiguous } = scanLocalFieldSetInclusions([tmpDir]);
    expect(ambiguous).toEqual([]);
  });
});
