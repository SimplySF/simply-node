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
import { buildCustomMetadataXml, buildValuesXml, type CustomMetadataValueInput } from './customMetadataXml.js';

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
 * Builds a full `.md-meta.xml` document for a `DomainProcessBinding__mdt` record — the write-side
 * counterpart to `scanLocalDomainProcessBindings`'s parsing, byte-shape-compatible with it (a re-scan
 * of this output reproduces `record`).
 *
 * Always writes both `RelatedDomainBindingSObject__c` and `RelatedDomainBindingSObjectAlternate__c` —
 * exactly one populated per `record.sobjectField`, the other explicitly `xsi:nil`, so a re-scan never
 * sees both fields set (which `validateDomainProcessBindings` flags as `ambiguous-sobject-reference`).
 * `DeveloperName` isn't part of the body — like every other `CustomMetadata` component, it's carried by
 * the file name (`DomainProcessBinding.<DeveloperName>.md-meta.xml`), not this function's concern.
 *
 * @param record - The field values to serialize.
 * @param meta - Presentation-only metadata not read back by any scanner.
 * @returns The full XML document text, ready to write to a `.md-meta.xml` file.
 */
export function buildDomainProcessBindingXml(record: DomainProcessBindingXmlFields, meta: { label: string }): string {
  const entries: CustomMetadataValueInput[] = [
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

  return buildCustomMetadataXml(meta.label, buildValuesXml(entries));
}
