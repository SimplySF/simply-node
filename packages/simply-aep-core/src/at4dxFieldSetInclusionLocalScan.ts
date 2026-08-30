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
  FIELD_SET_INCLUSION_LOCAL_OBJECT_NAME,
  type AmbiguousFieldSetInclusionRecord,
  type MalformedFieldSetInclusionRecord,
  type RawFieldSetInclusionRecord,
} from './at4dxFieldSetInclusionTypes.js';
import { extractValues, fieldValue, toBoolean, type CustomMetadataXml } from './customMetadataXml.js';

export type FieldSetInclusionLocalScanResult = {
  records: RawFieldSetInclusionRecord[];
  /** Records with neither SObject reference field set — excluded from `records`, see `MalformedFieldSetInclusionRecord`. */
  malformed: MalformedFieldSetInclusionRecord[];
  /** Records with both SObject reference fields set to different values — still included in `records`, see `AmbiguousFieldSetInclusionRecord`. */
  ambiguous: AmbiguousFieldSetInclusionRecord[];
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

export type LocalFieldSetInclusionScanEntry =
  | { kind: 'record'; value: RawFieldSetInclusionRecord }
  | { kind: 'malformed'; value: MalformedFieldSetInclusionRecord };

/** @returns The normalized field set inclusion record for one `SelectorConfig_FieldSetInclusion.*` `CustomMetadata` component, tagged `malformed` if it has no resolvable SObject, plus the ambiguous-SObject diagnostic when both reference fields are set to different values. */
function toRawRecord(
  component: SourceComponent,
  developerName: string,
): { entry: LocalFieldSetInclusionScanEntry; ambiguous?: AmbiguousFieldSetInclusionRecord } {
  const xml = component.parseXmlSync<CustomMetadataXml>();
  const values = extractValues(xml);
  const source = deriveProjectName(component.xml);
  const filePath = component.xml;

  const primarySObject = fieldValue(values, 'BindingSObject__c');
  const alternateSObject = fieldValue(values, 'BindingSObjectAlternate__c');
  const sobject = primarySObject ?? alternateSObject;

  if (!sobject) {
    return { entry: { kind: 'malformed', value: { developerName, source, filePath } } };
  }

  const ambiguous: AmbiguousFieldSetInclusionRecord | undefined =
    primarySObject && alternateSObject && primarySObject !== alternateSObject
      ? { developerName, sobject: primarySObject, alternateSobject: alternateSObject, source, filePath }
      : undefined;

  return {
    entry: {
      kind: 'record',
      value: {
        developerName,
        label: xml.CustomMetadata?.label ?? developerName,
        sobject,
        sobjectField: primarySObject ? 'primary' : 'alternate',
        fieldsetName: fieldValue(values, 'FieldsetName__c') ?? '',
        isActive: toBoolean(fieldValue(values, 'IsActive__c'), true),
        source,
        filePath,
      },
    },
    ambiguous,
  };
}

/**
 * Scan local Salesforce DX source directories for AT4DX `SelectorConfig_FieldSetInclusion__mdt`
 * records, parsing each `CustomMetadata` component's `<values>` pairs directly — the same approach
 * `at4dxLocalScan.ts`/`at4dxDomainProcessLocalScan.ts` use.
 *
 * Unlike an org (see `at4dxFieldSetInclusionOrgScan.ts`), local source gives no signal for "this Custom
 * Metadata Type doesn't exist" independent of "zero records exist for it" — a missing `customMetadata`
 * folder and an empty one look identical to `ComponentSet.fromSource`. Callers treat an empty result as
 * "AT4DX isn't configured here."
 *
 * @param sourceDirs - The source directories to scan.
 * @returns The discovered records, plus the malformed/ambiguous diagnostics `validateFieldSetInclusions` consumes.
 */
export function scanLocalFieldSetInclusions(sourceDirs: string[]): FieldSetInclusionLocalScanResult {
  const records: RawFieldSetInclusionRecord[] = [];
  const malformed: MalformedFieldSetInclusionRecord[] = [];
  const ambiguous: AmbiguousFieldSetInclusionRecord[] = [];

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
    if (localObjectName !== FIELD_SET_INCLUSION_LOCAL_OBJECT_NAME) {
      continue;
    }
    const developerName = component.name.slice(separatorIndex + 1);

    const { entry, ambiguous: ambiguousRecord } = toRawRecord(component, developerName);
    if (entry.kind === 'record') {
      records.push(entry.value);
    } else {
      malformed.push(entry.value);
    }
    if (ambiguousRecord) {
      ambiguous.push(ambiguousRecord);
    }
  }

  return { records, malformed, ambiguous };
}
