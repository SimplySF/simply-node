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

/** @returns Whether `record`'s `matcherRule` dereferences a match field (`eventCategory`/`event`) that's blank. */
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
 * `unreachable-subscription` — a `MatchEventBus` record with both match fields blank can never satisfy
 * `triggerHandler`'s pre-filter (`eventCategorySet.contains(EventCategory__c) ||
 * eventNameSet.contains(Event__c)` — both sides are `contains(null)` when both fields are blank, which
 * is never true). Only fires for `MatchEventBus`: any other rule with a blank match field is already
 * the harder `matcher-rule-missing-field` error — see docs/design/0025's Open questions.
 */
function unreachableSubscriptionIssues(
  records: RawPlatformEventSubscriptionRecord[],
): PlatformEventSubscriptionIssue[] {
  const issues: PlatformEventSubscriptionIssue[] = [];

  for (const record of records) {
    if (record.matcherRule !== 'MatchEventBus' || record.eventCategory || record.event) {
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
