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

import type { AepConnection } from './at4dxBindingTypes.js';
import {
  FIELD_SET_INCLUSION_OBJECT,
  type AmbiguousFieldSetInclusionRecord,
  type MalformedFieldSetInclusionRecord,
  type RawFieldSetInclusionRecord,
} from './at4dxFieldSetInclusionTypes.js';

/**
 * SOQL for `SelectorConfig_FieldSetInclusion__mdt`, including the `BindingSObject__r.QualifiedApiName`
 * relationship traversal — like `ApplicationFactory_*Binding__mdt`'s `BindingSObject__c`, this field
 * holds an EntityDefinition reference, not a usable API name, when read from an org (local source XML
 * stores the API name directly; see `at4dxFieldSetInclusionLocalScan.ts`).
 */
const SOQL = `SELECT DeveloperName, Label, BindingSObject__c, BindingSObject__r.QualifiedApiName, BindingSObjectAlternate__c, FieldsetName__c, IsActive__c FROM ${FIELD_SET_INCLUSION_OBJECT}`;

type OrgFieldSetInclusionRecord = {
  DeveloperName: string;
  Label: string;
  BindingSObject__c?: string | null;
  BindingSObject__r?: { QualifiedApiName?: string | null } | null;
  BindingSObjectAlternate__c?: string | null;
  FieldsetName__c: string;
  IsActive__c: boolean;
};

/** @returns The SObject API name, preferring `BindingSObject__c`'s resolved API name and falling back to `BindingSObjectAlternate__c`, matching the same fallback order `at4dxOrgScan.ts` uses. */
function resolveSObject(record: OrgFieldSetInclusionRecord): string | undefined {
  if (record.BindingSObject__c) {
    return record.BindingSObject__r?.QualifiedApiName ?? undefined;
  }
  return record.BindingSObjectAlternate__c ?? undefined;
}

/** @returns An `AmbiguousFieldSetInclusionRecord` if both SObject reference fields are set to different values, else `undefined`. */
function ambiguousSObject(
  record: OrgFieldSetInclusionRecord,
  sobject: string,
  source: string,
): AmbiguousFieldSetInclusionRecord | undefined {
  const alternate = record.BindingSObjectAlternate__c;
  if (record.BindingSObject__c && alternate && alternate !== sobject) {
    return { developerName: record.DeveloperName, sobject, alternateSobject: alternate, source };
  }
  return undefined;
}

/** @returns The normalized field set inclusion record for an already-resolved `sobject`. */
function toRawRecord(record: OrgFieldSetInclusionRecord, sobject: string, source: string): RawFieldSetInclusionRecord {
  return {
    developerName: record.DeveloperName,
    label: record.Label,
    sobject,
    sobjectField: record.BindingSObject__c ? 'primary' : 'alternate',
    fieldsetName: record.FieldsetName__c,
    isActive: record.IsActive__c,
    source,
  };
}

export type FieldSetInclusionOrgScanResult = {
  records: RawFieldSetInclusionRecord[];
  /** Records with neither SObject reference field set — excluded from `records`, see `MalformedFieldSetInclusionRecord`. */
  malformed: MalformedFieldSetInclusionRecord[];
  /** Records with both SObject reference fields set to different values — still included in `records`, see `AmbiguousFieldSetInclusionRecord`. */
  ambiguous: AmbiguousFieldSetInclusionRecord[];
  /** `true` when the `SelectorConfig_FieldSetInclusion__mdt` Custom Metadata Type doesn't exist in this org. */
  missing: boolean;
};

/**
 * Query the target org for AT4DX `SelectorConfig_FieldSetInclusion__mdt` records — an ordinary
 * queryable Custom Metadata Type, plain REST (`connection.autoFetchQuery`), no Tooling API, no
 * chunking (row counts are inherently small).
 *
 * @param connection - The org connection to query against.
 * @returns The discovered records, and whether the Custom Metadata Type exists in this org at all.
 */
export async function scanOrgFieldSetInclusions(connection: AepConnection): Promise<FieldSetInclusionOrgScanResult> {
  const source = connection.getUsername() ?? 'org';

  try {
    const result = await connection.autoFetchQuery(SOQL);
    const records: RawFieldSetInclusionRecord[] = [];
    const malformed: MalformedFieldSetInclusionRecord[] = [];
    const ambiguous: AmbiguousFieldSetInclusionRecord[] = [];

    for (const record of result.records as unknown as OrgFieldSetInclusionRecord[]) {
      const sobject = resolveSObject(record);
      if (!sobject) {
        malformed.push({ developerName: record.DeveloperName, source });
        continue;
      }

      const ambiguousRecord = ambiguousSObject(record, sobject, source);
      if (ambiguousRecord) {
        ambiguous.push(ambiguousRecord);
      }

      records.push(toRawRecord(record, sobject, source));
    }

    return { records, malformed, ambiguous, missing: false };
  } catch (error) {
    if ((error as Error).name === 'INVALID_TYPE') {
      return { records: [], malformed: [], ambiguous: [], missing: true };
    }
    throw error;
  }
}
