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

import type { RawBindingRecord, WritableBindingType } from './at4dxBindingTypes.js';
import {
  buildCustomMetadataXml,
  buildValuesXml,
  diffValueEntries,
  patchCustomMetadataXml,
  type CustomMetadataValueInput,
} from './customMetadataXml.js';

export type BindingXmlFields = Pick<RawBindingRecord, 'key' | 'keyField' | 'to' | 'priority' | 'sequence'> & {
  bindingType: WritableBindingType;
};

/**
 * The `<values>` entries for a binding record — the single source of truth `buildBindingXml`
 * (a full document) and `patchBindingXml` (an in-place patch) both build on, so they can never
 * disagree on field order/type. Branches on `bindingType` for which fields exist at all: Service has
 * `BindingInterface__c` and no SObject reference; Selector has both SObject-reference fields and
 * `Priority__c`; Domain has both SObject-reference fields but no `Priority__c`; UnitOfWork has both
 * SObject-reference fields and `BindingSequence__c`, but no `To__c`/`Priority__c` at all — see
 * docs/design/0017-at4dx-binding-unit-of-work-write-support.md for the confirmed schema.
 *
 * Like `domainProcessBindingValueEntries`, always includes both `BindingSObject__c` and
 * `BindingSObjectAlternate__c` for Selector/Domain/UnitOfWork — exactly one populated per
 * `record.keyField`, the other explicitly `xsi:nil`, so a re-scan never sees both fields set (which
 * `validateBindings` flags as `ambiguous-sobject-reference`).
 */
export function bindingValueEntries(record: BindingXmlFields): CustomMetadataValueInput[] {
  const entries: CustomMetadataValueInput[] = [];

  if (record.bindingType === 'Service') {
    entries.push({ field: 'BindingInterface__c', value: record.key });
  } else {
    entries.push(
      { field: 'BindingSObject__c', value: record.keyField === 'primary' ? record.key : undefined },
      { field: 'BindingSObjectAlternate__c', value: record.keyField === 'alternate' ? record.key : undefined },
    );
  }

  if (record.bindingType === 'UnitOfWork') {
    entries.push({
      field: 'BindingSequence__c',
      value: record.sequence === undefined ? undefined : String(record.sequence),
      type: 'double',
    });
  } else {
    entries.push({ field: 'To__c', value: record.to });

    if (record.bindingType !== 'Domain') {
      entries.push({
        field: 'Priority__c',
        value: record.priority === undefined ? undefined : String(record.priority),
        type: 'double',
      });
    }
  }

  return entries;
}

/**
 * Builds a full `.md-meta.xml` document for an Application Factory binding record — the write-side
 * counterpart to `scanLocalBindings`'s parsing, byte-shape-compatible with it (a re-scan of this
 * output reproduces `record`). `DeveloperName` isn't part of the body — it's carried by the file name
 * (`<LocalObjectName>.<DeveloperName>.md-meta.xml`), not this function's concern. Used by
 * `createBinding`, and by `updateBinding` when there's no existing local file to preserve the shape
 * of (an org-only update) — see `patchBindingXml` for the local-file case.
 *
 * @param record - The field values to serialize.
 * @param meta - Presentation-only metadata not read back by any scanner.
 * @returns The full XML document text, ready to write to a `.md-meta.xml` file.
 */
export function buildBindingXml(record: BindingXmlFields, meta: { label: string }): string {
  return buildCustomMetadataXml(meta.label, buildValuesXml(bindingValueEntries(record)));
}

/**
 * Patches an existing binding `.md-meta.xml` document in place: only the fields that actually
 * changed between `existing` and `merged` get their `<values>` entry touched, and `<label>` only if
 * it changed — every other byte (untouched fields' exact markup, field order, indentation, comments)
 * passes through unmodified. `updateBinding`'s local-file write path — see
 * docs/design/0022-at4dx-update-xml-shape-preservation.md.
 *
 * @param existingXml - The file's current contents.
 * @param existing - The record as scanned, before this update's changes.
 * @param merged - The record after this update's changes are merged in.
 * @param meta - Presentation-only metadata not read back by any scanner.
 * @returns The patched document text.
 * @throws {UnpatchableValueShapeError} See `patchCustomMetadataXml`.
 */
export function patchBindingXml(
  existingXml: string,
  existing: BindingXmlFields,
  merged: BindingXmlFields,
  meta: { label: string },
): string {
  const changedEntries = diffValueEntries(bindingValueEntries(existing), bindingValueEntries(merged));
  return patchCustomMetadataXml(existingXml, meta.label, changedEntries);
}
