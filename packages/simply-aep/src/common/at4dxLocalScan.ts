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
import { bindingTypeForLocalObjectName, type BindingType, type RawBindingRecord } from './at4dxBindingTypes.js';
import { extractValues, fieldValue, toNumber, type CustomMetadataXml } from './customMetadataXml.js';

/**
 * @returns The source-format package/project directory name a metadata file belongs to (the
 * directory containing `customMetadata`) — the same convention `simply schema visualize` uses for
 * `objects`.
 */
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

/** @returns The normalized binding record for one `CustomMetadata` component, or `undefined` if it has no resolvable key. */
function toRawRecord(
  bindingType: BindingType,
  component: SourceComponent,
  developerName: string,
): RawBindingRecord | undefined {
  const xml = component.parseXmlSync<CustomMetadataXml>();
  const values = extractValues(xml);

  const bindingSObject = fieldValue(values, 'BindingSObject__c');
  const bindingSObjectAlternate = fieldValue(values, 'BindingSObjectAlternate__c');
  const key =
    bindingType === 'Service' ? fieldValue(values, 'BindingInterface__c') : (bindingSObject ?? bindingSObjectAlternate);

  if (!key) {
    return undefined;
  }

  return {
    bindingType,
    developerName,
    key,
    to: fieldValue(values, 'To__c'),
    priority: toNumber(fieldValue(values, 'Priority__c')),
    sequence: toNumber(fieldValue(values, 'BindingSequence__c')),
    source: deriveProjectName(component.xml),
  };
}

/**
 * Scan local Salesforce DX source directories for AT4DX Application Factory binding records,
 * parsing each `CustomMetadata` component's `<values>` pairs directly — the same "read the
 * metadata XML" approach `simply schema visualize`'s local scan uses for `CustomField`/
 * `CustomObject`.
 *
 * Unlike an org (see `at4dxOrgScan`), local source gives no signal for "this Custom Metadata Type
 * doesn't exist" independent of "zero records exist for it" — a missing `customMetadata` folder
 * and an empty one look identical to `ComponentSet.fromSource`. Callers treat a fully empty result
 * across every requested type as "AT4DX not detected here."
 *
 * @param sourceDirs - The source directories to scan.
 * @param types - Which binding types to include.
 * @returns The discovered bindings.
 */
export function scanLocalBindings(sourceDirs: string[], types: BindingType[]): RawBindingRecord[] {
  const requestedTypes = new Set(types);
  const records: RawBindingRecord[] = [];

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
    const developerName = component.name.slice(separatorIndex + 1);

    const bindingType = bindingTypeForLocalObjectName(localObjectName);
    if (!bindingType || !requestedTypes.has(bindingType)) {
      continue;
    }

    const record = toRawRecord(bindingType, component, developerName);
    if (record) {
      records.push(record);
    }
  }

  return records;
}
