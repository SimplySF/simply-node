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

/** The Custom Metadata Type API name AT4DX's Platform Event Distributor stores subscriptions in. */
export const PLATFORM_EVENT_SUBSCRIPTION_OBJECT = 'PlatformEvents_Subscription__mdt';

/** The local-source component object name for `PlatformEvents_Subscription__mdt` records — the CMDT API name without its `__mdt` suffix. */
export const PLATFORM_EVENT_SUBSCRIPTION_LOCAL_OBJECT_NAME = 'PlatformEvents_Subscription';

/**
 * `MatcherRule__c`'s four values, controlling which of `EventCategory__c`/`Event__c` the distributor's
 * matcher dereferences for a subscription. `MatchEventBus` dereferences neither (the whole bus matches);
 * the other three dereference one or both — see docs/design/0025's Problem section for why that makes
 * `EventCategory__c`/`Event__c` being optional fields a real hazard.
 *
 * The exact API name spelling of the three non-`MatchEventBus` values isn't independently confirmed
 * against AT4DX's own picklist definition in this pass (see docs/design/0025's provenance caveat) —
 * treat these four as the working assumption, verified against a real org's picklist the first time
 * this module is exercised there.
 */
export type MatcherRule = 'MatchEventBus' | 'MatchCategory' | 'MatchEvent' | 'MatchCategoryAndEvent';

export const ALL_MATCHER_RULES: MatcherRule[] = [
  'MatchEventBus',
  'MatchCategory',
  'MatchEvent',
  'MatchCategoryAndEvent',
];

/**
 * One `PlatformEvents_Subscription__mdt` record, normalized from either an org query or local source.
 * Unlike the other three AT4DX families, there's no SObject key at all — `eventBus` is
 * `DeveloperControlled` plain text, not an `EntityDefinition` reference, and there's no
 * `*Alternate__c` field, so there's no `ambiguous` diagnostic for this family (see
 * `PlatformEventSubscriptionLocalScanResult`).
 */
export type RawPlatformEventSubscriptionRecord = {
  developerName: string;
  /** The record's `label` (`CustomMetadata.label` locally, the standard `Label` field in an org). Not used by any validation rule — carried only so `updatePlatformEventSubscription` can preserve it when `--label` isn't passed. */
  label: string;
  /** `EventBus__c` — the platform event object's API name (e.g. `My_Event__e`). */
  eventBus: string;
  /** `Consumer__c` — the `IEventsConsumer`-implementing Apex class name. `unique: true` on this CMDT; see `duplicate-consumer`. */
  consumer: string;
  /** `EventCategory__c`. Optional — dereferenced (unguarded) by the `MatchCategory`/`MatchCategoryAndEvent` matcher rules. */
  eventCategory?: string;
  /** `Event__c`. Optional — dereferenced (unguarded) by the `MatchEvent`/`MatchCategoryAndEvent` matcher rules. */
  event?: string;
  matcherRule: MatcherRule;
  /** `IsActive__c`. Filtered out by the module's own static SOQL when `false` — not a validation concern, see docs/design/0025's Rules section. */
  isActive: boolean;
  /** `Execute_Synchronous__c`. */
  executeSynchronous: boolean;
  /** Local package directory name, or the org username when read from `--target-org`. */
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

/**
 * A `PlatformEvents_Subscription__mdt` record with a blank `EventBus__c`/`Consumer__c`, or an
 * unrecognized `MatcherRule__c` (schema-required and restricted to four values, so this should only
 * happen on a hand-edited local file, never a deployed record). Excluded from a scan's `records`
 * entirely — there's no bus/consumer to register, or no way to know which fields the matcher would
 * dereference — reported here instead so `validatePlatformEventSubscriptions` can surface
 * `missing-event-bus-or-consumer`, the rule that matters most of all six, since one such record takes
 * down `PlatformEventDistributorDIModule` for every subscription in the org, not just this one.
 */
export type MalformedPlatformEventSubscriptionRecord = {
  developerName: string;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

/** The severity of a `PlatformEventSubscriptionIssue` — whether it fails `validate`'s exit code or is advisory only. */
export type PlatformEventSubscriptionIssueSeverity = 'error' | 'warning';

/** Which check in `validatePlatformEventSubscriptions` produced a `PlatformEventSubscriptionIssue`. */
export type PlatformEventSubscriptionIssueRule =
  | 'missing-event-bus-or-consumer'
  | 'matcher-rule-missing-field'
  | 'unreachable-subscription'
  | 'non-conforming-event-bus'
  | 'duplicate-consumer'
  | 'duplicate-developer-name';

/**
 * Whether a rule's answer can be computed from one record alone (`record`) or requires seeing every
 * scanned record at once (`scan`). See docs/design/0011-domain-process-binding-issue-scoping.md.
 */
export type PlatformEventSubscriptionIssueScope = 'record' | 'scan';

export type PlatformEventSubscriptionRuleInfo = {
  rule: PlatformEventSubscriptionIssueRule;
  severity: PlatformEventSubscriptionIssueSeverity;
  scope: PlatformEventSubscriptionIssueScope;
  /** Short label for a badge or table cell, e.g. `Duplicate consumer`. */
  title: string;
  /** One sentence on what the rule detects, independent of any one record — tooltip/help copy. */
  summary: string;
};

/** The single source of truth for each rule's `severity`, `scope`, and display copy. `validatePlatformEventSubscriptions` reads from this table rather than repeating the literals at each `issues.push` site. */
export const PLATFORM_EVENT_SUBSCRIPTION_RULES: Readonly<
  Record<PlatformEventSubscriptionIssueRule, PlatformEventSubscriptionRuleInfo>
> = {
  'missing-event-bus-or-consumer': {
    rule: 'missing-event-bus-or-consumer',
    severity: 'error',
    // Computable from one record alone, same as every other record-scoped rule in this family — see
    // docs/design/0025's Open questions for why `field-set-inclusion`'s comparable
    // `missing-sobject-reference` rule is `scope: 'scan'` instead, and why this one doesn't copy that.
    scope: 'record',
    title: 'Missing event bus or consumer',
    summary:
      'EventBus__c or Consumer__c is blank — PlatformEventDistributorDIModule.configure() throws ModuleException on this record, which fails the entire DI module, not just this subscription.',
  },
  'matcher-rule-missing-field': {
    rule: 'matcher-rule-missing-field',
    severity: 'error',
    scope: 'record',
    title: 'Matcher rule missing field',
    summary:
      "MatcherRule__c dereferences EventCategory__c and/or Event__c without a null guard — if the field this record's matcher rule needs is blank, every event on the bus throws a NullPointerException for this subscription.",
  },
  'unreachable-subscription': {
    rule: 'unreachable-subscription',
    severity: 'warning',
    scope: 'record',
    title: 'Unreachable subscription',
    summary:
      "A MatchEventBus record with both EventCategory__c and Event__c blank can never satisfy the distributor's pre-filter — it is legal and active, but provably never receives an event.",
  },
  'non-conforming-event-bus': {
    rule: 'non-conforming-event-bus',
    severity: 'error',
    scope: 'record',
    title: 'Non-conforming event bus',
    summary:
      "EventBus__c names a platform event object missing Category__c and/or EventName__c — PlatformEventDistributorException on every event published to it. Only checked when the bus's field list is visible to the scan.",
  },
  'duplicate-consumer': {
    rule: 'duplicate-consumer',
    severity: 'error',
    scope: 'scan',
    title: 'Duplicate consumer',
    summary: 'Two records share a Consumer__c value — the field is unique org-wide, so both cannot deploy together.',
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

/** One problem `validatePlatformEventSubscriptions` found with a scanned `PlatformEvents_Subscription__mdt` record. */
export type PlatformEventSubscriptionIssue = {
  severity: PlatformEventSubscriptionIssueSeverity;
  rule: PlatformEventSubscriptionIssueRule;
  /** Copied from `PLATFORM_EVENT_SUBSCRIPTION_RULES[rule].scope` — see docs/design/0011 for why it's duplicated onto every issue rather than looked up. */
  scope: PlatformEventSubscriptionIssueScope;
  message: string;
  developerName?: string;
  eventBus?: string;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

export type At4dxPlatformEventSubscriptionListResult = {
  source: string;
  records: RawPlatformEventSubscriptionRecord[];
};

export type At4dxPlatformEventSubscriptionValidateResult = {
  source: string;
  recordCount: number;
  issues: PlatformEventSubscriptionIssue[];
};

/**
 * A hypothetical event, as `PlatformEventDistributor` would see it off the trigger: which bus it
 * published on, and its `Category__c`/`EventName__c` field values. Both are optional because a real
 * event can leave either blank, exactly like a subscription's `EventCategory__c`/`Event__c`.
 */
export type PlatformEventDistributionInput = {
  eventBus: string;
  category?: string;
  eventName?: string;
};

/** One subscription `resolvePlatformEventDistribution` determined would receive the simulated event. */
export type PlatformEventDistributionMatch = {
  developerName: string;
  consumer: string;
  eventBus: string;
  /** `Execute_Synchronous__c` — whether the distributor invokes this consumer synchronously or async. */
  executeSynchronous: boolean;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

/**
 * Why a subscription on the simulated event's bus did *not* receive it, in the same order
 * `PlatformEventDistributor` itself would evaluate a record — see `resolvePlatformEventDistribution`.
 */
export type PlatformEventDistributionMissReason =
  /** `IsActive__c` is false — the distributor's own static SOQL never loads this record at all. */
  | 'inactive'
  /** `triggerHandler`'s pre-filter rejects the record before any matcher rule runs — see `unreachable-subscription`. */
  | 'prefiltered'
  /** Passed the pre-filter, but `matcherRule` dereferences a match field this record leaves blank — the runtime NullPointerException hazard, see `matcher-rule-missing-field`. */
  | 'matcher-rule-missing-field'
  /** Passed the pre-filter and every field the matcher rule needs is present, but the value(s) don't match the simulated event. */
  | 'no-match';

/** One subscription on the simulated event's bus that did *not* receive it, and the structured reason why. */
export type PlatformEventDistributionMiss = {
  developerName: string;
  consumer: string;
  eventBus: string;
  reason: PlatformEventDistributionMissReason;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};

/**
 * `resolvePlatformEventDistribution`'s result envelope: the exact consumer set
 * `PlatformEventDistributor` would build for the simulated event, in scan order, plus every
 * subscription on that bus that didn't match and why.
 */
export type PlatformEventDistributionResult = {
  input: PlatformEventDistributionInput;
  matches: PlatformEventDistributionMatch[];
  misses: PlatformEventDistributionMiss[];
};

/** The fields `createPlatformEventSubscription`/`updatePlatformEventSubscription` accept, shared between create's full-record shape and update's partial one. */
export type PlatformEventSubscriptionFieldsInput = {
  label?: string;
  eventBus?: string;
  consumer?: string;
  eventCategory?: string;
  event?: string;
  matcherRule?: MatcherRule;
  isActive?: boolean;
  executeSynchronous?: boolean;
};

/** Where a write reads its validation context from and, when writing locally, where the file goes. Exactly one of `sourceDir`/`connection` is required; both may be given. */
export type CreatePlatformEventSubscriptionTarget = {
  /** The package directory `customMetadata/PlatformEvents_Subscription.<name>.md-meta.xml` is created under. */
  sourceDir?: string;
  connection?: Connection;
  /** Deploy poll timeout. Only meaningful when `connection` is given. */
  wait?: Duration;
};

/** Same shape as `CreatePlatformEventSubscriptionTarget`, but `sourceDirs` is a search scope (one or more roots) rather than a single destination, since `update` locates an existing file instead of choosing where to create one. */
export type UpdatePlatformEventSubscriptionTarget = {
  sourceDirs?: string[];
  connection?: Connection;
  wait?: Duration;
};

export type CreatePlatformEventSubscriptionInput = PlatformEventSubscriptionFieldsInput & {
  developerName: string;
  eventBus: string;
  consumer: string;
  matcherRule: MatcherRule;
  /** Write/deploy even if validation finds an `error`-severity issue. The issue still appears in the result. */
  force?: boolean;
};

export type UpdatePlatformEventSubscriptionInput = PlatformEventSubscriptionFieldsInput & {
  developerName: string;
  force?: boolean;
};

/** The error conditions `createPlatformEventSubscription`/`updatePlatformEventSubscription` signal structurally (via `code`) rather than by message text, so a `Messages`-based caller (the CLI) can map each one to its own error key without string-matching. Errors outside this list (a scan/deploy I/O failure) are rethrown as the underlying error. Same code list as `FieldSetInclusionWriteErrorCode` — see docs/design/0025's Behavior section. */
export type PlatformEventSubscriptionWriteErrorCode =
  | 'source-or-target-required'
  | 'invalid-developer-name'
  | 'label-too-long'
  | 'developer-name-already-exists'
  | 'developer-name-not-found'
  | 'no-fields-to-update'
  | 'at4dx-not-detected'
  | 'validation-failed'
  | 'deploy-failed';

export class PlatformEventSubscriptionWriteError extends Error {
  public readonly code: PlatformEventSubscriptionWriteErrorCode;
  /** Populated only for `code: 'validation-failed'` — the blocking issues, so a caller can display them without re-running validation. Can carry `matcher-rule-missing-field`, catching the common authoring mistake at write time. */
  public readonly issues?: PlatformEventSubscriptionIssue[];

  public constructor(
    code: PlatformEventSubscriptionWriteErrorCode,
    message: string,
    issues?: PlatformEventSubscriptionIssue[],
  ) {
    super(message);
    this.name = 'PlatformEventSubscriptionWriteError';
    this.code = code;
    this.issues = issues;
  }
}

export type At4dxPlatformEventSubscriptionWriteResult = {
  developerName: string;
  eventBus: string;
  consumer: string;
  /** Absent when written only to a temp directory for a `connection`-only (org-direct) run. */
  filePath?: string;
  /** Absent when no `connection` was given. */
  deploy?: { id: string; status: string; success: boolean };
  /** The full validation result, even when `force` was used to write past a blocking issue. */
  issues: PlatformEventSubscriptionIssue[];
};

export type At4dxPlatformEventSubscriptionCreateResult = At4dxPlatformEventSubscriptionWriteResult;
export type At4dxPlatformEventSubscriptionUpdateResult = At4dxPlatformEventSubscriptionWriteResult;
