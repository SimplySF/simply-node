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
import { validateBindings } from '../src/at4dxValidate.js';
import {
  BINDING_RULES,
  type AmbiguousBindingRecord,
  type BindingIssueRule,
  type MalformedBindingRecord,
  type RawBindingRecord,
} from '../src/at4dxBindingTypes.js';
import type { RawApexTriggerRecord } from '../src/at4dxApexTriggerTypes.js';

function trigger(
  overrides: Partial<RawApexTriggerRecord> & Pick<RawApexTriggerRecord, 'sobject'>,
): RawApexTriggerRecord {
  return {
    name: `${overrides.sobject}Trigger`,
    triggerHandlerClasses: [],
    active: true,
    source: 'test',
    ...overrides,
  };
}

function record(overrides: Partial<RawBindingRecord> & Pick<RawBindingRecord, 'bindingType'>): RawBindingRecord {
  return {
    developerName: `Record_${overrides.bindingType}`,
    label: `Record ${overrides.bindingType}`,
    key: 'Account',
    keyField: overrides.bindingType === 'Service' ? undefined : 'primary',
    to: 'SomeClass',
    source: 'test',
    ...overrides,
  };
}

const noDiagnostics = {
  malformed: [] as MalformedBindingRecord[],
  ambiguous: [] as AmbiguousBindingRecord[],
};

describe('BINDING_RULES', () => {
  it('has a table entry, keyed to itself, for every BindingIssueRule', () => {
    const rules: BindingIssueRule[] = [
      'missing-sobject-reference',
      'ambiguous-sobject-reference',
      'unsupported-entity-definition-object',
      'unnecessary-entity-definition-alternate',
      'duplicate-to',
      'duplicate-domain-sobject',
      'duplicate-unit-of-work-sobject',
      'sequence-collision',
      'duplicate-developer-name',
      'missing-domain-trigger',
    ];

    for (const rule of rules) {
      expect(BINDING_RULES[rule].rule).toBe(rule);
    }
    expect(Object.keys(BINDING_RULES).sort()).toEqual([...rules].sort());
  });
});

describe('validateBindings', () => {
  it('returns an empty array for well-formed input across all four writable types', () => {
    const service = record({ bindingType: 'Service', developerName: 'Svc', key: 'IMyService', to: 'MyServiceImpl' });
    const selector = record({ bindingType: 'Selector', developerName: 'Sel', key: 'Account', to: 'AccountsSelector' });
    const domain = record({ bindingType: 'Domain', developerName: 'Dom', key: 'Contact', to: 'ContactDomain' });
    const unitOfWork = record({
      bindingType: 'UnitOfWork',
      developerName: 'UOW',
      key: 'Opportunity',
      to: undefined,
      sequence: 10,
    });

    expect(validateBindings([service, selector, domain, unitOfWork], noDiagnostics)).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(validateBindings([], noDiagnostics)).toEqual([]);
  });

  it('flags a missing-sobject-reference error for a malformed Selector/Domain record', () => {
    const malformed: MalformedBindingRecord[] = [
      { bindingType: 'Selector', developerName: 'Unresolvable', source: 'core' },
    ];

    const issues = validateBindings([], { malformed, ambiguous: [] });

    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        rule: 'missing-sobject-reference',
        bindingType: 'Selector',
        developerName: 'Unresolvable',
        message: expect.stringContaining('BindingSObject__c') as string,
      }),
    ]);
  });

  it('flags a missing-sobject-reference error with a Service-specific message for a malformed Service record', () => {
    const malformed: MalformedBindingRecord[] = [
      { bindingType: 'Service', developerName: 'Unresolvable', source: 'core' },
    ];

    const issues = validateBindings([], { malformed, ambiguous: [] });

    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        rule: 'missing-sobject-reference',
        bindingType: 'Service',
        message: expect.stringContaining('BindingInterface__c') as string,
      }),
    ]);
  });

  it('flags an ambiguous-sobject-reference error for each ambiguous record', () => {
    const ambiguous: AmbiguousBindingRecord[] = [
      { bindingType: 'Domain', developerName: 'Ambiguous', key: 'Account', alternateKey: 'Contact', source: 'core' },
    ];

    const issues = validateBindings([], { malformed: [], ambiguous });

    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        rule: 'ambiguous-sobject-reference',
        developerName: 'Ambiguous',
        key: 'Account',
      }),
    ]);
  });

  it('flags an unsupported-entity-definition-object error for a Selector/Domain record on the primary field', () => {
    const unsupported = record({ bindingType: 'Selector', key: 'ServiceResource', keyField: 'primary' });

    const issues = validateBindings([unsupported], noDiagnostics);

    expect(issues).toEqual([
      expect.objectContaining({ severity: 'error', rule: 'unsupported-entity-definition-object' }),
    ]);
  });

  it('does not flag unsupported-entity-definition-object for Service (no SObject reference at all)', () => {
    const service = record({ bindingType: 'Service', key: 'IMyService', keyField: undefined });

    const issues = validateBindings([service], noDiagnostics);

    expect(issues.filter((issue) => issue.rule === 'unsupported-entity-definition-object')).toEqual([]);
  });

  it('flags an unnecessary-entity-definition-alternate warning for an eligible object on the alternate field', () => {
    const unnecessary = record({ bindingType: 'Domain', key: 'Account', keyField: 'alternate' });

    const issues = validateBindings([unnecessary], noDiagnostics);

    expect(issues).toEqual([
      expect.objectContaining({ severity: 'warning', rule: 'unnecessary-entity-definition-alternate' }),
    ]);
  });

  it('flags a duplicate-to error for two Selector records sharing To__c', () => {
    const first = record({ bindingType: 'Selector', developerName: 'First', key: 'Account', to: 'SharedImpl' });
    const second = record({ bindingType: 'Selector', developerName: 'Second', key: 'Contact', to: 'SharedImpl' });

    const issues = validateBindings([first, second], noDiagnostics);

    const duplicateIssues = issues.filter((issue) => issue.rule === 'duplicate-to');
    expect(duplicateIssues).toHaveLength(2);
    for (const issue of duplicateIssues) {
      expect(issue.severity).toBe('error');
    }
  });

  it('does not flag duplicate-to across different binding types sharing the same To__c value', () => {
    const service = record({ bindingType: 'Service', developerName: 'Svc', to: 'SharedImpl' });
    const selector = record({ bindingType: 'Selector', developerName: 'Sel', to: 'SharedImpl' });

    const issues = validateBindings([service, selector], noDiagnostics);

    expect(issues.filter((issue) => issue.rule === 'duplicate-to')).toEqual([]);
  });

  it('flags a duplicate-domain-sobject error when two Domain records resolve to the same SObject via different fields', () => {
    const primary = record({
      bindingType: 'Domain',
      developerName: 'Primary',
      key: 'Account',
      keyField: 'primary',
      to: 'ImplOne',
    });
    const alternate = record({
      bindingType: 'Domain',
      developerName: 'Alternate',
      key: 'Account',
      keyField: 'alternate',
      to: 'ImplTwo',
    });

    const issues = validateBindings([primary, alternate], noDiagnostics);

    const duplicateIssues = issues.filter((issue) => issue.rule === 'duplicate-domain-sobject');
    expect(duplicateIssues).toHaveLength(2);
    for (const issue of duplicateIssues) {
      expect(issue.severity).toBe('error');
    }
  });

  it('does not flag duplicate-domain-sobject for Selector records sharing the same SObject (no platform uniqueness there)', () => {
    const first = record({
      bindingType: 'Selector',
      developerName: 'First',
      key: 'Account',
      to: 'ImplOne',
      priority: 1,
    });
    const second = record({
      bindingType: 'Selector',
      developerName: 'Second',
      key: 'Account',
      to: 'ImplTwo',
      priority: 2,
    });

    const issues = validateBindings([first, second], noDiagnostics);

    expect(issues.filter((issue) => issue.rule === 'duplicate-domain-sobject')).toEqual([]);
  });

  it('flags a duplicate-developer-name error for each occurrence within the same binding type', () => {
    const first = record({
      bindingType: 'Domain',
      developerName: 'Shared',
      key: 'Account',
      to: 'ImplOne',
      source: 'core',
    });
    const second = record({
      bindingType: 'Domain',
      developerName: 'Shared',
      key: 'Contact',
      to: 'ImplTwo',
      source: 'app',
    });

    const issues = validateBindings([first, second], noDiagnostics);

    const duplicateIssues = issues.filter((issue) => issue.rule === 'duplicate-developer-name');
    expect(duplicateIssues).toHaveLength(2);
    expect(duplicateIssues.map((issue) => issue.source).sort()).toEqual(['app', 'core']);
  });

  it('does not flag duplicate-developer-name for the same DeveloperName across different binding types', () => {
    const service = record({ bindingType: 'Service', developerName: 'Shared', key: 'IMyService', to: 'ImplOne' });
    const selector = record({ bindingType: 'Selector', developerName: 'Shared', key: 'Account', to: 'ImplTwo' });

    const issues = validateBindings([service, selector], noDiagnostics);

    expect(issues.filter((issue) => issue.rule === 'duplicate-developer-name')).toEqual([]);
  });

  it('flags a missing-sobject-reference error for a malformed UnitOfWork record', () => {
    const malformed: MalformedBindingRecord[] = [
      { bindingType: 'UnitOfWork', developerName: 'Unresolvable', source: 'core' },
    ];

    const issues = validateBindings([], { malformed, ambiguous: [] });

    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        rule: 'missing-sobject-reference',
        bindingType: 'UnitOfWork',
        developerName: 'Unresolvable',
        message: expect.stringContaining('BindingSObject__c') as string,
      }),
    ]);
  });

  it('flags an ambiguous-sobject-reference error for an ambiguous UnitOfWork record', () => {
    const ambiguous: AmbiguousBindingRecord[] = [
      {
        bindingType: 'UnitOfWork',
        developerName: 'Ambiguous',
        key: 'Account',
        alternateKey: 'Contact',
        source: 'core',
      },
    ];

    const issues = validateBindings([], { malformed: [], ambiguous });

    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        rule: 'ambiguous-sobject-reference',
        bindingType: 'UnitOfWork',
        developerName: 'Ambiguous',
        key: 'Account',
      }),
    ]);
  });

  it('flags an unsupported-entity-definition-object error for a UnitOfWork record on the primary field', () => {
    const unsupported = record({
      bindingType: 'UnitOfWork',
      key: 'ServiceResource',
      keyField: 'primary',
      to: undefined,
    });

    const issues = validateBindings([unsupported], noDiagnostics);

    expect(issues).toEqual([
      expect.objectContaining({ severity: 'error', rule: 'unsupported-entity-definition-object' }),
    ]);
  });

  it('flags an unnecessary-entity-definition-alternate warning for an eligible object on a UnitOfWork alternate field', () => {
    const unnecessary = record({ bindingType: 'UnitOfWork', key: 'Account', keyField: 'alternate', to: undefined });

    const issues = validateBindings([unnecessary], noDiagnostics);

    expect(issues).toEqual([
      expect.objectContaining({ severity: 'warning', rule: 'unnecessary-entity-definition-alternate' }),
    ]);
  });

  it('flags a duplicate-unit-of-work-sobject error when two UnitOfWork records resolve to the same SObject via different fields', () => {
    const primary = record({
      bindingType: 'UnitOfWork',
      developerName: 'Primary',
      key: 'Account',
      keyField: 'primary',
      to: undefined,
      sequence: 10,
    });
    const alternate = record({
      bindingType: 'UnitOfWork',
      developerName: 'Alternate',
      key: 'Account',
      keyField: 'alternate',
      to: undefined,
      sequence: 20,
    });

    const issues = validateBindings([primary, alternate], noDiagnostics);

    const duplicateIssues = issues.filter((issue) => issue.rule === 'duplicate-unit-of-work-sobject');
    expect(duplicateIssues).toHaveLength(2);
    for (const issue of duplicateIssues) {
      expect(issue.severity).toBe('error');
    }
  });

  it('does not confuse duplicate-unit-of-work-sobject with duplicate-domain-sobject across the two types', () => {
    const domain = record({ bindingType: 'Domain', developerName: 'Dom', key: 'Account', to: 'DomainImpl' });
    const unitOfWork = record({
      bindingType: 'UnitOfWork',
      developerName: 'UOW',
      key: 'Account',
      to: undefined,
      sequence: 10,
    });

    const issues = validateBindings([domain, unitOfWork], noDiagnostics);

    expect(issues.filter((issue) => issue.rule === 'duplicate-domain-sobject')).toEqual([]);
    expect(issues.filter((issue) => issue.rule === 'duplicate-unit-of-work-sobject')).toEqual([]);
  });

  it('flags a sequence-collision warning when two UnitOfWork records share BindingSequence__c', () => {
    const first = record({
      bindingType: 'UnitOfWork',
      developerName: 'First',
      key: 'Account',
      to: undefined,
      sequence: 10,
    });
    const second = record({
      bindingType: 'UnitOfWork',
      developerName: 'Second',
      key: 'Contact',
      to: undefined,
      sequence: 10,
    });

    const issues = validateBindings([first, second], noDiagnostics);

    const collisionIssues = issues.filter((issue) => issue.rule === 'sequence-collision');
    expect(collisionIssues).toHaveLength(2);
    for (const issue of collisionIssues) {
      expect(issue.severity).toBe('warning');
    }
  });

  it('does not flag sequence-collision when neither UnitOfWork record has a sequence set', () => {
    const first = record({ bindingType: 'UnitOfWork', developerName: 'First', key: 'Account', to: undefined });
    const second = record({ bindingType: 'UnitOfWork', developerName: 'Second', key: 'Contact', to: undefined });

    const issues = validateBindings([first, second], noDiagnostics);

    expect(issues.filter((issue) => issue.rule === 'sequence-collision')).toEqual([]);
  });

  it('never flags duplicate-to for UnitOfWork, even when two records happen to share a to value', () => {
    const first = record({
      bindingType: 'UnitOfWork',
      developerName: 'First',
      key: 'Account',
      to: 'Shared',
      sequence: 1,
    });
    const second = record({
      bindingType: 'UnitOfWork',
      developerName: 'Second',
      key: 'Contact',
      to: 'Shared',
      sequence: 2,
    });

    const issues = validateBindings([first, second], noDiagnostics);

    expect(issues.filter((issue) => issue.rule === 'duplicate-to')).toEqual([]);
  });

  it('flags a duplicate-developer-name error for the same DeveloperName across two UnitOfWork sources', () => {
    const first = record({
      bindingType: 'UnitOfWork',
      developerName: 'Shared',
      key: 'Account',
      to: undefined,
      source: 'core',
    });
    const second = record({
      bindingType: 'UnitOfWork',
      developerName: 'Shared',
      key: 'Contact',
      to: undefined,
      source: 'app',
    });

    const issues = validateBindings([first, second], noDiagnostics);

    const duplicateIssues = issues.filter((issue) => issue.rule === 'duplicate-developer-name');
    expect(duplicateIssues).toHaveLength(2);
    expect(duplicateIssues.map((issue) => issue.source).sort()).toEqual(['app', 'core']);
  });

  it("stamps every issue's severity and scope from BINDING_RULES", () => {
    const unsupported = record({
      bindingType: 'Selector',
      developerName: 'Unsupported',
      key: 'ServiceResource',
      keyField: 'primary',
    });
    const malformed: MalformedBindingRecord[] = [{ bindingType: 'Domain', developerName: 'Malformed', source: 'core' }];
    const ambiguous: AmbiguousBindingRecord[] = [
      { bindingType: 'Selector', developerName: 'Ambiguous', key: 'Account', alternateKey: 'Contact', source: 'core' },
    ];
    const duplicate = [
      record({ bindingType: 'Domain', developerName: 'Dup', key: 'Account', to: 'ImplOne', source: 'core' }),
      record({ bindingType: 'Domain', developerName: 'Dup', key: 'Contact', to: 'ImplTwo', source: 'app' }),
    ];

    const issues = validateBindings([unsupported, ...duplicate], { malformed, ambiguous });

    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      const info = BINDING_RULES[issue.rule];
      expect(issue.severity).toBe(info.severity);
      expect(issue.scope).toBe(info.scope);
    }
  });

  it('accepts a scan-result envelope directly, identical to the two-argument form on the same data', () => {
    const a = record({ bindingType: 'Service', developerName: 'A' });
    const malformed: MalformedBindingRecord[] = [{ bindingType: 'Domain', developerName: 'Malformed', source: 'core' }];
    const ambiguous: AmbiguousBindingRecord[] = [
      { bindingType: 'Selector', developerName: 'Ambiguous', key: 'Account', alternateKey: 'Contact', source: 'core' },
    ];

    const viaEnvelope = validateBindings({ records: [a], malformed, ambiguous });
    const viaTwoArgs = validateBindings([a], { malformed, ambiguous });

    expect(viaEnvelope).toEqual(viaTwoArgs);
  });
});

describe('validateBindings missing-domain-trigger', () => {
  it('does not flag a Domain binding with a matching Active trigger', () => {
    const domain = record({ bindingType: 'Domain', key: 'Account', to: 'AccountsDomain' });
    const triggers = [trigger({ sobject: 'Account', triggerHandlerClasses: ['AccountsDomain'] })];

    const issues = validateBindings([domain], noDiagnostics, triggers);

    expect(issues.filter((issue) => issue.rule === 'missing-domain-trigger')).toEqual([]);
  });

  it('flags a Domain binding whose SObject has no Apex trigger at all', () => {
    const domain = record({ bindingType: 'Domain', key: 'Account', to: 'AccountsDomain' });

    const issues = validateBindings([domain], noDiagnostics, []);

    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        rule: 'missing-domain-trigger',
        key: 'Account',
        message: expect.stringContaining('no Apex trigger exists on Account') as string,
      }),
    ]);
  });

  it("flags a Domain binding whose SObject has a trigger that never calls its class's triggerHandler", () => {
    const domain = record({ bindingType: 'Domain', key: 'Account', to: 'AccountsDomain' });
    const triggers = [trigger({ sobject: 'Account', triggerHandlerClasses: ['SomeOtherClass'] })];

    const issues = validateBindings([domain], noDiagnostics, triggers);

    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        rule: 'missing-domain-trigger',
        message: expect.stringContaining(
          'none call fflib_SObjectDomain.triggerHandler(AccountsDomain.class)',
        ) as string,
      }),
    ]);
  });

  it('flags a Domain binding whose only matching trigger is Inactive', () => {
    const domain = record({ bindingType: 'Domain', key: 'Account', to: 'AccountsDomain' });
    const triggers = [trigger({ sobject: 'Account', triggerHandlerClasses: ['AccountsDomain'], active: false })];

    const issues = validateBindings([domain], noDiagnostics, triggers);

    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        rule: 'missing-domain-trigger',
        message: expect.stringContaining('its Status is Inactive') as string,
      }),
    ]);
  });

  it('matches a namespace-qualified triggerHandler reference against an unqualified binding to', () => {
    const domain = record({ bindingType: 'Domain', key: 'Account', to: 'AccountsDomain' });
    const triggers = [trigger({ sobject: 'Account', triggerHandlerClasses: ['ns.AccountsDomain'] })];

    const issues = validateBindings([domain], noDiagnostics, triggers);

    expect(issues.filter((issue) => issue.rule === 'missing-domain-trigger')).toEqual([]);
  });

  it('matches SObject case-insensitively between a binding and a trigger', () => {
    const domain = record({ bindingType: 'Domain', key: 'Account', to: 'AccountsDomain' });
    const triggers = [trigger({ sobject: 'account', triggerHandlerClasses: ['AccountsDomain'] })];

    const issues = validateBindings([domain], noDiagnostics, triggers);

    expect(issues.filter((issue) => issue.rule === 'missing-domain-trigger')).toEqual([]);
  });

  it('does not flag a Domain binding with a blank to (nothing to check against)', () => {
    const domain = record({ bindingType: 'Domain', key: 'Account', to: undefined });

    const issues = validateBindings([domain], noDiagnostics, []);

    expect(issues.filter((issue) => issue.rule === 'missing-domain-trigger')).toEqual([]);
  });

  it('never evaluates non-Domain binding types', () => {
    const selector = record({ bindingType: 'Selector', key: 'Account', to: 'AccountsSelector' });

    const issues = validateBindings([selector], noDiagnostics, []);

    expect(issues.filter((issue) => issue.rule === 'missing-domain-trigger')).toEqual([]);
  });

  it('is skipped entirely when triggers is omitted, regardless of binding shape', () => {
    const domain = record({ bindingType: 'Domain', key: 'Account', to: 'AccountsDomain' });

    const issues = validateBindings([domain], noDiagnostics);

    expect(issues.filter((issue) => issue.rule === 'missing-domain-trigger')).toEqual([]);
  });

  it('is skipped entirely when triggers is omitted using the scan-envelope call form', () => {
    const domain = record({ bindingType: 'Domain', key: 'Account', to: 'AccountsDomain' });

    const issues = validateBindings({ records: [domain], ...noDiagnostics });

    expect(issues.filter((issue) => issue.rule === 'missing-domain-trigger')).toEqual([]);
  });
});
