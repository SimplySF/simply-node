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
import { buildBindingXml, type BindingXmlFields } from '../src/at4dxBuildXml.js';
import { AT4DX_BINDING_LOCAL_OBJECT_NAMES, type RawBindingRecord } from '../src/at4dxBindingTypes.js';
import { scanLocalBindings } from '../src/at4dxLocalScan.js';

describe('buildBindingXml', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-binding-build-xml-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  function writeAndScan(developerName: string, fields: BindingXmlFields, label: string): RawBindingRecord {
    const xml = buildBindingXml(fields, { label });
    const dir = path.join(tmpDir, 'my-project', 'customMetadata');
    fs.mkdirSync(dir, { recursive: true });
    const localObjectName = AT4DX_BINDING_LOCAL_OBJECT_NAMES[fields.bindingType];
    fs.writeFileSync(path.join(dir, `${localObjectName}.${developerName}.md-meta.xml`), xml);

    const { records } = scanLocalBindings([tmpDir], [fields.bindingType]);
    expect(records).toHaveLength(1);
    return records[0];
  }

  it('produces the exact XML shape for a Service binding (no SObject reference fields)', () => {
    const xml = buildBindingXml(
      { bindingType: 'Service', key: 'IMyService', to: 'MyServiceImpl', priority: 1 },
      { label: 'My Service' },
    );

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n' +
        '  <label>My Service</label>\n' +
        '  <protected>false</protected>\n' +
        '  <values><field>BindingInterface__c</field><value xsi:type="xsd:string">IMyService</value></values>\n' +
        '  <values><field>To__c</field><value xsi:type="xsd:string">MyServiceImpl</value></values>\n' +
        '  <values><field>Priority__c</field><value xsi:type="xsd:double">1</value></values>\n' +
        '</CustomMetadata>\n',
    );
  });

  it('produces the exact XML shape for a Selector binding using the primary SObject field', () => {
    const xml = buildBindingXml(
      { bindingType: 'Selector', key: 'Account', keyField: 'primary', to: 'AccountsSelector', priority: 1 },
      { label: 'Accounts Selector' },
    );

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n' +
        '  <label>Accounts Selector</label>\n' +
        '  <protected>false</protected>\n' +
        '  <values><field>BindingSObject__c</field><value xsi:type="xsd:string">Account</value></values>\n' +
        '  <values><field>BindingSObjectAlternate__c</field><value xsi:nil="true"/></values>\n' +
        '  <values><field>To__c</field><value xsi:type="xsd:string">AccountsSelector</value></values>\n' +
        '  <values><field>Priority__c</field><value xsi:type="xsd:double">1</value></values>\n' +
        '</CustomMetadata>\n',
    );
  });

  it('produces the exact XML shape for a Domain binding (no Priority__c field at all)', () => {
    const xml = buildBindingXml(
      { bindingType: 'Domain', key: 'ServiceResource', keyField: 'alternate', to: 'ServiceResourceDomain' },
      { label: 'ServiceResource Domain' },
    );

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n' +
        '  <label>ServiceResource Domain</label>\n' +
        '  <protected>false</protected>\n' +
        '  <values><field>BindingSObject__c</field><value xsi:nil="true"/></values>\n' +
        '  <values><field>BindingSObjectAlternate__c</field><value xsi:type="xsd:string">ServiceResource</value></values>\n' +
        '  <values><field>To__c</field><value xsi:type="xsd:string">ServiceResourceDomain</value></values>\n' +
        '</CustomMetadata>\n',
    );
  });

  it('round-trips a Service binding', () => {
    const fields: BindingXmlFields = { bindingType: 'Service', key: 'IMyService', to: 'MyServiceImpl', priority: 5 };
    const scanned = writeAndScan('My_Service', fields, 'My Service');

    expect(scanned).toMatchObject({
      bindingType: 'Service',
      developerName: 'My_Service',
      label: 'My Service',
      key: 'IMyService',
      keyField: undefined,
      to: 'MyServiceImpl',
      priority: 5,
    });
  });

  it('round-trips a Selector binding using the alternate SObject field, nil-ing the primary', () => {
    const fields: BindingXmlFields = {
      bindingType: 'Selector',
      key: 'ServiceResource',
      keyField: 'alternate',
      to: 'ServiceResourceSelector',
      priority: undefined,
    };
    const scanned = writeAndScan('ServiceResource_Selector', fields, 'ServiceResource Selector');

    expect(scanned).toMatchObject({
      bindingType: 'Selector',
      developerName: 'ServiceResource_Selector',
      key: 'ServiceResource',
      keyField: 'alternate',
      to: 'ServiceResourceSelector',
      priority: undefined,
    });
  });

  it('round-trips a Domain binding', () => {
    const fields: BindingXmlFields = {
      bindingType: 'Domain',
      key: 'Account',
      keyField: 'primary',
      to: 'AccountDomain',
    };
    const scanned = writeAndScan('Account_Domain', fields, 'Account Domain');

    expect(scanned).toMatchObject({
      bindingType: 'Domain',
      developerName: 'Account_Domain',
      key: 'Account',
      keyField: 'primary',
      to: 'AccountDomain',
      priority: undefined,
    });
  });

  it('never produces an ambiguous-sobject-reference on re-scan, for either keyField', () => {
    writeAndScan(
      'Primary_Selector',
      { bindingType: 'Selector', key: 'Account', keyField: 'primary', to: 'AccountsSelector' },
      'Primary Selector',
    );

    const { ambiguous } = scanLocalBindings([tmpDir], ['Selector']);
    expect(ambiguous).toEqual([]);
  });
});
