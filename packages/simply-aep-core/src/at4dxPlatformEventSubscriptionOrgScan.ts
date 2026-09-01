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

import type { AepConnection } from './at4dxBindingTypes.js';
import {
  ALL_MATCHER_RULES,
  PLATFORM_EVENT_SUBSCRIPTION_OBJECT,
  type MalformedPlatformEventSubscriptionRecord,
  type MatcherRule,
  type RawPlatformEventSubscriptionRecord,
} from './at4dxPlatformEventSubscriptionTypes.js';

/**
 * SOQL for `PlatformEvents_Subscription__mdt`. No relationship traversal — unlike
 * `ApplicationFactory_*Binding__mdt`/`SelectorConfig_FieldSetInclusion__mdt`'s `BindingSObject__c`,
 * `EventBus__c` is `DeveloperControlled` plain text, not an `EntityDefinition` reference, so the org
 * and local shapes agree without any resolution step.
 */
const SOQL = `SELECT DeveloperName, Label, EventBus__c, Consumer__c, EventCategory__c, Event__c, MatcherRule__c, IsActive__c, Execute_Synchronous__c FROM ${PLATFORM_EVENT_SUBSCRIPTION_OBJECT}`;

type OrgPlatformEventSubscriptionRecord = {
  DeveloperName: string;
  Label: string;
  EventBus__c?: string | null;
  Consumer__c?: string | null;
  EventCategory__c?: string | null;
  Event__c?: string | null;
  MatcherRule__c?: string | null;
  IsActive__c: boolean;
  Execute_Synchronous__c: boolean;
};

function parseMatcherRule(value: string | null | undefined): MatcherRule | undefined {
  return value != null && (ALL_MATCHER_RULES as string[]).includes(value) ? (value as MatcherRule) : undefined;
}

/** @returns The normalized subscription record for an already-validated `eventBus`/`consumer`/`matcherRule`. */
function toRawRecord(
  record: OrgPlatformEventSubscriptionRecord,
  eventBus: string,
  consumer: string,
  matcherRule: MatcherRule,
  source: string,
): RawPlatformEventSubscriptionRecord {
  return {
    developerName: record.DeveloperName,
    label: record.Label,
    eventBus,
    consumer,
    eventCategory: record.EventCategory__c ?? undefined,
    event: record.Event__c ?? undefined,
    matcherRule,
    isActive: record.IsActive__c,
    executeSynchronous: record.Execute_Synchronous__c,
    source,
  };
}

export type PlatformEventSubscriptionOrgScanResult = {
  records: RawPlatformEventSubscriptionRecord[];
  /** Records with a blank `EventBus__c`/`Consumer__c`, or an unrecognized `MatcherRule__c` — excluded from `records`, see `MalformedPlatformEventSubscriptionRecord`. */
  malformed: MalformedPlatformEventSubscriptionRecord[];
  /** `true` when the `PlatformEvents_Subscription__mdt` Custom Metadata Type doesn't exist in this org. */
  missing: boolean;
};

/**
 * Query the target org for AT4DX `PlatformEvents_Subscription__mdt` records — an ordinary queryable
 * Custom Metadata Type, plain REST (`connection.autoFetchQuery`), no Tooling API, no chunking (row
 * counts are inherently small).
 *
 * @param connection - The org connection to query against.
 * @returns The discovered records, and whether the Custom Metadata Type exists in this org at all.
 */
export async function scanOrgPlatformEventSubscriptions(
  connection: AepConnection,
): Promise<PlatformEventSubscriptionOrgScanResult> {
  const source = connection.getUsername() ?? 'org';

  try {
    const result = await connection.autoFetchQuery(SOQL);
    const records: RawPlatformEventSubscriptionRecord[] = [];
    const malformed: MalformedPlatformEventSubscriptionRecord[] = [];

    for (const record of result.records as unknown as OrgPlatformEventSubscriptionRecord[]) {
      const eventBus = record.EventBus__c ?? undefined;
      const consumer = record.Consumer__c ?? undefined;
      const matcherRule = parseMatcherRule(record.MatcherRule__c);

      if (!eventBus || !consumer || !matcherRule) {
        malformed.push({ developerName: record.DeveloperName, source });
        continue;
      }

      records.push(toRawRecord(record, eventBus, consumer, matcherRule, source));
    }

    return { records, malformed, missing: false };
  } catch (error) {
    if ((error as Error).name === 'INVALID_TYPE') {
      return { records: [], malformed: [], missing: true };
    }
    throw error;
  }
}
