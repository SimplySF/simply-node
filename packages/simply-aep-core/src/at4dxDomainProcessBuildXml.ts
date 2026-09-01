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

import type { RawDomainProcessBindingRecord } from './at4dxDomainProcessBindingTypes.js';
import {
  buildCustomMetadataXml,
  buildValuesXml,
  diffValueEntries,
  patchCustomMetadataXml,
  type CustomMetadataValueInput,
} from './customMetadataXml.js';

export type DomainProcessBindingXmlFields = Pick<
  RawDomainProcessBindingRecord,
  | 'sobject'
  | 'sobjectField'
  | 'processContext'
  | 'triggerOperation'
  | 'domainMethodToken'
  | 'type'
  | 'classToInject'
  | 'order'
  | 'isActive'
  | 'executeAsynchronous'
  | 'logicalInverse'
  | 'preventRecursive'
  | 'description'
>;

/**
 * The `<values>` entries for a `DomainProcessBinding__mdt` record — the single source of truth
 * `buildDomainProcessBindingXml` (a full document) and `patchDomainProcessBindingXml` (an in-place
 * patch) both build on, so they can never disagree on field order/type.
 *
 * Like `bindingValueEntries`, always includes both `RelatedDomainBindingSObject__c` and
 * `RelatedDomainBindingSObjectAlternate__c` — exactly one populated per `record.sobjectField`, the
 * other explicitly `xsi:nil`, so a re-scan never sees both fields set (which
 * `validateDomainProcessBindings` flags as `ambiguous-sobject-reference`).
 */
export function domainProcessBindingValueEntries(record: DomainProcessBindingXmlFields): CustomMetadataValueInput[] {
  return [
    {
      field: 'RelatedDomainBindingSObject__c',
      value: record.sobjectField === 'primary' ? record.sobject : undefined,
    },
    {
      field: 'RelatedDomainBindingSObjectAlternate__c',
      value: record.sobjectField === 'alternate' ? record.sobject : undefined,
    },
    { field: 'ProcessContext__c', value: record.processContext },
    { field: 'TriggerOperation__c', value: record.triggerOperation },
    { field: 'DomainMethodToken__c', value: record.domainMethodToken },
    { field: 'Type__c', value: record.type },
    { field: 'ClassToInject__c', value: record.classToInject },
    { field: 'OrderOfExecution__c', value: String(record.order), type: 'double' },
    { field: 'IsActive__c', value: String(record.isActive), type: 'boolean' },
    { field: 'ExecuteAsynchronous__c', value: String(record.executeAsynchronous), type: 'boolean' },
    { field: 'LogicalInverse__c', value: String(record.logicalInverse), type: 'boolean' },
    { field: 'PreventRecursive__c', value: String(record.preventRecursive), type: 'boolean' },
    { field: 'Description__c', value: record.description },
  ];
}

/**
 * Builds a full `.md-meta.xml` document for a `DomainProcessBinding__mdt` record — the write-side
 * counterpart to `scanLocalDomainProcessBindings`'s parsing, byte-shape-compatible with it (a re-scan
 * of this output reproduces `record`). `DeveloperName` isn't part of the body — like every other
 * `CustomMetadata` component, it's carried by the file name
 * (`DomainProcessBinding.<DeveloperName>.md-meta.xml`), not this function's concern. Used by
 * `createDomainProcessBinding`, and by `updateDomainProcessBinding` when there's no existing local
 * file to preserve the shape of (an org-only update) — see `patchDomainProcessBindingXml` for the
 * local-file case.
 *
 * @param record - The field values to serialize.
 * @param meta - Presentation-only metadata not read back by any scanner.
 * @returns The full XML document text, ready to write to a `.md-meta.xml` file.
 */
export function buildDomainProcessBindingXml(record: DomainProcessBindingXmlFields, meta: { label: string }): string {
  return buildCustomMetadataXml(meta.label, buildValuesXml(domainProcessBindingValueEntries(record)));
}

/**
 * Patches an existing `DomainProcessBinding__mdt` `.md-meta.xml` document in place: only the fields
 * that actually changed between `existing` and `merged` get their `<values>` entry touched, and
 * `<label>` only if it changed — every other byte (untouched fields' exact markup, field order,
 * indentation, comments) passes through unmodified. `updateDomainProcessBinding`'s local-file write
 * path — see docs/design/0022-at4dx-update-xml-shape-preservation.md.
 *
 * @param existingXml - The file's current contents.
 * @param existing - The record as scanned, before this update's changes.
 * @param merged - The record after this update's changes are merged in.
 * @param meta - Presentation-only metadata not read back by any scanner.
 * @returns The patched document text.
 * @throws {UnpatchableValueShapeError} See `patchCustomMetadataXml`.
 */
export function patchDomainProcessBindingXml(
  existingXml: string,
  existing: DomainProcessBindingXmlFields,
  merged: DomainProcessBindingXmlFields,
  meta: { label: string },
): string {
  const changedEntries = diffValueEntries(
    domainProcessBindingValueEntries(existing),
    domainProcessBindingValueEntries(merged),
  );
  return patchCustomMetadataXml(existingXml, meta.label, changedEntries);
}
