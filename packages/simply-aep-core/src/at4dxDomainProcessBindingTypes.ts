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

/** Whether a `DomainProcessBinding__mdt` record contributes a criteria filter or an action. */
export type DomainProcessType = 'Action' | 'Criteria';

/** What kind of process invokes this binding: a trigger event, or a domain method's explicit process token. */
export type ProcessContext = 'TriggerExecution' | 'DomainMethodExecution';

/** `TriggerOperation__c`'s picklist values, meaningful only when `processContext` is `TriggerExecution`. */
export type TriggerOperation =
  | 'Before_Insert'
  | 'After_Insert'
  | 'Before_Update'
  | 'After_Update'
  | 'Before_Delete'
  | 'After_Delete'
  | 'After_Undelete';

export const ALL_TRIGGER_OPERATIONS: TriggerOperation[] = [
  'Before_Insert',
  'After_Insert',
  'Before_Update',
  'After_Update',
  'Before_Delete',
  'After_Delete',
  'After_Undelete',
];

/** The Custom Metadata Type API name AT4DX's Trigger Action Framework stores its bindings in. */
export const DOMAIN_PROCESS_BINDING_OBJECT = 'DomainProcessBinding__mdt';

/** The local-source component object name for `DomainProcessBinding__mdt` records — the CMDT API name without its `__mdt` suffix. */
export const DOMAIN_PROCESS_BINDING_LOCAL_OBJECT_NAME = 'DomainProcessBinding';

/**
 * One `DomainProcessBinding__mdt` record, normalized from either an org query or local source.
 *
 * Unlike `RawBindingRecord` (Application Factory bindings), there's no interface/SObject "key" a
 * record resolves for and no priority-based winner — every active record actually runs, ordered by
 * `order`. `sobject` is `undefined` only for a malformed record with neither
 * `RelatedDomainBindingSObject__c` nor `RelatedDomainBindingSObjectAlternate__c` set; such records
 * are dropped by the scanners rather than surfaced with a missing SObject.
 */
export type RawDomainProcessBindingRecord = {
  developerName: string;
  sobject: string;
  processContext: ProcessContext;
  /** `TriggerOperation__c`. Present when `processContext` is `TriggerExecution`. */
  triggerOperation?: TriggerOperation;
  /** `DomainMethodToken__c`. Present when `processContext` is `DomainMethodExecution`. */
  domainMethodToken?: string;
  type: DomainProcessType;
  classToInject: string;
  /** `OrderOfExecution__c`. */
  order: number;
  isActive: boolean;
  executeAsynchronous: boolean;
  logicalInverse: boolean;
  preventRecursive: boolean;
  description?: string;
  /** Local package directory name, or the org username when read from `--target-org`. */
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

/** A `RawDomainProcessBindingRecord` annotated with the resolution outcome `resolveDomainProcessBindings` computed for it. */
export type DomainProcessBindingRow = RawDomainProcessBindingRecord & {
  /**
   * `true` when more than one *active* record of the same `type` in the same group (same `sobject`,
   * `processContext`, and `triggerOperation`/`domainMethodToken`) shares this record's `order` —
   * AT4DX's Custom Metadata query has no `ORDER BY` tiebreak for equal `OrderOfExecution__c` values
   * within a type, so which one actually runs first isn't something this command can determine, the
   * same "flag it, don't guess" precedent `at4dxResolve.ts` applies to ambiguous Domain bindings. A
   * Criteria and an Action sharing an order never collide — AT4DX's runtime map keys them separately.
   */
  orderCollision?: boolean;
};

export type At4dxDomainProcessBindingListResult = {
  source: string;
  bindings: DomainProcessBindingRow[];
};

/**
 * A `DomainProcessBinding__mdt` record with neither `RelatedDomainBindingSObject__c` nor
 * `RelatedDomainBindingSObjectAlternate__c` set. Excluded from a scan's `records` entirely (there's no
 * SObject to bind against), reported here instead so `validateDomainProcessBindings` can surface it —
 * `resolveDomainProcessBindings`/`list` keep silently excluding it, unchanged.
 */
export type MalformedDomainProcessBindingRecord = {
  developerName: string;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

/**
 * A `DomainProcessBinding__mdt` record with both `RelatedDomainBindingSObject__c` and
 * `RelatedDomainBindingSObjectAlternate__c` set to different values. Still included in a scan's
 * `records` (using `RelatedDomainBindingSObject__c`'s resolved value, the same fallback order
 * `resolveSObject` already applies), but also reported here since the field's own description says
 * "only specify... or this one; not both."
 */
export type AmbiguousDomainProcessBindingRecord = {
  developerName: string;
  /** `RelatedDomainBindingSObject__c`'s resolved value — what `records` uses for this record. */
  sobject: string;
  /** `RelatedDomainBindingSObjectAlternate__c`'s raw value. */
  alternateSobject: string;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

/** The severity of a `DomainProcessBindingIssue` — whether it fails `validate`'s exit code or is advisory only. */
export type DomainProcessBindingIssueSeverity = 'error' | 'warning';

/** Which check in `validateDomainProcessBindings` produced a `DomainProcessBindingIssue`. */
export type DomainProcessBindingIssueRule =
  | 'order-collision'
  | 'missing-sobject-reference'
  | 'missing-context-field'
  | 'duplicate-developer-name'
  | 'ambiguous-sobject-reference';

/**
 * Whether a rule's answer can be computed from one record alone (`record`) or requires seeing every
 * scanned record at once (`scan`). See docs/design/0011-domain-process-binding-issue-scoping.md — a
 * `scan`-scoped issue must never be dropped by an SObject filter applied after validation, since the
 * issue may not even carry the SObject the filter is keyed on.
 */
export type DomainProcessBindingIssueScope = 'record' | 'scan';

export type DomainProcessBindingRuleInfo = {
  rule: DomainProcessBindingIssueRule;
  severity: DomainProcessBindingIssueSeverity;
  scope: DomainProcessBindingIssueScope;
  /** Short label for a badge or table cell, e.g. `Order collision`. */
  title: string;
  /** One sentence on what the rule detects, independent of any one record — tooltip/help copy. */
  summary: string;
};

/** The single source of truth for each rule's `severity`, `scope`, and display copy. `validateDomainProcessBindings` reads from this table rather than repeating the literals at each `issues.push` site. */
export const DOMAIN_PROCESS_BINDING_RULES: Readonly<
  Record<DomainProcessBindingIssueRule, DomainProcessBindingRuleInfo>
> = {
  'order-collision': {
    rule: 'order-collision',
    severity: 'error',
    scope: 'record',
    title: 'Order collision',
    summary:
      'Two active records of the same type share an OrderOfExecution__c within the same SObject/context/trigger-or-token — one of them will silently never run.',
  },
  'missing-context-field': {
    rule: 'missing-context-field',
    severity: 'error',
    scope: 'record',
    title: 'Missing context field',
    summary:
      "The declared process context's matching field (TriggerOperation__c or DomainMethodToken__c) is blank, so this binding never matches any execution.",
  },
  'ambiguous-sobject-reference': {
    rule: 'ambiguous-sobject-reference',
    severity: 'warning',
    scope: 'record',
    title: 'Ambiguous SObject reference',
    summary:
      'RelatedDomainBindingSObject__c and RelatedDomainBindingSObjectAlternate__c are both set to different values — only one should be specified.',
  },
  'duplicate-developer-name': {
    rule: 'duplicate-developer-name',
    severity: 'error',
    scope: 'scan',
    title: 'Duplicate DeveloperName',
    summary:
      'The same DeveloperName is defined more than once across the scan — Custom Metadata records are keyed by DeveloperName, so deploying these together is a conflict.',
  },
  'missing-sobject-reference': {
    rule: 'missing-sobject-reference',
    severity: 'error',
    scope: 'scan',
    title: 'Missing SObject reference',
    summary:
      'Neither RelatedDomainBindingSObject__c nor RelatedDomainBindingSObjectAlternate__c is set — this binding has no SObject to bind against.',
  },
};

/** One problem `validateDomainProcessBindings` found with a scanned `DomainProcessBinding__mdt` record. */
export type DomainProcessBindingIssue = {
  severity: DomainProcessBindingIssueSeverity;
  rule: DomainProcessBindingIssueRule;
  /** Copied from `DOMAIN_PROCESS_BINDING_RULES[rule].scope` — see docs/design/0011-domain-process-binding-issue-scoping.md for why it's duplicated onto every issue rather than looked up. */
  scope: DomainProcessBindingIssueScope;
  message: string;
  developerName?: string;
  sobject?: string;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

export type At4dxDomainProcessBindingValidateResult = {
  source: string;
  bindingCount: number;
  issues: DomainProcessBindingIssue[];
};
