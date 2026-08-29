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

import type { Connection } from '@salesforce/core';
import type { Duration } from '@salesforce/kit';

/** Whether a `DomainProcessBinding__mdt` record contributes a criteria filter or an action. */
export type DomainProcessType = 'Action' | 'Criteria';

/**
 * Which of `DomainProcessBinding__mdt`'s two SObject-reference fields a record's `sobject` came from
 * (or, when writing, which one to populate): `RelatedDomainBindingSObject__c` ('primary') is an
 * `EntityDefinition` reference with real referential validation; `RelatedDomainBindingSObjectAlternate__c`
 * ('alternate') is a plain text field with none, but it's the only way to bind against a Setup object
 * (e.g. `ServiceResource`) that can't be referenced through `EntityDefinition` at all. See
 * docs/design/0012-at4dx-domain-process-binding-create-set.md.
 */
export type DomainProcessBindingSObjectField = 'primary' | 'alternate';

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
  /** The record's `label` (`CustomMetadata.label` locally, the standard `Label` field in an org). Not used by any resolution/validation rule — carried only so `set` can preserve it when `--label` isn't passed. */
  label: string;
  sobject: string;
  /** Which field `sobject` was read from. See `DomainProcessBindingSObjectField`. */
  sobjectField: DomainProcessBindingSObjectField;
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
  | 'ambiguous-sobject-reference'
  | 'unsupported-entity-definition-object'
  | 'unnecessary-entity-definition-alternate';

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
  'unsupported-entity-definition-object': {
    rule: 'unsupported-entity-definition-object',
    severity: 'error',
    scope: 'record',
    title: 'Unsupported EntityDefinition object',
    summary:
      'RelatedDomainBindingSObject__c is set to a standard object not known to support EntityDefinition metadata relationships — Setup/deploy will reject it; use RelatedDomainBindingSObjectAlternate__c instead.',
  },
  'unnecessary-entity-definition-alternate': {
    rule: 'unnecessary-entity-definition-alternate',
    severity: 'warning',
    scope: 'record',
    title: 'Unnecessary EntityDefinition alternate',
    summary:
      'RelatedDomainBindingSObjectAlternate__c is set to an object that supports EntityDefinition metadata relationships — it did not need the Alternate field; use RelatedDomainBindingSObject__c instead.',
  },
};

/**
 * Standard objects known to satisfy EntityDefinition's Metadata Relationship eligibility rule, per
 * Salesforce's Custom Metadata Types Implementation Guide ("Custom Metadata Relationships"): supports
 * custom fields, supports Apex triggers, supports custom layouts, isn't an activity object (`Task`/
 * `Event`), isn't `User`, isn't a Trialforce object. Salesforce doesn't publish a single canonical,
 * current list of which standard objects satisfy that rule, and it isn't fixed across releases, so this
 * is a best-effort baseline, not an authoritative table — extend it as a real binding confirms an object
 * works, or as `unsupported-entity-definition-object`/`unnecessary-entity-definition-alternate`
 * false-positives on one that does. See docs/design/0014-domain-process-binding-entity-definition-eligibility.md.
 *
 * Custom objects are never checked against this list — see `isCustomObjectApiName` — since a custom
 * object always satisfies the rule.
 */
export const ENTITY_DEFINITION_STANDARD_OBJECTS: ReadonlySet<string> = new Set([
  'Account',
  'Asset',
  'Campaign',
  'CampaignMember',
  'Case',
  'Contact',
  'Contract',
  'ContractLineItem',
  'Entitlement',
  'Lead',
  'Opportunity',
  'OpportunityContactRole',
  'OpportunityLineItem',
  'Order',
  'OrderItem',
  'Pricebook2',
  'PricebookEntry',
  'Product2',
  'Quote',
  'QuoteLineItem',
  'ServiceContract',
  'Solution',
  'WorkOrder',
  'WorkOrderLineItem',
  'WorkType',
]);

/**
 * True when `apiName` is a custom (optionally namespaced) object. Salesforce reserves `__` in a standard
 * object's API name for exactly this suffix (`__c`, a namespace prefix, a platform event's `__e`, a
 * big/external object's `__b`/`__x`), so any object whose API name contains it always satisfies
 * EntityDefinition's Metadata Relationship eligibility rule on its own, without consulting
 * `ENTITY_DEFINITION_STANDARD_OBJECTS`.
 */
export function isCustomObjectApiName(apiName: string): boolean {
  return apiName.includes('__');
}

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

/** The fields `createDomainProcessBinding`/`setDomainProcessBinding` accept, shared with the CLI's flags. On `set`, every field is optional — only the ones supplied change. */
export type DomainProcessBindingFieldsInput = {
  label?: string;
  sobject?: string;
  /**
   * Tri-state on purpose (`true` | `false` | `undefined`): `undefined` means "don't change which
   * field this is stored in" on `set` (defaulting to `'primary'` on `create`, where there's no
   * existing record to preserve). See `DomainProcessBindingSObjectField`.
   */
  sobjectAlternate?: boolean;
  processContext?: ProcessContext;
  triggerOperation?: TriggerOperation;
  domainMethodToken?: string;
  type?: DomainProcessType;
  classToInject?: string;
  order?: number;
  isActive?: boolean;
  executeAsynchronous?: boolean;
  logicalInverse?: boolean;
  preventRecursive?: boolean;
  description?: string;
};

/** Where a write reads its validation context from and, when writing locally, where the file goes. Exactly one of `sourceDir`/`connection` is required; both may be given (see docs/design/0012-at4dx-domain-process-binding-create-set.md). */
export type CreateDomainProcessBindingTarget = {
  /** The package directory `customMetadata/DomainProcessBinding.<name>.md-meta.xml` is created under. */
  sourceDir?: string;
  connection?: Connection;
  /** Deploy poll timeout. Only meaningful when `connection` is given. */
  wait?: Duration;
};

/** Same shape as `CreateDomainProcessBindingTarget`, but `sourceDirs` is a search scope (one or more roots) rather than a single destination, since `set` locates an existing file instead of choosing where to create one. */
export type SetDomainProcessBindingTarget = {
  sourceDirs?: string[];
  connection?: Connection;
  wait?: Duration;
};

export type CreateDomainProcessBindingInput = DomainProcessBindingFieldsInput & {
  developerName: string;
  sobject: string;
  processContext: ProcessContext;
  type: DomainProcessType;
  classToInject: string;
  order: number;
  /** Write/deploy even if validation finds an `error`-severity issue. The issue still appears in the result. */
  force?: boolean;
};

export type SetDomainProcessBindingInput = DomainProcessBindingFieldsInput & {
  developerName: string;
  force?: boolean;
};

/** The error conditions `createDomainProcessBinding`/`setDomainProcessBinding` signal structurally (via `code`) rather than by message text, so a `Messages`-based caller (the CLI) can map each one to its own error key without string-matching. Errors outside this list (a scan/deploy I/O failure) are rethrown as the underlying error. */
export type DomainProcessBindingWriteErrorCode =
  | 'source-or-target-required'
  | 'context-field-mismatch'
  | 'invalid-developer-name'
  | 'label-too-long'
  | 'developer-name-already-exists'
  | 'developer-name-not-found'
  | 'no-fields-to-update'
  | 'at4dx-not-detected'
  | 'validation-failed'
  | 'deploy-failed';

export class DomainProcessBindingWriteError extends Error {
  public readonly code: DomainProcessBindingWriteErrorCode;
  /** Populated only for `code: 'validation-failed'` — the blocking issues, so a caller can display them without re-running validation. */
  public readonly issues?: DomainProcessBindingIssue[];

  public constructor(code: DomainProcessBindingWriteErrorCode, message: string, issues?: DomainProcessBindingIssue[]) {
    super(message);
    this.name = 'DomainProcessBindingWriteError';
    this.code = code;
    this.issues = issues;
  }
}

export type At4dxDomainProcessBindingWriteResult = {
  developerName: string;
  sobject: string;
  /** Absent when written only to a temp directory for a `connection`-only (org-direct) run. */
  filePath?: string;
  /** Absent when no `connection` was given. */
  deploy?: { id: string; status: string; success: boolean };
  /** The full validation result, even when `force` was used to write past a blocking issue. */
  issues: DomainProcessBindingIssue[];
};

export type At4dxDomainProcessBindingCreateResult = At4dxDomainProcessBindingWriteResult;
export type At4dxDomainProcessBindingSetResult = At4dxDomainProcessBindingWriteResult;
