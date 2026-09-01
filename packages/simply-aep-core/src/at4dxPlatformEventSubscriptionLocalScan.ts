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

import path from 'node:path';
import { ComponentSet, type SourceComponent } from '@salesforce/source-deploy-retrieve';
import {
  ALL_MATCHER_RULES,
  PLATFORM_EVENT_SUBSCRIPTION_LOCAL_OBJECT_NAME,
  type MalformedPlatformEventSubscriptionRecord,
  type MatcherRule,
  type RawPlatformEventSubscriptionRecord,
} from './at4dxPlatformEventSubscriptionTypes.js';
import { extractValues, fieldValue, toBoolean, type CustomMetadataXml } from './customMetadataXml.js';

/**
 * No `ambiguous` key here, unlike the other three families' scan results — `EventBus__c` has no
 * `*Alternate__c` counterpart to be ambiguous against. See docs/design/0025's "What makes this
 * family shaped differently" section.
 */
export type PlatformEventSubscriptionLocalScanResult = {
  records: RawPlatformEventSubscriptionRecord[];
  /** Records with a blank `EventBus__c`/`Consumer__c`, or an unrecognized `MatcherRule__c` — excluded from `records`, see `MalformedPlatformEventSubscriptionRecord`. */
  malformed: MalformedPlatformEventSubscriptionRecord[];
};

/** @returns The source-format package/project directory name a metadata file belongs to (the directory containing `customMetadata`), same convention `at4dxLocalScan.ts` uses. */
function deriveProjectName(filePath: string | undefined): string {
  if (!filePath) {
    return 'local';
  }
  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.indexOf('/customMetadata/');
  if (index === -1) {
    return 'local';
  }
  return path.basename(normalized.slice(0, index));
}

function parseMatcherRule(value: string | undefined): MatcherRule | undefined {
  return value !== undefined && (ALL_MATCHER_RULES as string[]).includes(value) ? (value as MatcherRule) : undefined;
}

export type LocalPlatformEventSubscriptionScanEntry =
  | { kind: 'record'; value: RawPlatformEventSubscriptionRecord }
  | { kind: 'malformed'; value: MalformedPlatformEventSubscriptionRecord };

/** @returns The normalized subscription record for one `PlatformEvents_Subscription.*` `CustomMetadata` component, tagged `malformed` if its `EventBus__c`, `Consumer__c`, or `MatcherRule__c` isn't usable. */
function toRawRecord(component: SourceComponent, developerName: string): LocalPlatformEventSubscriptionScanEntry {
  const xml = component.parseXmlSync<CustomMetadataXml>();
  const values = extractValues(xml);
  const source = deriveProjectName(component.xml);
  const filePath = component.xml;

  const eventBus = fieldValue(values, 'EventBus__c');
  const consumer = fieldValue(values, 'Consumer__c');
  const matcherRule = parseMatcherRule(fieldValue(values, 'MatcherRule__c'));

  if (!eventBus || !consumer || !matcherRule) {
    return { kind: 'malformed', value: { developerName, source, filePath } };
  }

  return {
    kind: 'record',
    value: {
      developerName,
      label: xml.CustomMetadata?.label ?? developerName,
      eventBus,
      consumer,
      eventCategory: fieldValue(values, 'EventCategory__c'),
      event: fieldValue(values, 'Event__c'),
      matcherRule,
      isActive: toBoolean(fieldValue(values, 'IsActive__c'), true),
      executeSynchronous: toBoolean(fieldValue(values, 'Execute_Synchronous__c'), false),
      source,
      filePath,
    },
  };
}

/**
 * Scan local Salesforce DX source directories for AT4DX `PlatformEvents_Subscription__mdt` records,
 * parsing each `CustomMetadata` component's `<values>` pairs directly — the same approach
 * `at4dxLocalScan.ts`/`at4dxFieldSetInclusionLocalScan.ts` use.
 *
 * Unlike an org (see `at4dxPlatformEventSubscriptionOrgScan.ts`), local source gives no signal for
 * "this Custom Metadata Type doesn't exist" independent of "zero records exist for it" — a missing
 * `customMetadata` folder and an empty one look identical to `ComponentSet.fromSource`. Callers treat
 * an empty result (no records _and_ no malformed) as "AT4DX isn't configured here."
 *
 * @param sourceDirs - The source directories to scan.
 * @returns The discovered records, plus the malformed diagnostic `validatePlatformEventSubscriptions` consumes.
 */
export function scanLocalPlatformEventSubscriptions(sourceDirs: string[]): PlatformEventSubscriptionLocalScanResult {
  const records: RawPlatformEventSubscriptionRecord[] = [];
  const malformed: MalformedPlatformEventSubscriptionRecord[] = [];

  const components = ComponentSet.fromSource(sourceDirs);

  for (const rawComponent of components) {
    const component = rawComponent as SourceComponent;
    if (component.type.id !== 'custommetadata') {
      continue;
    }

    const separatorIndex = component.name.indexOf('.');
    if (separatorIndex === -1) {
      continue;
    }
    const localObjectName = component.name.slice(0, separatorIndex);
    if (localObjectName !== PLATFORM_EVENT_SUBSCRIPTION_LOCAL_OBJECT_NAME) {
      continue;
    }
    const developerName = component.name.slice(separatorIndex + 1);

    const entry = toRawRecord(component, developerName);
    if (entry.kind === 'record') {
      records.push(entry.value);
    } else {
      malformed.push(entry.value);
    }
  }

  return { records, malformed };
}
