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
import { buildCustomMetadataXml, buildValuesXml, type CustomMetadataValueInput } from './customMetadataXml.js';

export type BindingXmlFields = Pick<RawBindingRecord, 'key' | 'keyField' | 'to' | 'priority' | 'sequence'> & {
  bindingType: WritableBindingType;
};

/**
 * Builds a full `.md-meta.xml` document for an Application Factory binding record — the write-side
 * counterpart to `scanLocalBindings`'s parsing, byte-shape-compatible with it (a re-scan of this output
 * reproduces `record`). Branches on `bindingType` for which fields exist at all: Service has
 * `BindingInterface__c` and no SObject reference; Selector has both SObject-reference fields and
 * `Priority__c`; Domain has both SObject-reference fields but no `Priority__c`; UnitOfWork has both
 * SObject-reference fields and `BindingSequence__c`, but no `To__c`/`Priority__c` at all — see
 * docs/design/0017-at4dx-binding-unit-of-work-write-support.md for the confirmed schema.
 *
 * Like `buildDomainProcessBindingXml`, always writes both `BindingSObject__c` and
 * `BindingSObjectAlternate__c` for Selector/Domain/UnitOfWork — exactly one populated per
 * `record.keyField`, the other explicitly `xsi:nil`, so a re-scan never sees both fields set (which
 * `validateBindings` flags as `ambiguous-sobject-reference`). `DeveloperName` isn't part of the body —
 * it's carried by the file name (`<LocalObjectName>.<DeveloperName>.md-meta.xml`), not this function's
 * concern.
 *
 * @param record - The field values to serialize.
 * @param meta - Presentation-only metadata not read back by any scanner.
 * @returns The full XML document text, ready to write to a `.md-meta.xml` file.
 */
export function buildBindingXml(record: BindingXmlFields, meta: { label: string }): string {
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

  return buildCustomMetadataXml(meta.label, buildValuesXml(entries));
}
