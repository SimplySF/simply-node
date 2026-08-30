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
import { buildCustomMetadataXml, buildValuesXml, type CustomMetadataValueInput } from './customMetadataXml.js';

export type FieldSetInclusionXmlFields = Pick<
  RawFieldSetInclusionRecord,
  'sobject' | 'sobjectField' | 'fieldsetName' | 'isActive'
>;

/**
 * Builds a full `.md-meta.xml` document for a `SelectorConfig_FieldSetInclusion__mdt` record — the
 * write-side counterpart to `scanLocalFieldSetInclusions`'s parsing, byte-shape-compatible with it (a
 * re-scan of this output reproduces `record`).
 *
 * Always writes both `BindingSObject__c` and `BindingSObjectAlternate__c` — exactly one populated per
 * `record.sobjectField`, the other explicitly `xsi:nil`, so a re-scan never sees both fields set (which
 * `validateFieldSetInclusions` flags as `ambiguous-sobject-reference`). `DeveloperName` isn't part of
 * the body — like every other `CustomMetadata` component, it's carried by the file name
 * (`SelectorConfig_FieldSetInclusion.<DeveloperName>.md-meta.xml`), not this function's concern.
 *
 * @param record - The field values to serialize.
 * @param meta - Presentation-only metadata not read back by any scanner.
 * @returns The full XML document text, ready to write to a `.md-meta.xml` file.
 */
export function buildFieldSetInclusionXml(record: FieldSetInclusionXmlFields, meta: { label: string }): string {
  const entries: CustomMetadataValueInput[] = [
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

  return buildCustomMetadataXml(meta.label, buildValuesXml(entries));
}
