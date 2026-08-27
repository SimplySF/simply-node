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
  filterDomainProcessBindingIssues,
  resolveDomainProcessBindings,
  validateDomainProcessBindings,
} from '../src/at4dxDomainProcessResolve.js';
import {
  DOMAIN_PROCESS_BINDING_RULES,
  type AmbiguousDomainProcessBindingRecord,
  type DomainProcessBindingIssueRule,
  type MalformedDomainProcessBindingRecord,
  type RawDomainProcessBindingRecord,
} from '../src/at4dxDomainProcessBindingTypes.js';

function record(
  overrides: Partial<RawDomainProcessBindingRecord> & Pick<RawDomainProcessBindingRecord, 'order'>,
): RawDomainProcessBindingRecord {
  return {
    developerName: `Record_${overrides.order}`,
    label: `Record_${overrides.order}`,
    sobject: 'Account',
    sobjectField: 'primary',
    processContext: 'TriggerExecution',
    triggerOperation: 'Before_Insert',
    type: 'Action',
    classToInject: 'SomeClass',
    isActive: true,
    executeAsynchronous: false,
    logicalInverse: false,
    preventRecursive: false,
    source: 'test',
    ...overrides,
  };
}

describe('DOMAIN_PROCESS_BINDING_RULES', () => {
  it('has a table entry, keyed to itself, for every DomainProcessBindingIssueRule', () => {
    const rules: DomainProcessBindingIssueRule[] = [
      'order-collision',
      'missing-context-field',
      'ambiguous-sobject-reference',
      'duplicate-developer-name',
      'missing-sobject-reference',
    ];

    for (const rule of rules) {
      expect(DOMAIN_PROCESS_BINDING_RULES[rule].rule).toBe(rule);
    }
    expect(Object.keys(DOMAIN_PROCESS_BINDING_RULES).sort()).toEqual([...rules].sort());
  });
});

describe('resolveDomainProcessBindings', () => {
  it('sorts records within a group by order ascending', () => {
    const third = record({ order: 3, developerName: 'Third' });
    const first = record({ order: 1, developerName: 'First' });
    const second = record({ order: 2, developerName: 'Second' });

    const rows = resolveDomainProcessBindings([third, first, second]);

    expect(rows.map((row) => row.developerName)).toEqual(['First', 'Second', 'Third']);
  });

  it('flags orderCollision when two active records in the same group share an order', () => {
    const a = record({ order: 1, developerName: 'A' });
    const b = record({ order: 1, developerName: 'B' });

    const rows = resolveDomainProcessBindings([a, b]);

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.orderCollision).toBe(true);
    }
  });

  it('does not flag a collision between an active and an inactive record sharing an order', () => {
    const active = record({ order: 1, developerName: 'Active', isActive: true });
    const inactive = record({ order: 1, developerName: 'Inactive', isActive: false });

    const rows = resolveDomainProcessBindings([active, inactive]);

    expect(rows.find((row) => row.developerName === 'Active')?.orderCollision).toBeUndefined();
    expect(rows.find((row) => row.developerName === 'Inactive')?.orderCollision).toBeUndefined();
  });

  it('does not flag a collision between records in different groups (different SObject, context, or operation)', () => {
    const accountBeforeInsert = record({ order: 1, developerName: 'AccountBeforeInsert', sobject: 'Account' });
    const contactBeforeInsert = record({ order: 1, developerName: 'ContactBeforeInsert', sobject: 'Contact' });
    const accountAfterInsert = record({
      order: 1,
      developerName: 'AccountAfterInsert',
      sobject: 'Account',
      triggerOperation: 'After_Insert',
    });

    const rows = resolveDomainProcessBindings([accountBeforeInsert, contactBeforeInsert, accountAfterInsert]);

    for (const row of rows) {
      expect(row.orderCollision).toBeUndefined();
    }
  });

  it('does not flag a collision between a Criteria and an Action sharing an order', () => {
    const criteria = record({ order: 1, developerName: 'Criteria', type: 'Criteria' });
    const action = record({ order: 1, developerName: 'Action', type: 'Action' });

    const rows = resolveDomainProcessBindings([criteria, action]);

    expect(rows.find((row) => row.developerName === 'Criteria')?.orderCollision).toBeUndefined();
    expect(rows.find((row) => row.developerName === 'Action')?.orderCollision).toBeUndefined();
  });

  it('orders a Criteria before an Action sharing the same sequence, regardless of input order', () => {
    const action = record({ order: 1, developerName: 'Action', type: 'Action' });
    const criteria = record({ order: 1, developerName: 'Criteria', type: 'Criteria' });

    const rows = resolveDomainProcessBindings([action, criteria]);

    expect(rows.map((row) => row.developerName)).toEqual(['Criteria', 'Action']);
  });

  it('interleaves Criteria and Action by order across a mixed sequence', () => {
    const actionOne = record({ order: 1, developerName: 'ActionOne', type: 'Action' });
    const criteriaOne = record({ order: 1, developerName: 'CriteriaOne', type: 'Criteria' });
    const criteriaTwo = record({ order: 2, developerName: 'CriteriaTwo', type: 'Criteria' });
    const actionTwo = record({ order: 2, developerName: 'ActionTwo', type: 'Action' });

    const rows = resolveDomainProcessBindings([actionOne, actionTwo, criteriaTwo, criteriaOne]);

    expect(rows.map((row) => row.developerName)).toEqual(['CriteriaOne', 'ActionOne', 'CriteriaTwo', 'ActionTwo']);
  });

  it('flags a collision between two active records of the same type sharing an order', () => {
    const first = record({ order: 1, developerName: 'FirstCriteria', type: 'Criteria' });
    const second = record({ order: 1, developerName: 'SecondCriteria', type: 'Criteria' });

    const rows = resolveDomainProcessBindings([first, second]);

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.orderCollision).toBe(true);
    }
  });

  it('does not flag a collision between two active records of the same type in the same scope at different orders', () => {
    const first = record({ order: 1, developerName: 'First' });
    const second = record({ order: 2, developerName: 'Second' });

    const rows = resolveDomainProcessBindings([first, second]);

    for (const row of rows) {
      expect(row.orderCollision).toBeUndefined();
    }
  });

  it('groups DomainMethodExecution records by domainMethodToken instead of triggerOperation', () => {
    const first = record({
      order: 1,
      developerName: 'First',
      processContext: 'DomainMethodExecution',
      triggerOperation: undefined,
      domainMethodToken: 'ProcessDeals',
    });
    const differentToken = record({
      order: 1,
      developerName: 'DifferentToken',
      processContext: 'DomainMethodExecution',
      triggerOperation: undefined,
      domainMethodToken: 'ProcessOther',
    });

    const rows = resolveDomainProcessBindings([first, differentToken]);

    for (const row of rows) {
      expect(row.orderCollision).toBeUndefined();
    }
  });

  it('returns an empty array for an empty input', () => {
    expect(resolveDomainProcessBindings([])).toEqual([]);
  });
});

describe('validateDomainProcessBindings', () => {
  const noDiagnostics = {
    malformed: [] as MalformedDomainProcessBindingRecord[],
    ambiguous: [] as AmbiguousDomainProcessBindingRecord[],
  };

  it('returns an empty array for well-formed input with no problems', () => {
    const a = record({ order: 1, developerName: 'A' });
    const b = record({ order: 2, developerName: 'B' });

    expect(validateDomainProcessBindings([a, b], noDiagnostics)).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(validateDomainProcessBindings([], noDiagnostics)).toEqual([]);
  });

  it('flags an order-collision error for each active record sharing an order in the same group', () => {
    const a = record({ order: 1, developerName: 'A' });
    const b = record({ order: 1, developerName: 'B' });

    const issues = validateDomainProcessBindings([a, b], noDiagnostics);

    expect(issues).toHaveLength(2);
    for (const issue of issues) {
      expect(issue.severity).toBe('error');
      expect(issue.rule).toBe('order-collision');
    }
    expect(issues.map((issue) => issue.developerName).sort()).toEqual(['A', 'B']);
  });

  it('flags a missing-context-field error when TriggerExecution has no triggerOperation', () => {
    const dead = record({ order: 1, developerName: 'Dead', triggerOperation: undefined });

    const issues = validateDomainProcessBindings([dead], noDiagnostics);

    expect(issues).toEqual([
      expect.objectContaining({ severity: 'error', rule: 'missing-context-field', developerName: 'Dead' }),
    ]);
  });

  it('flags a missing-context-field error when DomainMethodExecution has no domainMethodToken', () => {
    const dead = record({
      order: 1,
      developerName: 'Dead',
      processContext: 'DomainMethodExecution',
      triggerOperation: undefined,
      domainMethodToken: undefined,
    });

    const issues = validateDomainProcessBindings([dead], noDiagnostics);

    expect(issues).toEqual([
      expect.objectContaining({ severity: 'error', rule: 'missing-context-field', developerName: 'Dead' }),
    ]);
  });

  it('flags a missing-sobject-reference error for each malformed record', () => {
    const malformed: MalformedDomainProcessBindingRecord[] = [{ developerName: 'Unresolvable', source: 'core' }];

    const issues = validateDomainProcessBindings([], { malformed, ambiguous: [] });

    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        rule: 'missing-sobject-reference',
        developerName: 'Unresolvable',
        source: 'core',
      }),
    ]);
  });

  it('flags an ambiguous-sobject-reference warning for each ambiguous record', () => {
    const ambiguous: AmbiguousDomainProcessBindingRecord[] = [
      { developerName: 'Ambiguous', sobject: 'Account', alternateSobject: 'Contact', source: 'core' },
    ];

    const issues = validateDomainProcessBindings([], { malformed: [], ambiguous });

    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'warning',
        rule: 'ambiguous-sobject-reference',
        developerName: 'Ambiguous',
        sobject: 'Account',
      }),
    ]);
  });

  it('flags a duplicate-developer-name error for each occurrence of a DeveloperName defined more than once', () => {
    const core = record({ order: 1, developerName: 'Shared', source: 'core' });
    const app = record({ order: 1, developerName: 'Shared', sobject: 'Contact', source: 'app' });

    const issues = validateDomainProcessBindings([core, app], noDiagnostics);

    const duplicateIssues = issues.filter((issue) => issue.rule === 'duplicate-developer-name');
    expect(duplicateIssues).toHaveLength(2);
    expect(duplicateIssues.map((issue) => issue.source).sort()).toEqual(['app', 'core']);
    for (const issue of duplicateIssues) {
      expect(issue.severity).toBe('error');
    }
  });

  it('does not flag duplicate-developer-name for a single occurrence', () => {
    const a = record({ order: 1, developerName: 'Unique' });

    const issues = validateDomainProcessBindings([a], noDiagnostics);

    expect(issues.filter((issue) => issue.rule === 'duplicate-developer-name')).toEqual([]);
  });

  it("stamps every issue's severity and scope from DOMAIN_PROCESS_BINDING_RULES", () => {
    const collision = [record({ order: 1, developerName: 'A' }), record({ order: 1, developerName: 'B' })];
    const dead = record({ order: 2, developerName: 'Dead', triggerOperation: undefined });
    const malformed: MalformedDomainProcessBindingRecord[] = [{ developerName: 'Malformed', source: 'core' }];
    const ambiguous: AmbiguousDomainProcessBindingRecord[] = [
      { developerName: 'Ambiguous', sobject: 'Account', alternateSobject: 'Contact', source: 'core' },
    ];
    const duplicate = [
      record({ order: 3, developerName: 'Dup', source: 'core' }),
      record({ order: 3, developerName: 'Dup', sobject: 'Contact', source: 'app' }),
    ];

    const issues = validateDomainProcessBindings([...collision, dead, ...duplicate], { malformed, ambiguous });

    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      const info = DOMAIN_PROCESS_BINDING_RULES[issue.rule];
      expect(issue.severity).toBe(info.severity);
      expect(issue.scope).toBe(info.scope);
    }
  });

  it('accepts a scan-result envelope directly, identical to the two-argument form on the same data', () => {
    const a = record({ order: 1, developerName: 'A' });
    const malformed: MalformedDomainProcessBindingRecord[] = [{ developerName: 'Malformed', source: 'core' }];
    const ambiguous: AmbiguousDomainProcessBindingRecord[] = [
      { developerName: 'Ambiguous', sobject: 'Account', alternateSobject: 'Contact', source: 'core' },
    ];

    const viaEnvelope = validateDomainProcessBindings({ records: [a], malformed, ambiguous });
    const viaTwoArgs = validateDomainProcessBindings([a], { malformed, ambiguous });

    expect(viaEnvelope).toEqual(viaTwoArgs);
  });

  const recordScopedRules: DomainProcessBindingIssueRule[] = Object.values(DOMAIN_PROCESS_BINDING_RULES)
    .filter((info) => info.scope === 'record')
    .map((info) => info.rule);

  it.each(recordScopedRules)(
    'round-trips for record-scoped rule %s: validate-then-filter-by-SObject equals filter-records-then-validate',
    (rule) => {
      const account = record({ order: 1, developerName: `${rule}-account`, sobject: 'Account' });
      const contact = record({ order: 1, developerName: `${rule}-contact`, sobject: 'Contact' });
      const all = [account, contact];

      const filteredThenValidated = validateDomainProcessBindings(
        all.filter((r) => r.sobject === 'Account'),
        noDiagnostics,
      ).filter((issue) => issue.rule === rule);

      const { inScope } = filterDomainProcessBindingIssues(validateDomainProcessBindings(all, noDiagnostics), {
        sobjects: ['Account'],
      });

      expect(inScope.filter((issue) => issue.rule === rule)).toEqual(filteredThenValidated);
    },
  );

  it('reports a duplicate-developer-name shared across SObjects as scanWide, not dropped by an SObject filter', () => {
    const accountBinding = record({ order: 1, developerName: 'Shared', sobject: 'Account', source: 'core' });
    const contactBinding = record({ order: 1, developerName: 'Shared', sobject: 'Contact', source: 'app' });

    const issues = validateDomainProcessBindings([accountBinding, contactBinding], noDiagnostics);
    const { inScope, scanWide } = filterDomainProcessBindingIssues(issues, { sobjects: ['Account'] });

    expect(inScope.filter((issue) => issue.rule === 'duplicate-developer-name')).toEqual([]);
    expect(scanWide.filter((issue) => issue.rule === 'duplicate-developer-name')).toHaveLength(2);
  });

  it('reports a malformed record as scanWide regardless of the SObject filter', () => {
    const malformed: MalformedDomainProcessBindingRecord[] = [{ developerName: 'Unresolvable', source: 'core' }];

    const issues = validateDomainProcessBindings([], { malformed, ambiguous: [] });
    const { inScope, scanWide } = filterDomainProcessBindingIssues(issues, { sobjects: ['Account'] });

    expect(inScope).toEqual([]);
    expect(scanWide).toHaveLength(1);
  });
});

describe('filterDomainProcessBindingIssues', () => {
  const noDiagnostics = {
    malformed: [] as MalformedDomainProcessBindingRecord[],
    ambiguous: [] as AmbiguousDomainProcessBindingRecord[],
  };

  it('puts every record-scoped issue in inScope when sobjects is omitted', () => {
    const account = record({ order: 1, developerName: 'A', sobject: 'Account', triggerOperation: undefined });
    const issues = validateDomainProcessBindings([account], noDiagnostics);

    const { inScope, scanWide } = filterDomainProcessBindingIssues(issues, {});

    expect(inScope).toEqual(issues);
    expect(scanWide).toEqual([]);
  });

  it('puts every record-scoped issue in inScope when sobjects is an empty array', () => {
    const account = record({ order: 1, developerName: 'A', sobject: 'Account', triggerOperation: undefined });
    const issues = validateDomainProcessBindings([account], noDiagnostics);

    const { inScope } = filterDomainProcessBindingIssues(issues, { sobjects: [] });

    expect(inScope).toEqual(issues);
  });

  it('drops a record-scoped issue for an SObject not in the filter', () => {
    const contact = record({ order: 1, developerName: 'A', sobject: 'Contact', triggerOperation: undefined });
    const issues = validateDomainProcessBindings([contact], noDiagnostics);

    const { inScope } = filterDomainProcessBindingIssues(issues, { sobjects: ['Account'] });

    expect(inScope).toEqual([]);
  });
});
