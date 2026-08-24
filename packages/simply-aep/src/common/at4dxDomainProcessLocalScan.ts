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
  DOMAIN_PROCESS_BINDING_LOCAL_OBJECT_NAME,
  type DomainProcessType,
  type ProcessContext,
  type RawDomainProcessBindingRecord,
  type TriggerOperation,
} from './at4dxDomainProcessBindingTypes.js';
import { extractValues, fieldValue, toBoolean, toNumber, type CustomMetadataXml } from './customMetadataXml.js';

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

/** @returns The normalized binding record for one `DomainProcessBinding.*` `CustomMetadata` component, or `undefined` if it has no resolvable SObject. */
function toRawRecord(component: SourceComponent, developerName: string): RawDomainProcessBindingRecord | undefined {
  const xml = component.parseXmlSync<CustomMetadataXml>();
  const values = extractValues(xml);

  const sobject =
    fieldValue(values, 'RelatedDomainBindingSObject__c') ??
    fieldValue(values, 'RelatedDomainBindingSObjectAlternate__c');
  if (!sobject) {
    return undefined;
  }

  return {
    developerName,
    sobject,
    processContext: fieldValue(values, 'ProcessContext__c') as ProcessContext,
    triggerOperation: fieldValue(values, 'TriggerOperation__c') as TriggerOperation | undefined,
    domainMethodToken: fieldValue(values, 'DomainMethodToken__c'),
    type: fieldValue(values, 'Type__c') as DomainProcessType,
    classToInject: fieldValue(values, 'ClassToInject__c') ?? '',
    order: toNumber(fieldValue(values, 'OrderOfExecution__c')) ?? 0,
    isActive: toBoolean(fieldValue(values, 'IsActive__c'), true),
    executeAsynchronous: toBoolean(fieldValue(values, 'ExecuteAsynchronous__c'), false),
    logicalInverse: toBoolean(fieldValue(values, 'LogicalInverse__c'), false),
    preventRecursive: toBoolean(fieldValue(values, 'PreventRecursive__c'), false),
    description: fieldValue(values, 'Description__c'),
    source: deriveProjectName(component.xml),
  };
}

/**
 * Scan local Salesforce DX source directories for AT4DX `DomainProcessBinding__mdt` records, parsing
 * each `CustomMetadata` component's `<values>` pairs directly — the same approach `at4dxLocalScan.ts`
 * uses for Application Factory bindings.
 *
 * Unlike an org (see `at4dxDomainProcessOrgScan.ts`), local source gives no signal for "this Custom
 * Metadata Type doesn't exist" independent of "zero records exist for it" — a missing
 * `customMetadata` folder and an empty one look identical to `ComponentSet.fromSource`. Callers treat
 * an empty result as "AT4DX's Trigger Action Framework isn't configured here."
 *
 * @param sourceDirs - The source directories to scan.
 * @returns The discovered bindings.
 */
export function scanLocalDomainProcessBindings(sourceDirs: string[]): RawDomainProcessBindingRecord[] {
  const records: RawDomainProcessBindingRecord[] = [];

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
    if (localObjectName !== DOMAIN_PROCESS_BINDING_LOCAL_OBJECT_NAME) {
      continue;
    }
    const developerName = component.name.slice(separatorIndex + 1);

    const record = toRawRecord(component, developerName);
    if (record) {
      records.push(record);
    }
  }

  return records;
}
