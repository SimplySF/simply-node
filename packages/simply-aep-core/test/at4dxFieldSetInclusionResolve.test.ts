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
import { validateFieldSetInclusions } from '../src/at4dxFieldSetInclusionResolve.js';
import {
  FIELD_SET_INCLUSION_RULES,
  type AmbiguousFieldSetInclusionRecord,
  type FieldSetInclusionIssueRule,
  type MalformedFieldSetInclusionRecord,
  type RawFieldSetInclusionRecord,
} from '../src/at4dxFieldSetInclusionTypes.js';

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

const noDiagnostics = {
  malformed: [] as MalformedFieldSetInclusionRecord[],
  ambiguous: [] as AmbiguousFieldSetInclusionRecord[],
};

describe('FIELD_SET_INCLUSION_RULES', () => {
  it('has a table entry, keyed to itself, for every FieldSetInclusionIssueRule', () => {
    const rules: FieldSetInclusionIssueRule[] = [
      'missing-sobject-reference',
      'ambiguous-sobject-reference',
      'unsupported-entity-definition-object',
      'unnecessary-entity-definition-alternate',
      'duplicate-fieldset-name',
      'duplicate-developer-name',
    ];

    for (const rule of rules) {
      expect(FIELD_SET_INCLUSION_RULES[rule].rule).toBe(rule);
    }
    expect(Object.keys(FIELD_SET_INCLUSION_RULES).sort()).toEqual([...rules].sort());
  });
});

describe('validateFieldSetInclusions', () => {
  it('returns an empty array for well-formed input', () => {
    expect(validateFieldSetInclusions([record()], noDiagnostics)).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(validateFieldSetInclusions([], noDiagnostics)).toEqual([]);
  });

  it('flags a missing-sobject-reference error for a malformed record', () => {
    const malformed: MalformedFieldSetInclusionRecord[] = [{ developerName: 'Unresolvable', source: 'core' }];

    const issues = validateFieldSetInclusions([], { malformed, ambiguous: [] });

    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        rule: 'missing-sobject-reference',
        developerName: 'Unresolvable',
      }),
    ]);
  });

  it('flags an ambiguous-sobject-reference error for each ambiguous record', () => {
    const ambiguous: AmbiguousFieldSetInclusionRecord[] = [
      { developerName: 'Ambiguous', sobject: 'Account', alternateSobject: 'Contact', source: 'core' },
    ];

    const issues = validateFieldSetInclusions([], { malformed: [], ambiguous });

    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        rule: 'ambiguous-sobject-reference',
        developerName: 'Ambiguous',
        sobject: 'Account',
      }),
    ]);
  });

  it('flags an unsupported-entity-definition-object error for a record on the primary field', () => {
    const unsupported = record({ sobject: 'ServiceResource', sobjectField: 'primary' });

    const issues = validateFieldSetInclusions([unsupported], noDiagnostics);

    expect(issues).toEqual([
      expect.objectContaining({ severity: 'error', rule: 'unsupported-entity-definition-object' }),
    ]);
  });

  it('flags an unnecessary-entity-definition-alternate warning for an eligible object on the alternate field', () => {
    const unnecessary = record({ sobject: 'Account', sobjectField: 'alternate' });

    const issues = validateFieldSetInclusions([unnecessary], noDiagnostics);

    expect(issues).toEqual([
      expect.objectContaining({ severity: 'warning', rule: 'unnecessary-entity-definition-alternate' }),
    ]);
  });

  it('flags a duplicate-fieldset-name error for two records sharing FieldsetName__c on different SObjects', () => {
    const first = record({ developerName: 'First', sobject: 'Account', fieldsetName: 'SharedFields' });
    const second = record({ developerName: 'Second', sobject: 'Contact', fieldsetName: 'SharedFields' });

    const issues = validateFieldSetInclusions([first, second], noDiagnostics);

    const duplicateIssues = issues.filter((issue) => issue.rule === 'duplicate-fieldset-name');
    expect(duplicateIssues).toHaveLength(2);
    for (const issue of duplicateIssues) {
      expect(issue.severity).toBe('error');
    }
  });

  it('still flags duplicate-fieldset-name for two records sharing FieldsetName__c on the same SObject', () => {
    const first = record({ developerName: 'First', sobject: 'Account', fieldsetName: 'SharedFields' });
    const second = record({ developerName: 'Second', sobject: 'Account', fieldsetName: 'SharedFields' });

    const issues = validateFieldSetInclusions([first, second], noDiagnostics);

    expect(issues.filter((issue) => issue.rule === 'duplicate-fieldset-name')).toHaveLength(2);
  });

  it('flags a duplicate-developer-name error for each occurrence', () => {
    const first = record({ developerName: 'Shared', sobject: 'Account', source: 'core' });
    const second = record({ developerName: 'Shared', sobject: 'Contact', source: 'app' });

    const issues = validateFieldSetInclusions([first, second], noDiagnostics);

    const duplicateIssues = issues.filter((issue) => issue.rule === 'duplicate-developer-name');
    expect(duplicateIssues).toHaveLength(2);
    expect(duplicateIssues.map((issue) => issue.source).sort()).toEqual(['app', 'core']);
  });

  it("stamps every issue's severity and scope from FIELD_SET_INCLUSION_RULES", () => {
    const unsupported = record({ developerName: 'Unsupported', sobject: 'ServiceResource', sobjectField: 'primary' });
    const malformed: MalformedFieldSetInclusionRecord[] = [{ developerName: 'Malformed', source: 'core' }];
    const ambiguous: AmbiguousFieldSetInclusionRecord[] = [
      { developerName: 'Ambiguous', sobject: 'Account', alternateSobject: 'Contact', source: 'core' },
    ];

    const issues = validateFieldSetInclusions([unsupported], { malformed, ambiguous });

    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      const info = FIELD_SET_INCLUSION_RULES[issue.rule];
      expect(issue.severity).toBe(info.severity);
      expect(issue.scope).toBe(info.scope);
    }
  });

  it('accepts a scan-result envelope directly, identical to the two-argument form on the same data', () => {
    const a = record({ developerName: 'A' });
    const malformed: MalformedFieldSetInclusionRecord[] = [{ developerName: 'Malformed', source: 'core' }];
    const ambiguous: AmbiguousFieldSetInclusionRecord[] = [
      { developerName: 'Ambiguous', sobject: 'Account', alternateSobject: 'Contact', source: 'core' },
    ];

    const viaEnvelope = validateFieldSetInclusions({ records: [a], malformed, ambiguous });
    const viaTwoArgs = validateFieldSetInclusions([a], { malformed, ambiguous });

    expect(viaEnvelope).toEqual(viaTwoArgs);
  });
});
