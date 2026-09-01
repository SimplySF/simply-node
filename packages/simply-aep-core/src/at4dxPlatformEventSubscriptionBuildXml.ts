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

import type { RawPlatformEventSubscriptionRecord } from './at4dxPlatformEventSubscriptionTypes.js';
import {
  buildCustomMetadataXml,
  buildValuesXml,
  diffValueEntries,
  patchCustomMetadataXml,
  type CustomMetadataValueInput,
} from './customMetadataXml.js';

export type PlatformEventSubscriptionXmlFields = Pick<
  RawPlatformEventSubscriptionRecord,
  'eventBus' | 'consumer' | 'eventCategory' | 'event' | 'matcherRule' | 'isActive' | 'executeSynchronous'
>;

/**
 * The `<values>` entries for a `PlatformEvents_Subscription__mdt` record — the single source of truth
 * `buildPlatformEventSubscriptionXml` (a full document) and `patchPlatformEventSubscriptionXml` (an
 * in-place patch) both build on, so they can never disagree on field order/type.
 *
 * `EventCategory__c`/`Event__c` are written `xsi:nil` when absent — an explicit nil, matching how a
 * real deployed record represents a blank optional field, and what `scanLocalPlatformEventSubscriptions`
 * expects back out of `fieldValue`.
 */
export function platformEventSubscriptionValueEntries(
  record: PlatformEventSubscriptionXmlFields,
): CustomMetadataValueInput[] {
  return [
    { field: 'EventBus__c', value: record.eventBus },
    { field: 'Consumer__c', value: record.consumer },
    { field: 'EventCategory__c', value: record.eventCategory },
    { field: 'Event__c', value: record.event },
    { field: 'MatcherRule__c', value: record.matcherRule },
    { field: 'IsActive__c', value: String(record.isActive), type: 'boolean' },
    { field: 'Execute_Synchronous__c', value: String(record.executeSynchronous), type: 'boolean' },
  ];
}

/**
 * Builds a full `.md-meta.xml` document for a `PlatformEvents_Subscription__mdt` record — the
 * write-side counterpart to `scanLocalPlatformEventSubscriptions`'s parsing, byte-shape-compatible
 * with it (a re-scan of this output reproduces `record`). `DeveloperName` isn't part of the body —
 * like every other `CustomMetadata` component, it's carried by the file name
 * (`PlatformEvents_Subscription.<DeveloperName>.md-meta.xml`), not this function's concern. Used by
 * `createPlatformEventSubscription`, and by `updatePlatformEventSubscription` when there's no existing
 * local file to preserve the shape of (an org-only update) — see `patchPlatformEventSubscriptionXml`
 * for the local-file case.
 *
 * @param record - The field values to serialize.
 * @param meta - Presentation-only metadata not read back by any scanner.
 * @returns The full XML document text, ready to write to a `.md-meta.xml` file.
 */
export function buildPlatformEventSubscriptionXml(
  record: PlatformEventSubscriptionXmlFields,
  meta: { label: string },
): string {
  return buildCustomMetadataXml(meta.label, buildValuesXml(platformEventSubscriptionValueEntries(record)));
}

/**
 * Patches an existing `PlatformEvents_Subscription__mdt` `.md-meta.xml` document in place: only the
 * fields that actually changed between `existing` and `merged` get their `<values>` entry touched, and
 * `<label>` only if it changed — every other byte (untouched fields' exact markup, field order,
 * indentation, comments) passes through unmodified. `updatePlatformEventSubscription`'s local-file
 * write path — see docs/design/0022-at4dx-update-xml-shape-preservation.md.
 *
 * @param existingXml - The file's current contents.
 * @param existing - The record as scanned, before this update's changes.
 * @param merged - The record after this update's changes are merged in.
 * @param meta - Presentation-only metadata not read back by any scanner.
 * @returns The patched document text.
 * @throws {UnpatchableValueShapeError} See `patchCustomMetadataXml`.
 */
export function patchPlatformEventSubscriptionXml(
  existingXml: string,
  existing: PlatformEventSubscriptionXmlFields,
  merged: PlatformEventSubscriptionXmlFields,
  meta: { label: string },
): string {
  const changedEntries = diffValueEntries(
    platformEventSubscriptionValueEntries(existing),
    platformEventSubscriptionValueEntries(merged),
  );
  return patchCustomMetadataXml(existingXml, meta.label, changedEntries);
}
