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

/**
 * The subset of `@salesforce/core`'s `Connection` the org-scan functions actually call. Accepting
 * this instead of the full `Connection` class lets a consumer with its own `@salesforce/core`
 * install (a different major version, even) pass in a connection without needing an exact version
 * match — anything structurally compatible works.
 */
export type AepConnection = Pick<Connection, 'autoFetchQuery' | 'getUsername'>;

/** The four AT4DX Application Factory binding types this command reads. */
export type BindingType = 'Service' | 'Selector' | 'Domain' | 'UnitOfWork';

export const ALL_BINDING_TYPES: BindingType[] = ['Service', 'Selector', 'Domain', 'UnitOfWork'];

/** The `--type` flag's CLI-facing spelling for each binding type. */
export type BindingTypeFlag = 'service' | 'selector' | 'domain' | 'unit-of-work';

export const BINDING_TYPE_BY_FLAG: Record<BindingTypeFlag, BindingType> = {
  service: 'Service',
  selector: 'Selector',
  domain: 'Domain',
  'unit-of-work': 'UnitOfWork',
};

/**
 * The Custom Metadata Type API name AT4DX stores each binding type's records in.
 *
 * This is the single source of truth `at4dxOrgScan`, `at4dxLocalScan`, and `at4dxResolve` all key
 * off of, so the four binding types can't drift out of sync with each other.
 */
export const AT4DX_BINDING_OBJECTS: Record<BindingType, string> = {
  Service: 'ApplicationFactory_ServiceBinding__mdt',
  Selector: 'ApplicationFactory_SelectorBinding__mdt',
  Domain: 'ApplicationFactory_DomainBinding__mdt',
  UnitOfWork: 'ApplicationFactory_UnitOfWorkBinding__mdt',
};

/**
 * The local-source component name AT4DX's Custom Metadata Type records use — the CMDT API name
 * without its `__mdt` suffix, e.g. `ApplicationFactory_ServiceBinding.CampaignSObjectBinding` is a
 * `CustomMetadata` component named `ApplicationFactory_ServiceBinding.<record>`.
 */
export const AT4DX_BINDING_LOCAL_OBJECT_NAMES: Record<BindingType, string> = {
  Service: 'ApplicationFactory_ServiceBinding',
  Selector: 'ApplicationFactory_SelectorBinding',
  Domain: 'ApplicationFactory_DomainBinding',
  UnitOfWork: 'ApplicationFactory_UnitOfWorkBinding',
};

/** @returns The binding type whose local object name is `localObjectName`, or `undefined` if none matches. */
export function bindingTypeForLocalObjectName(localObjectName: string): BindingType | undefined {
  return ALL_BINDING_TYPES.find((type) => AT4DX_BINDING_LOCAL_OBJECT_NAMES[type] === localObjectName);
}

/**
 * Which of a Selector/Domain/UnitOfWork binding's two SObject-reference fields `key` came from (or,
 * when writing, which one to populate): `BindingSObject__c` ('primary') is an `EntityDefinition`
 * reference with real referential validation; `BindingSObjectAlternate__c` ('alternate') is a plain
 * text field with none. Mirrors `DomainProcessBindingSObjectField` — see
 * docs/design/0012-at4dx-domain-process-binding-create-set.md. `undefined` for Service, which has no
 * SObject reference at all (`key` is `BindingInterface__c` instead).
 */
export type BindingKeyField = 'primary' | 'alternate';

/**
 * One binding record, normalized from either an org query or local source, before resolution.
 *
 * `key` is the interface name (Service) or SObject API name (Selector/Domain/UnitOfWork) the
 * binding resolves for. `to` is the implementing Apex class — absent for UnitOfWork, which has no
 * `To__c` field (see `at4dxResolve` for why).
 */
export type RawBindingRecord = {
  bindingType: BindingType;
  developerName: string;
  /** The record's `label` (`CustomMetadata.label` locally, the standard `Label` field in an org). Not used by any resolution/validation rule — carried only so `updateBinding` can preserve it when `--label` isn't passed. */
  label: string;
  key: string;
  /** Which field `key` was read from, for Selector/Domain/UnitOfWork. See `BindingKeyField`. */
  keyField?: BindingKeyField;
  to?: string;
  priority?: number;
  sequence?: number;
  /** Local package directory name, or the org username when read from `--target-org`. */
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

/** A `RawBindingRecord` annotated with the resolution outcome `at4dxResolve` computed for it. */
export type At4dxBindingRow = RawBindingRecord & {
  /** Whether this row is the one AT4DX actually resolves to for its key. Always `true` for UnitOfWork. */
  effective: boolean;
  /** Domain only: `true` when >1 row shares this key and AT4DX doesn't guarantee which one wins. */
  ambiguous?: boolean;
};

export type At4dxBindingListResult = {
  source: string;
  bindings: At4dxBindingRow[];
};

/**
 * A binding record with no resolvable key (Service: `BindingInterface__c` blank; Selector/Domain/
 * UnitOfWork: neither `BindingSObject__c` nor `BindingSObjectAlternate__c` set). Excluded from a scan's
 * `records` entirely, reported here instead so `validateBindings` can surface it — `resolveBindings`/
 * `list` keep silently excluding it, unchanged. Mirrors `MalformedDomainProcessBindingRecord`
 * (docs/design/0010-at4dx-domain-process-binding-validate.md).
 */
export type MalformedBindingRecord = {
  bindingType: BindingType;
  developerName: string;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

/**
 * A Selector/Domain/UnitOfWork binding record with both `BindingSObject__c` and
 * `BindingSObjectAlternate__c` set to different values. Still included in a scan's `records` (using
 * `BindingSObject__c`'s resolved value, the same fallback order `resolveSObjectKey` already applies),
 * but also reported here since AT4DX's own `Not_Both_BindObj_And_BindObjAlt` validation rule rejects it
 * at deploy time. Mirrors `AmbiguousDomainProcessBindingRecord`.
 */
export type AmbiguousBindingRecord = {
  bindingType: BindingType;
  developerName: string;
  /** `BindingSObject__c`'s resolved value — what `records` uses for this record. */
  key: string;
  /** `BindingSObjectAlternate__c`'s raw value. */
  alternateKey: string;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

/** The severity of a `BindingIssue` — whether it fails `validate`'s exit code or is advisory only. */
export type BindingIssueSeverity = 'error' | 'warning';

/** Which check in `validateBindings` produced a `BindingIssue`. See docs/design/0015-at4dx-binding-validate-create-set.md. */
export type BindingIssueRule =
  | 'missing-sobject-reference'
  | 'ambiguous-sobject-reference'
  | 'unsupported-entity-definition-object'
  | 'unnecessary-entity-definition-alternate'
  | 'duplicate-to'
  | 'duplicate-domain-sobject'
  | 'duplicate-developer-name';

/**
 * Whether a rule's answer can be computed from one record alone (`record`) or requires seeing every
 * scanned record at once (`scan`). See docs/design/0011-domain-process-binding-issue-scoping.md — a
 * `scan`-scoped issue must never be dropped by a filter applied after validation.
 */
export type BindingIssueScope = 'record' | 'scan';

export type BindingRuleInfo = {
  rule: BindingIssueRule;
  severity: BindingIssueSeverity;
  scope: BindingIssueScope;
  /** Short label for a badge or table cell, e.g. `Duplicate To`. */
  title: string;
  /** One sentence on what the rule detects, independent of any one record — tooltip/help copy. */
  summary: string;
};

/** The single source of truth for each rule's `severity`, `scope`, and display copy. `validateBindings` reads from this table rather than repeating the literals at each `issues.push` site. */
export const BINDING_RULES: Readonly<Record<BindingIssueRule, BindingRuleInfo>> = {
  'missing-sobject-reference': {
    rule: 'missing-sobject-reference',
    severity: 'error',
    scope: 'scan',
    title: 'Missing SObject reference',
    summary:
      'Neither BindingSObject__c nor BindingSObjectAlternate__c is set — this binding has no SObject to bind against.',
  },
  'ambiguous-sobject-reference': {
    rule: 'ambiguous-sobject-reference',
    severity: 'error',
    scope: 'record',
    title: 'Ambiguous SObject reference',
    summary:
      "BindingSObject__c and BindingSObjectAlternate__c are both set to different values — AT4DX's own Not_Both_BindObj_And_BindObjAlt validation rule rejects this at deploy time.",
  },
  'unsupported-entity-definition-object': {
    rule: 'unsupported-entity-definition-object',
    severity: 'error',
    scope: 'record',
    title: 'Unsupported EntityDefinition object',
    summary:
      'BindingSObject__c is set to a standard object not known to support EntityDefinition metadata relationships — Setup/deploy will reject it; use BindingSObjectAlternate__c instead.',
  },
  'unnecessary-entity-definition-alternate': {
    rule: 'unnecessary-entity-definition-alternate',
    severity: 'warning',
    scope: 'record',
    title: 'Unnecessary EntityDefinition alternate',
    summary:
      'BindingSObjectAlternate__c is set to an object that supports EntityDefinition metadata relationships — it did not need the Alternate field; use BindingSObject__c instead.',
  },
  'duplicate-to': {
    rule: 'duplicate-to',
    severity: 'error',
    scope: 'scan',
    title: 'Duplicate To',
    summary:
      'Two records of the same binding type share a To__c value — the field is unique, so both cannot deploy together.',
  },
  'duplicate-domain-sobject': {
    rule: 'duplicate-domain-sobject',
    severity: 'error',
    scope: 'record',
    title: 'Duplicate Domain SObject',
    summary:
      'Two Domain bindings resolve to the same SObject — BindingSObject__c/BindingSObjectAlternate__c are unique on this binding type, so both cannot deploy together.',
  },
  'duplicate-developer-name': {
    rule: 'duplicate-developer-name',
    severity: 'error',
    scope: 'scan',
    title: 'Duplicate DeveloperName',
    summary:
      'The same DeveloperName is defined more than once across the scan — Custom Metadata records are keyed by DeveloperName, so deploying these together is a conflict.',
  },
};

/** One problem `validateBindings` found with a scanned Application Factory binding record. */
export type BindingIssue = {
  severity: BindingIssueSeverity;
  rule: BindingIssueRule;
  /** Copied from `BINDING_RULES[rule].scope` — see docs/design/0011-domain-process-binding-issue-scoping.md for why it's duplicated onto every issue rather than looked up. */
  scope: BindingIssueScope;
  message: string;
  bindingType: BindingType;
  developerName?: string;
  /** The interface name (Service) or SObject API name (Selector/Domain) this issue is about, when applicable. */
  key?: string;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

export type At4dxBindingValidateResult = {
  source: string;
  bindingCount: number;
  issues: BindingIssue[];
};

/** The Application Factory binding types `createBinding`/`updateBinding` support. UnitOfWork has no `To__c` field and no wiring conflict to validate — out of scope, see docs/design/0015-at4dx-binding-validate-create-set.md. */
export type WritableBindingType = 'Service' | 'Selector' | 'Domain';

export const ALL_WRITABLE_BINDING_TYPES: WritableBindingType[] = ['Service', 'Selector', 'Domain'];

/** The `--type` flag's CLI-facing spelling for each writable binding type. */
export type WritableBindingTypeFlag = 'service' | 'selector' | 'domain';

export const WRITABLE_BINDING_TYPE_BY_FLAG: Record<WritableBindingTypeFlag, WritableBindingType> = {
  service: 'Service',
  selector: 'Selector',
  domain: 'Domain',
};

/** The fields `createBinding`/`updateBinding` accept, shared with the CLI's flags. On `update`, every field is optional — only the ones supplied change. */
export type BindingFieldsInput = {
  label?: string;
  /** `To__c` — the interface/SObject's implementing Apex class. Required on `create`, optional on `update`. */
  to?: string;
  /** `BindingInterface__c`. `--type service` only — rejected for Selector/Domain. */
  bindingInterface?: string;
  /** `BindingSObject__c`/`BindingSObjectAlternate__c`'s resolved value. `--type selector`/`domain` only — rejected for Service. */
  sobject?: string;
  /**
   * Tri-state on purpose (`true` | `false` | `undefined`): `undefined` means "don't change which
   * field this is stored in" on `update` (defaulting to `'primary'` on `create`). See `BindingKeyField`.
   * `--type selector`/`domain` only.
   */
  sobjectAlternate?: boolean;
  /** `Priority__c`. `--type service`/`selector` only — rejected for Domain, which has no such field. */
  priority?: number;
};

/** Where a write reads its validation context from and, when writing locally, where the file goes. Exactly one of `sourceDir`/`connection` is required; both may be given (see docs/design/0012-at4dx-domain-process-binding-create-set.md). */
export type CreateBindingTarget = {
  /** The package directory the binding's `.md-meta.xml` is created under. */
  sourceDir?: string;
  connection?: Connection;
  /** Deploy poll timeout. Only meaningful when `connection` is given. */
  wait?: Duration;
};

/** Same shape as `CreateBindingTarget`, but `sourceDirs` is a search scope (one or more roots) rather than a single destination, since `update` locates an existing file instead of choosing where to create one. */
export type UpdateBindingTarget = {
  sourceDirs?: string[];
  connection?: Connection;
  wait?: Duration;
};

export type CreateBindingInput = BindingFieldsInput & {
  bindingType: WritableBindingType;
  developerName: string;
  to: string;
  /** Write/deploy even if validation finds an `error`-severity issue. The issue still appears in the result. */
  force?: boolean;
};

export type UpdateBindingInput = BindingFieldsInput & {
  bindingType: WritableBindingType;
  developerName: string;
  force?: boolean;
};

/** The error conditions `createBinding`/`updateBinding` signal structurally (via `code`) rather than by message text, so a `Messages`-based caller (the CLI) can map each one to its own error key without string-matching. Errors outside this list (a scan/deploy I/O failure) are rethrown as the underlying error. */
export type BindingWriteErrorCode =
  | 'source-or-target-required'
  | 'type-field-mismatch'
  | 'invalid-developer-name'
  | 'label-too-long'
  | 'developer-name-already-exists'
  | 'developer-name-not-found'
  | 'no-fields-to-update'
  | 'at4dx-not-detected'
  | 'validation-failed'
  | 'deploy-failed';

export class BindingWriteError extends Error {
  public readonly code: BindingWriteErrorCode;
  /** Populated only for `code: 'validation-failed'` — the blocking issues, so a caller can display them without re-running validation. */
  public readonly issues?: BindingIssue[];

  public constructor(code: BindingWriteErrorCode, message: string, issues?: BindingIssue[]) {
    super(message);
    this.name = 'BindingWriteError';
    this.code = code;
    this.issues = issues;
  }
}

export type At4dxBindingWriteResult = {
  developerName: string;
  bindingType: WritableBindingType;
  /** Absent when written only to a temp directory for a `connection`-only (org-direct) run. */
  filePath?: string;
  /** Absent when no `connection` was given. */
  deploy?: { id: string; status: string; success: boolean };
  /** The full validation result, even when `force` was used to write past a blocking issue. */
  issues: BindingIssue[];
};

export type At4dxBindingCreateResult = At4dxBindingWriteResult;
export type At4dxBindingUpdateResult = At4dxBindingWriteResult;
