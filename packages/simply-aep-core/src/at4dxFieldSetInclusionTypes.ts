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

/** The Custom Metadata Type API name AT4DX stores field set inclusions in. */
export const FIELD_SET_INCLUSION_OBJECT = 'SelectorConfig_FieldSetInclusion__mdt';

/** The local-source component object name for `SelectorConfig_FieldSetInclusion__mdt` records — the CMDT API name without its `__mdt` suffix. */
export const FIELD_SET_INCLUSION_LOCAL_OBJECT_NAME = 'SelectorConfig_FieldSetInclusion';

/**
 * Which of `SelectorConfig_FieldSetInclusion__mdt`'s two SObject-reference fields a record's `sobject`
 * came from (or, when writing, which one to populate): `BindingSObject__c` ('primary') is an
 * `EntityDefinition` reference with real referential validation; `BindingSObjectAlternate__c`
 * ('alternate') is a plain text field with none. See
 * docs/design/0016-at4dx-selector-config-field-set-inclusion.md.
 */
export type FieldSetInclusionSObjectField = 'primary' | 'alternate';

/**
 * One `SelectorConfig_FieldSetInclusion__mdt` record, normalized from either an org query or local
 * source. Unlike `RawBindingRecord`, there's no priority/winner resolution — every active record for a
 * selector's SObject contributes its field set simultaneously. `sobject` is always resolvable here;
 * a record with neither SObject reference field set is reported as a `MalformedFieldSetInclusionRecord`
 * instead.
 */
export type RawFieldSetInclusionRecord = {
  developerName: string;
  /** The record's `label` (`CustomMetadata.label` locally, the standard `Label` field in an org). Not used by any validation rule — carried only so `updateFieldSetInclusion` can preserve it when `--label` isn't passed. */
  label: string;
  sobject: string;
  /** Which field `sobject` was read from. See `FieldSetInclusionSObjectField`. */
  sobjectField: FieldSetInclusionSObjectField;
  /** `FieldsetName__c`. */
  fieldsetName: string;
  /** `IsActive__c`. */
  isActive: boolean;
  /** Local package directory name, or the org username when read from `--target-org`. */
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

/**
 * A `SelectorConfig_FieldSetInclusion__mdt` record with neither `BindingSObject__c` nor
 * `BindingSObjectAlternate__c` set. Excluded from a scan's `records` entirely (there's no SObject to
 * bind against), reported here instead so `validateFieldSetInclusions` can surface it.
 */
export type MalformedFieldSetInclusionRecord = {
  developerName: string;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

/**
 * A `SelectorConfig_FieldSetInclusion__mdt` record with both `BindingSObject__c` and
 * `BindingSObjectAlternate__c` set to different values. Still included in a scan's `records` (using
 * `BindingSObject__c`'s resolved value), but also reported here since AT4DX's own
 * `Not_Both_BindObj_And_BindObjAlt` validation rule rejects it at deploy time.
 */
export type AmbiguousFieldSetInclusionRecord = {
  developerName: string;
  /** `BindingSObject__c`'s resolved value — what `records` uses for this record. */
  sobject: string;
  /** `BindingSObjectAlternate__c`'s raw value. */
  alternateSobject: string;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

/** The severity of a `FieldSetInclusionIssue` — whether it fails `validate`'s exit code or is advisory only. */
export type FieldSetInclusionIssueSeverity = 'error' | 'warning';

/** Which check in `validateFieldSetInclusions` produced a `FieldSetInclusionIssue`. */
export type FieldSetInclusionIssueRule =
  | 'missing-sobject-reference'
  | 'ambiguous-sobject-reference'
  | 'unsupported-entity-definition-object'
  | 'unnecessary-entity-definition-alternate'
  | 'duplicate-fieldset-name'
  | 'duplicate-developer-name';

/**
 * Whether a rule's answer can be computed from one record alone (`record`) or requires seeing every
 * scanned record at once (`scan`). See docs/design/0011-domain-process-binding-issue-scoping.md.
 */
export type FieldSetInclusionIssueScope = 'record' | 'scan';

export type FieldSetInclusionRuleInfo = {
  rule: FieldSetInclusionIssueRule;
  severity: FieldSetInclusionIssueSeverity;
  scope: FieldSetInclusionIssueScope;
  /** Short label for a badge or table cell, e.g. `Duplicate fieldset name`. */
  title: string;
  /** One sentence on what the rule detects, independent of any one record — tooltip/help copy. */
  summary: string;
};

/** The single source of truth for each rule's `severity`, `scope`, and display copy. `validateFieldSetInclusions` reads from this table rather than repeating the literals at each `issues.push` site. */
export const FIELD_SET_INCLUSION_RULES: Readonly<Record<FieldSetInclusionIssueRule, FieldSetInclusionRuleInfo>> = {
  'missing-sobject-reference': {
    rule: 'missing-sobject-reference',
    severity: 'error',
    scope: 'scan',
    title: 'Missing SObject reference',
    summary:
      'Neither BindingSObject__c nor BindingSObjectAlternate__c is set — this record has no SObject to bind against.',
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
  'duplicate-fieldset-name': {
    rule: 'duplicate-fieldset-name',
    severity: 'error',
    scope: 'scan',
    title: 'Duplicate fieldset name',
    summary:
      'Two records share a FieldsetName__c value — the field is unique org-wide (not per-SObject), so both cannot deploy together.',
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

/** One problem `validateFieldSetInclusions` found with a scanned `SelectorConfig_FieldSetInclusion__mdt` record. */
export type FieldSetInclusionIssue = {
  severity: FieldSetInclusionIssueSeverity;
  rule: FieldSetInclusionIssueRule;
  /** Copied from `FIELD_SET_INCLUSION_RULES[rule].scope` — see docs/design/0011-domain-process-binding-issue-scoping.md for why it's duplicated onto every issue rather than looked up. */
  scope: FieldSetInclusionIssueScope;
  message: string;
  developerName?: string;
  sobject?: string;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

export type At4dxFieldSetInclusionListResult = {
  source: string;
  records: RawFieldSetInclusionRecord[];
};

export type At4dxFieldSetInclusionValidateResult = {
  source: string;
  recordCount: number;
  issues: FieldSetInclusionIssue[];
};

/** The fields `createFieldSetInclusion`/`updateFieldSetInclusion` accept, shared with the CLI's flags. On `update`, every field is optional — only the ones supplied change. */
export type FieldSetInclusionFieldsInput = {
  label?: string;
  sobject?: string;
  /**
   * Tri-state on purpose (`true` | `false` | `undefined`): `undefined` means "don't change which
   * field this is stored in" on `update` (defaulting to `'primary'` on `create`, where there's no
   * existing record to preserve). See `FieldSetInclusionSObjectField`.
   */
  sobjectAlternate?: boolean;
  fieldsetName?: string;
  isActive?: boolean;
};

/** Where a write reads its validation context from and, when writing locally, where the file goes. Exactly one of `sourceDir`/`connection` is required; both may be given. */
export type CreateFieldSetInclusionTarget = {
  /** The package directory `customMetadata/SelectorConfig_FieldSetInclusion.<name>.md-meta.xml` is created under. */
  sourceDir?: string;
  connection?: Connection;
  /** Deploy poll timeout. Only meaningful when `connection` is given. */
  wait?: Duration;
};

/** Same shape as `CreateFieldSetInclusionTarget`, but `sourceDirs` is a search scope (one or more roots) rather than a single destination, since `update` locates an existing file instead of choosing where to create one. */
export type UpdateFieldSetInclusionTarget = {
  sourceDirs?: string[];
  connection?: Connection;
  wait?: Duration;
};

export type CreateFieldSetInclusionInput = FieldSetInclusionFieldsInput & {
  developerName: string;
  sobject: string;
  fieldsetName: string;
  /** Write/deploy even if validation finds an `error`-severity issue. The issue still appears in the result. */
  force?: boolean;
};

export type UpdateFieldSetInclusionInput = FieldSetInclusionFieldsInput & {
  developerName: string;
  force?: boolean;
};

/** The error conditions `createFieldSetInclusion`/`updateFieldSetInclusion` signal structurally (via `code`) rather than by message text, so a `Messages`-based caller (the CLI) can map each one to its own error key without string-matching. Errors outside this list (a scan/deploy I/O failure) are rethrown as the underlying error. */
export type FieldSetInclusionWriteErrorCode =
  | 'source-or-target-required'
  | 'invalid-developer-name'
  | 'label-too-long'
  | 'developer-name-already-exists'
  | 'developer-name-not-found'
  | 'no-fields-to-update'
  | 'at4dx-not-detected'
  | 'validation-failed'
  | 'deploy-failed';

export class FieldSetInclusionWriteError extends Error {
  public readonly code: FieldSetInclusionWriteErrorCode;
  /** Populated only for `code: 'validation-failed'` — the blocking issues, so a caller can display them without re-running validation. */
  public readonly issues?: FieldSetInclusionIssue[];

  public constructor(code: FieldSetInclusionWriteErrorCode, message: string, issues?: FieldSetInclusionIssue[]) {
    super(message);
    this.name = 'FieldSetInclusionWriteError';
    this.code = code;
    this.issues = issues;
  }
}

export type At4dxFieldSetInclusionWriteResult = {
  developerName: string;
  sobject: string;
  /** Absent when written only to a temp directory for a `connection`-only (org-direct) run. */
  filePath?: string;
  /** Absent when no `connection` was given. */
  deploy?: { id: string; status: string; success: boolean };
  /** The full validation result, even when `force` was used to write past a blocking issue. */
  issues: FieldSetInclusionIssue[];
};

export type At4dxFieldSetInclusionCreateResult = At4dxFieldSetInclusionWriteResult;
export type At4dxFieldSetInclusionUpdateResult = At4dxFieldSetInclusionWriteResult;
