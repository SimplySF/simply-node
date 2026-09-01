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

import type { RawFieldSetInclusionRecord } from './at4dxFieldSetInclusionTypes.js';
import {
  buildCustomMetadataXml,
  buildValuesXml,
  diffValueEntries,
  patchCustomMetadataXml,
  type CustomMetadataValueInput,
} from './customMetadataXml.js';

export type FieldSetInclusionXmlFields = Pick<
  RawFieldSetInclusionRecord,
  'sobject' | 'sobjectField' | 'fieldsetName' | 'isActive'
>;

/**
 * The `<values>` entries for a `SelectorConfig_FieldSetInclusion__mdt` record — the single source of
 * truth `buildFieldSetInclusionXml` (a full document) and `patchFieldSetInclusionXml` (an in-place
 * patch) both build on, so they can never disagree on field order/type.
 *
 * Like `bindingValueEntries`, always includes both `BindingSObject__c` and
 * `BindingSObjectAlternate__c` — exactly one populated per `record.sobjectField`, the other
 * explicitly `xsi:nil`, so a re-scan never sees both fields set (which `validateFieldSetInclusions`
 * flags as `ambiguous-sobject-reference`).
 */
export function fieldSetInclusionValueEntries(record: FieldSetInclusionXmlFields): CustomMetadataValueInput[] {
  return [
    {
      field: 'BindingSObject__c',
      value: record.sobjectField === 'primary' ? record.sobject : undefined,
    },
    {
      field: 'BindingSObjectAlternate__c',
      value: record.sobjectField === 'alternate' ? record.sobject : undefined,
    },
    { field: 'FieldsetName__c', value: record.fieldsetName },
    { field: 'IsActive__c', value: String(record.isActive), type: 'boolean' },
  ];
}

/**
 * Builds a full `.md-meta.xml` document for a `SelectorConfig_FieldSetInclusion__mdt` record — the
 * write-side counterpart to `scanLocalFieldSetInclusions`'s parsing, byte-shape-compatible with it (a
 * re-scan of this output reproduces `record`). `DeveloperName` isn't part of the body — like every
 * other `CustomMetadata` component, it's carried by the file name
 * (`SelectorConfig_FieldSetInclusion.<DeveloperName>.md-meta.xml`), not this function's concern. Used
 * by `createFieldSetInclusion`, and by `updateFieldSetInclusion` when there's no existing local file
 * to preserve the shape of (an org-only update) — see `patchFieldSetInclusionXml` for the local-file
 * case.
 *
 * @param record - The field values to serialize.
 * @param meta - Presentation-only metadata not read back by any scanner.
 * @returns The full XML document text, ready to write to a `.md-meta.xml` file.
 */
export function buildFieldSetInclusionXml(record: FieldSetInclusionXmlFields, meta: { label: string }): string {
  return buildCustomMetadataXml(meta.label, buildValuesXml(fieldSetInclusionValueEntries(record)));
}

/**
 * Patches an existing `SelectorConfig_FieldSetInclusion__mdt` `.md-meta.xml` document in place: only
 * the fields that actually changed between `existing` and `merged` get their `<values>` entry
 * touched, and `<label>` only if it changed — every other byte (untouched fields' exact markup, field
 * order, indentation, comments) passes through unmodified. `updateFieldSetInclusion`'s local-file
 * write path — see docs/design/0022-at4dx-update-xml-shape-preservation.md.
 *
 * @param existingXml - The file's current contents.
 * @param existing - The record as scanned, before this update's changes.
 * @param merged - The record after this update's changes are merged in.
 * @param meta - Presentation-only metadata not read back by any scanner.
 * @returns The patched document text.
 * @throws {UnpatchableValueShapeError} See `patchCustomMetadataXml`.
 */
export function patchFieldSetInclusionXml(
  existingXml: string,
  existing: FieldSetInclusionXmlFields,
  merged: FieldSetInclusionXmlFields,
  meta: { label: string },
): string {
  const changedEntries = diffValueEntries(
    fieldSetInclusionValueEntries(existing),
    fieldSetInclusionValueEntries(merged),
  );
  return patchCustomMetadataXml(existingXml, meta.label, changedEntries);
}
