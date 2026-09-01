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

import { describe, expect, it } from 'vitest';
import {
  diffValueEntries,
  patchCustomMetadataXml,
  UnpatchableValueShapeError,
  type CustomMetadataValueInput,
} from '../src/customMetadataXml.js';

/* eslint-disable camelcase -- CustomMetadata field API names (BindingSObject__c, To__c, etc.) */

// A hand-crafted, non-canonical document: field order differs from this tool's own writer,
// `<values>` blocks are multi-line/indented (Salesforce retrieve style), there's a comment, and one
// field this tool doesn't model at all.
const nonCanonicalXml = `<?xml version="1.0" encoding="UTF-8"?>
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <label>Account Selector</label>
    <protected>false</protected>
    <!-- SObject reference -->
    <values>
        <field>BindingSObject__c</field>
        <value xsi:type="xsd:string">Account</value>
    </values>
    <values>
        <field>BindingSObjectAlternate__c</field>
        <value xsi:nil="true"/>
    </values>
    <values>
        <field>To__c</field>
        <value xsi:type="xsd:string">AccountsSelector</value>
    </values>
    <values>
        <field>Priority__c</field>
        <value xsi:type="xsd:double">1.0</value>
    </values>
    <values>
        <field>UnknownCustomField__c</field>
        <value xsi:type="xsd:string">leave me alone</value>
    </values>
</CustomMetadata>
`;

describe('diffValueEntries', () => {
  it('returns only entries whose field/value/type differ at the same position', () => {
    const before: CustomMetadataValueInput[] = [
      { field: 'A__c', value: '1' },
      { field: 'B__c', value: '2' },
      { field: 'C__c', value: undefined },
    ];
    const after: CustomMetadataValueInput[] = [
      { field: 'A__c', value: '1' },
      { field: 'B__c', value: '3' },
      { field: 'C__c', value: '4' },
    ];

    expect(diffValueEntries(before, after)).toEqual([
      { field: 'B__c', value: '3' },
      { field: 'C__c', value: '4' },
    ]);
  });

  it('returns nothing when nothing changed', () => {
    const entries: CustomMetadataValueInput[] = [{ field: 'A__c', value: '1', type: 'double' }];
    expect(diffValueEntries(entries, entries)).toEqual([]);
  });

  it('treats a type change as a change even when the text value is the same', () => {
    const before: CustomMetadataValueInput[] = [{ field: 'A__c', value: '1', type: 'string' }];
    const after: CustomMetadataValueInput[] = [{ field: 'A__c', value: '1', type: 'double' }];
    expect(diffValueEntries(before, after)).toEqual(after);
  });
});

describe('patchCustomMetadataXml', () => {
  it('changes only the targeted field, leaving field order, indentation, the comment, and unmodeled fields byte-identical', () => {
    const result = patchCustomMetadataXml(nonCanonicalXml, 'Account Selector', [
      { field: 'Priority__c', value: '5', type: 'double' },
    ]);

    expect(result).toContain('<field>Priority__c</field>\n        <value xsi:type="xsd:double">5</value>');

    // Everything else — including the multi-line/indented shape of the *other* values blocks,
    // their field order, and the comment — is untouched.
    const unrelated = nonCanonicalXml.replace(
      '<value xsi:type="xsd:double">1.0</value>',
      '<value xsi:type="xsd:double">5</value>',
    );
    expect(result).toBe(unrelated);
  });

  it('is a byte-for-byte no-op when changedEntries is empty', () => {
    expect(patchCustomMetadataXml(nonCanonicalXml, 'Account Selector', [])).toBe(nonCanonicalXml);
  });

  it('patches <label> only when it differs', () => {
    const same = patchCustomMetadataXml(nonCanonicalXml, 'Account Selector', []);
    expect(same).toBe(nonCanonicalXml);

    const changed = patchCustomMetadataXml(nonCanonicalXml, 'New Label', []);
    expect(changed).toContain('<label>New Label</label>');
    expect(changed).not.toContain('<label>Account Selector</label>');
  });

  it('flips a field from xsi:nil to a typed value and back (keyField swap)', () => {
    const result = patchCustomMetadataXml(nonCanonicalXml, 'Account Selector', [
      { field: 'BindingSObject__c', value: undefined },
      { field: 'BindingSObjectAlternate__c', value: 'Account' },
    ]);

    expect(result).toContain('<field>BindingSObject__c</field>\n        <value xsi:nil="true"/>');
    expect(result).toContain(
      '<field>BindingSObjectAlternate__c</field>\n        <value xsi:type="xsd:string">Account</value>',
    );
  });

  it("appends a new <values> block, matching the file's existing indentation, when a field has no block at all", () => {
    const result = patchCustomMetadataXml(nonCanonicalXml, 'Account Selector', [
      { field: 'BindingSequence__c', value: '10', type: 'double' },
    ]);

    expect(result).toContain(
      '    <values><field>BindingSequence__c</field><value xsi:type="xsd:double">10</value></values>\n</CustomMetadata>',
    );
    // The rest of the document is untouched.
    expect(result.startsWith(nonCanonicalXml.replace('</CustomMetadata>\n', ''))).toBe(true);
  });

  it("throws UnpatchableValueShapeError when a field's <values> block exists but its <value> element is unrecognizable", () => {
    const weird = `<?xml version="1.0" encoding="UTF-8"?>
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <label>Weird</label>
  <protected>false</protected>
  <values>
    <field>To__c</field>
    <!-- comment inside where <value> should be, not a <value> element at all -->
  </values>
</CustomMetadata>
`;

    expect(() => patchCustomMetadataXml(weird, 'Weird', [{ field: 'To__c', value: 'X' }])).toThrow(
      UnpatchableValueShapeError,
    );
  });

  it('escapes XML-significant characters in a patched value', () => {
    const result = patchCustomMetadataXml(nonCanonicalXml, 'Account Selector', [
      { field: 'To__c', value: 'A & B < C' },
    ]);

    expect(result).toContain('<value xsi:type="xsd:string">A &amp; B &lt; C</value>');
  });
});
