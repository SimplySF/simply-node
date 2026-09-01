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

import {
  PLATFORM_EVENT_SUBSCRIPTION_RULES,
  type MalformedPlatformEventSubscriptionRecord,
  type PlatformEventDistributionInput,
  type PlatformEventDistributionMatch,
  type PlatformEventDistributionMiss,
  type PlatformEventDistributionMissReason,
  type PlatformEventDistributionResult,
  type PlatformEventSubscriptionIssue,
  type RawPlatformEventSubscriptionRecord,
} from './at4dxPlatformEventSubscriptionTypes.js';
import type { PlatformEventSubscriptionLocalScanResult } from './at4dxPlatformEventSubscriptionLocalScan.js';

/**
 * A platform event bus's field list, keyed by `EventBus__c` value. Populated by reading
 * `objects/<Bus>__e/fields/` out of local source, or `describe` against an org — see each scan
 * module. Optional everywhere `non-conforming-event-bus` is checked: a bus absent from this map is
 * treated as "not looked at", not "broken" — see docs/design/0025's "What makes this family shaped
 * differently" section.
 */
export type EventBusFields = ReadonlyMap<string, ReadonlySet<string>>;

/** The two fields every platform event bus `PlatformEventDistributor` reads needs to have, for `non-conforming-event-bus`. */
const REQUIRED_EVENT_BUS_FIELDS = ['Category__c', 'EventName__c'];

/** `missing-event-bus-or-consumer` — one issue per malformed record. */
function missingEventBusOrConsumerIssues(
  malformed: MalformedPlatformEventSubscriptionRecord[],
): PlatformEventSubscriptionIssue[] {
  return malformed.map((record) => {
    const info = PLATFORM_EVENT_SUBSCRIPTION_RULES['missing-event-bus-or-consumer'];
    return {
      severity: info.severity,
      rule: info.rule,
      scope: info.scope,
      message: `${record.developerName}: EventBus__c, Consumer__c, or MatcherRule__c is blank or unrecognized — PlatformEventDistributorDIModule.configure() throws ModuleException on this record, failing the entire DI module.`,
      developerName: record.developerName,
      source: record.source,
      filePath: record.filePath,
    };
  });
}

/**
 * @returns Whether `record`'s `matcherRule` dereferences a match field (`eventCategory`/`event`) that's
 * blank — the runtime `NullPointerException` hazard. Shared by `matcher-rule-missing-field` and, once
 * a record has passed {@link hasPreFilterMatchField}'s pre-filter for a simulated event, by
 * `resolvePlatformEventDistribution`'s `matcher-rule-missing-field` miss reason — one implementation of
 * which fields each matcher rule needs, not two. See docs/design/0025's Stage 2 plan.
 */
function isMissingMatcherField(record: RawPlatformEventSubscriptionRecord): boolean {
  switch (record.matcherRule) {
    case 'MatchEventBus':
      return false;
    case 'MatchCategory':
      return !record.eventCategory;
    case 'MatchEvent':
      return !record.event;
    case 'MatchCategoryAndEvent':
      return !record.eventCategory || !record.event;
  }
}

/** `matcher-rule-missing-field` — one issue per record whose `matcherRule` dereferences a blank match field. */
function matcherRuleMissingFieldIssues(
  records: RawPlatformEventSubscriptionRecord[],
): PlatformEventSubscriptionIssue[] {
  const issues: PlatformEventSubscriptionIssue[] = [];

  for (const record of records) {
    if (!isMissingMatcherField(record)) {
      continue;
    }

    const info = PLATFORM_EVENT_SUBSCRIPTION_RULES['matcher-rule-missing-field'];
    issues.push({
      severity: info.severity,
      rule: info.rule,
      scope: info.scope,
      message: `${record.developerName}: MatcherRule__c is ${record.matcherRule}, which requires a match field this record leaves blank — every event on ${record.eventBus} throws a NullPointerException for this subscription.`,
      developerName: record.developerName,
      eventBus: record.eventBus,
      source: record.source,
      filePath: record.filePath,
    });
  }

  return issues;
}

/**
 * @returns Whether `record`'s `eventCategory`/`event` fields could ever satisfy `triggerHandler`'s
 * pre-filter (`eventCategorySet.contains(EventCategory__c) || eventNameSet.contains(Event__c)`) for
 * *some* simulated event — true unless both are blank, since `contains(null)` is never true. Shared by
 * `unreachable-subscription` (record-level: is it unreachable for every possible event) and
 * `resolvePlatformEventDistribution`'s per-event pre-filter check via {@link passesPreFilterForEvent} —
 * one statement of the pre-filter's blank-field behavior, not two. See docs/design/0025's Stage 2 plan.
 */
function hasPreFilterMatchField(record: RawPlatformEventSubscriptionRecord): boolean {
  return Boolean(record.eventCategory) || Boolean(record.event);
}

/**
 * `unreachable-subscription` — a `MatchEventBus` record with both match fields blank can never satisfy
 * `triggerHandler`'s pre-filter, per {@link hasPreFilterMatchField}. Only fires for `MatchEventBus`: any
 * other rule with a blank match field is already the harder `matcher-rule-missing-field` error — see
 * docs/design/0025's Open questions.
 */
function unreachableSubscriptionIssues(
  records: RawPlatformEventSubscriptionRecord[],
): PlatformEventSubscriptionIssue[] {
  const issues: PlatformEventSubscriptionIssue[] = [];

  for (const record of records) {
    if (record.matcherRule !== 'MatchEventBus' || hasPreFilterMatchField(record)) {
      continue;
    }

    const info = PLATFORM_EVENT_SUBSCRIPTION_RULES['unreachable-subscription'];
    issues.push({
      severity: info.severity,
      rule: info.rule,
      scope: info.scope,
      message: `${record.developerName}: MatchEventBus with both EventCategory__c and Event__c blank can never satisfy the distributor's pre-filter — this subscription is legal and active but provably never receives an event.`,
      developerName: record.developerName,
      eventBus: record.eventBus,
      source: record.source,
      filePath: record.filePath,
    });
  }

  return issues;
}

/** `non-conforming-event-bus` — only checked for a record whose `eventBus` is present in `eventBusFields`; absent means "not looked at", not "broken". */
function nonConformingEventBusIssues(
  records: RawPlatformEventSubscriptionRecord[],
  eventBusFields: EventBusFields | undefined,
): PlatformEventSubscriptionIssue[] {
  if (!eventBusFields) {
    return [];
  }

  const issues: PlatformEventSubscriptionIssue[] = [];

  for (const record of records) {
    const fields = eventBusFields.get(record.eventBus);
    if (!fields) {
      continue;
    }

    const missingFields = REQUIRED_EVENT_BUS_FIELDS.filter((field) => !fields.has(field));
    if (missingFields.length === 0) {
      continue;
    }

    const info = PLATFORM_EVENT_SUBSCRIPTION_RULES['non-conforming-event-bus'];
    issues.push({
      severity: info.severity,
      rule: info.rule,
      scope: info.scope,
      message: `${record.developerName}: ${record.eventBus} is missing ${missingFields.join(' and ')} — PlatformEventDistributorException on every event published to this bus.`,
      developerName: record.developerName,
      eventBus: record.eventBus,
      source: record.source,
      filePath: record.filePath,
    });
  }

  return issues;
}

/** `duplicate-consumer` — `Consumer__c` is unique org-wide. */
function duplicateConsumerIssues(records: RawPlatformEventSubscriptionRecord[]): PlatformEventSubscriptionIssue[] {
  const byConsumer = new Map<string, RawPlatformEventSubscriptionRecord[]>();
  for (const record of records) {
    const group = byConsumer.get(record.consumer) ?? [];
    group.push(record);
    byConsumer.set(record.consumer, group);
  }

  const issues: PlatformEventSubscriptionIssue[] = [];
  for (const group of byConsumer.values()) {
    if (group.length <= 1) {
      continue;
    }
    for (const record of group) {
      const info = PLATFORM_EVENT_SUBSCRIPTION_RULES['duplicate-consumer'];
      issues.push({
        severity: info.severity,
        rule: info.rule,
        scope: info.scope,
        message: `${record.developerName}: shares Consumer__c "${record.consumer}" with another record — the field is unique org-wide, so both cannot deploy together.`,
        developerName: record.developerName,
        eventBus: record.eventBus,
        source: record.source,
        filePath: record.filePath,
      });
    }
  }
  return issues;
}

type DeveloperNameOccurrence = {
  developerName: string;
  eventBus?: string;
  source: string;
  filePath?: string;
};

/** `duplicate-developer-name` — the same `DeveloperName` defined more than once across the scan. */
function duplicateDeveloperNameIssues(
  records: RawPlatformEventSubscriptionRecord[],
  malformed: MalformedPlatformEventSubscriptionRecord[],
): PlatformEventSubscriptionIssue[] {
  const occurrencesByDeveloperName = new Map<string, DeveloperNameOccurrence[]>();

  const record = (occurrence: DeveloperNameOccurrence): void => {
    const occurrences = occurrencesByDeveloperName.get(occurrence.developerName) ?? [];
    occurrences.push(occurrence);
    occurrencesByDeveloperName.set(occurrence.developerName, occurrences);
  };

  for (const raw of records) {
    record({ developerName: raw.developerName, eventBus: raw.eventBus, source: raw.source, filePath: raw.filePath });
  }
  for (const raw of malformed) {
    record({ developerName: raw.developerName, source: raw.source, filePath: raw.filePath });
  }

  const issues: PlatformEventSubscriptionIssue[] = [];
  for (const [developerName, occurrences] of occurrencesByDeveloperName) {
    if (occurrences.length <= 1) {
      continue;
    }
    for (const occurrence of occurrences) {
      const info = PLATFORM_EVENT_SUBSCRIPTION_RULES['duplicate-developer-name'];
      issues.push({
        severity: info.severity,
        rule: info.rule,
        scope: info.scope,
        message: `${developerName}: defined more than once (also in ${occurrences
          .filter((other) => other !== occurrence)
          .map((other) => other.source)
          .join(
            ', ',
          )}) — Custom Metadata records are keyed by DeveloperName, so deploying these together is a conflict.`,
        developerName,
        eventBus: occurrence.eventBus,
        source: occurrence.source,
        filePath: occurrence.filePath,
      });
    }
  }
  return issues;
}

/**
 * Validate a scan's `PlatformEvents_Subscription__mdt` records for wiring problems `list` doesn't fail
 * on: a record with a blank/unrecognized `EventBus__c`/`Consumer__c`/`MatcherRule__c`, a matcher rule
 * that dereferences a blank match field (real `NullPointerException` risk), a `MatchEventBus` record
 * the distributor's pre-filter can never admit, an event bus missing the fields the distributor reads,
 * two records sharing a `Consumer__c`, and the same `DeveloperName` defined more than once.
 *
 * `non-conforming-event-bus` only fires for a bus present in `eventBusFields` — see `EventBusFields`.
 *
 * @param scan - A scan result envelope (`{ records, malformed }`, as returned by `scanOrgPlatformEventSubscriptions`/`scanLocalPlatformEventSubscriptions`).
 * @param eventBusFields - Optional: each event bus's known field names, for `non-conforming-event-bus`.
 * @returns One issue per problem found. Empty when nothing's wrong.
 */
export function validatePlatformEventSubscriptions(
  scan: Pick<PlatformEventSubscriptionLocalScanResult, 'records' | 'malformed'>,
  eventBusFields?: EventBusFields,
): PlatformEventSubscriptionIssue[] {
  const { records, malformed } = scan;

  return [
    ...missingEventBusOrConsumerIssues(malformed),
    ...matcherRuleMissingFieldIssues(records),
    ...unreachableSubscriptionIssues(records),
    ...nonConformingEventBusIssues(records, eventBusFields),
    ...duplicateConsumerIssues(records),
    ...duplicateDeveloperNameIssues(records, malformed),
  ];
}

/**
 * @returns Whether two field values match the way `String.equalsIgnoreCase` does — case-insensitive,
 * and only when both sides are present. A blank input side (the simulated event omits that field) can
 * never satisfy this, the same conservative treatment {@link hasPreFilterMatchField} gives a blank
 * subscription field: absence never counts as a match on either side of the comparison.
 */
function equalsIgnoreCase(recordValue: string | undefined, inputValue: string | undefined): boolean {
  if (recordValue === undefined || inputValue === undefined) {
    return false;
  }
  return recordValue.toLowerCase() === inputValue.toLowerCase();
}

/**
 * @returns Whether `record` survives `triggerHandler`'s pre-filter for the simulated `input` event —
 * `eventCategorySet.contains(EventCategory__c) || eventNameSet.contains(Event__c)`, modeled here as
 * `record`'s field matching `input`'s corresponding value. Runs *before* the matcher rule in the real
 * distributor, and before {@link isMissingMatcherField}'s NPE hazard in `resolvePlatformEventDistribution`
 * below — a record can pass this via one field (e.g. `Event__c`) while the matcher rule it's configured
 * with needs the *other*, blank field, which is exactly how `matcher-rule-missing-field` throws in a
 * real org: the pre-filter doesn't know or care which field the matcher rule dereferences.
 */
function passesPreFilterForEvent(
  record: RawPlatformEventSubscriptionRecord,
  input: PlatformEventDistributionInput,
): boolean {
  return equalsIgnoreCase(record.eventCategory, input.category) || equalsIgnoreCase(record.event, input.eventName);
}

/**
 * @returns Whether `record`'s `matcherRule` accepts the simulated `input` event. Only called once
 * {@link isMissingMatcherField} has confirmed every field this `matcherRule` needs is present, so the
 * dereferences below are safe. `MatchEventBus` dereferences neither field and so always accepts once it
 * has reached this point (having already passed the bus, active, and pre-filter checks).
 */
function matcherRuleMatchesEvent(
  record: RawPlatformEventSubscriptionRecord,
  input: PlatformEventDistributionInput,
): boolean {
  switch (record.matcherRule) {
    case 'MatchEventBus':
      return true;
    case 'MatchCategory':
      return equalsIgnoreCase(record.eventCategory, input.category);
    case 'MatchEvent':
      return equalsIgnoreCase(record.event, input.eventName);
    case 'MatchCategoryAndEvent':
      return equalsIgnoreCase(record.eventCategory, input.category) && equalsIgnoreCase(record.event, input.eventName);
  }
}

/**
 * Simulate `PlatformEventDistributor`'s consumer resolution for one hypothetical event, reimplementing
 * its decision sequence exactly: restrict to subscriptions on the event's bus, drop `IsActive__c: false`
 * records (the distributor's own static SOQL never loads them), apply `triggerHandler`'s pre-filter, then
 * the `matcherRule` branch — surfacing the `matcher-rule-missing-field` NullPointerException hazard as a
 * miss reason rather than throwing, since this is a simulation, not a real invocation.
 *
 * This is the CLI analogue of `resolveBindings` — see docs/design/0025's "The simulator is the reason
 * this family is worth building" section. It shares its field-presence and pre-filter-reachability logic
 * with `validatePlatformEventSubscriptions`'s `matcher-rule-missing-field`/`unreachable-subscription`
 * rules via {@link isMissingMatcherField}/{@link hasPreFilterMatchField}, so both stay derived from one
 * implementation of the distributor's control flow rather than two that can drift apart.
 *
 * There is no priority/sequence field on this CMDT (see docs/design/0025's "What makes this family
 * shaped differently" section), so `matches` is returned in scan order — the same flat, unordered-by-
 * design posture `list` takes, not a resolved winner order.
 *
 * @param input - The simulated event: which bus it's on, and its `category`/`eventName` values.
 * @param records - The scanned subscription records to evaluate, as returned by `scanOrgPlatformEventSubscriptions`/`scanLocalPlatformEventSubscriptions`.
 * @returns Every subscription on `input.eventBus` that would receive the event, in scan order, plus every one that wouldn't and the structured reason why.
 */
export function resolvePlatformEventDistribution(
  input: PlatformEventDistributionInput,
  records: RawPlatformEventSubscriptionRecord[],
): PlatformEventDistributionResult {
  const matches: PlatformEventDistributionMatch[] = [];
  const misses: PlatformEventDistributionMiss[] = [];

  const miss = (record: RawPlatformEventSubscriptionRecord, reason: PlatformEventDistributionMissReason): void => {
    misses.push({
      developerName: record.developerName,
      consumer: record.consumer,
      eventBus: record.eventBus,
      reason,
      source: record.source,
      filePath: record.filePath,
    });
  };

  for (const record of records) {
    if (record.eventBus !== input.eventBus) {
      continue;
    }

    if (!record.isActive) {
      miss(record, 'inactive');
      continue;
    }

    if (!passesPreFilterForEvent(record, input)) {
      miss(record, 'prefiltered');
      continue;
    }

    if (isMissingMatcherField(record)) {
      miss(record, 'matcher-rule-missing-field');
      continue;
    }

    if (!matcherRuleMatchesEvent(record, input)) {
      miss(record, 'no-match');
      continue;
    }

    matches.push({
      developerName: record.developerName,
      consumer: record.consumer,
      eventBus: record.eventBus,
      executeSynchronous: record.executeSynchronous,
      source: record.source,
      filePath: record.filePath,
    });
  }

  return { input, matches, misses };
}
