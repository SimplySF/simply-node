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

import {
  AT4DX_BINDING_OBJECTS,
  type AepConnection,
  type AmbiguousBindingRecord,
  type BindingType,
  type MalformedBindingRecord,
  type RawBindingRecord,
} from './at4dxBindingTypes.js';

/** The shape of a single query result record, across all four binding objects. Unused columns for a given type are simply absent. */
type OrgBindingRecord = {
  DeveloperName: string;
  Label: string;
  To__c?: string | null;
  Priority__c?: number | null;
  BindingInterface__c?: string | null;
  BindingSequence__c?: number | null;
  BindingSObject__c?: string | null;
  BindingSObject__r?: { QualifiedApiName?: string | null } | null;
  BindingSObjectAlternate__c?: string | null;
};

/**
 * SOQL per binding type, mirroring the exact queries AT4DX's own `di_Module` subclasses run
 * (`ApplicationServiceDIModule`, `ApplicationSObjectSelectorDIModule`,
 * `ApplicationSObjectDomainDIModule`, `ApplicationSObjectUnitOfWorkDIProvider`) — including the
 * `BindingSObject__r.QualifiedApiName` relationship traversal, since `BindingSObject__c` alone
 * holds an EntityDefinition reference, not a usable API name.
 */
const SOQL_BY_TYPE: Record<BindingType, string> = {
  Service: `SELECT DeveloperName, Label, To__c, BindingInterface__c, Priority__c FROM ${AT4DX_BINDING_OBJECTS.Service}`,
  Selector: `SELECT DeveloperName, Label, To__c, BindingSObject__c, BindingSObject__r.QualifiedApiName, BindingSObjectAlternate__c, Priority__c FROM ${AT4DX_BINDING_OBJECTS.Selector}`,
  Domain: `SELECT DeveloperName, Label, To__c, BindingSObject__c, BindingSObject__r.QualifiedApiName, BindingSObjectAlternate__c FROM ${AT4DX_BINDING_OBJECTS.Domain}`,
  UnitOfWork: `SELECT DeveloperName, Label, BindingSequence__c, BindingSObject__c, BindingSObject__r.QualifiedApiName, BindingSObjectAlternate__c FROM ${AT4DX_BINDING_OBJECTS.UnitOfWork}`,
};

/** @returns The SObject key for a Selector/Domain/UnitOfWork record, preferring `BindingSObject__c`'s resolved API name and falling back to `BindingSObjectAlternate__c`, matching AT4DX's own fallback order. */
function resolveSObjectKey(record: OrgBindingRecord): string | undefined {
  if (record.BindingSObject__c) {
    return record.BindingSObject__r?.QualifiedApiName ?? undefined;
  }
  return record.BindingSObjectAlternate__c ?? undefined;
}

/** @returns An `AmbiguousBindingRecord` if both SObject reference fields are set to different values, else `undefined`. */
function ambiguousKey(
  bindingType: BindingType,
  record: OrgBindingRecord,
  key: string,
  source: string,
): AmbiguousBindingRecord | undefined {
  const alternate = record.BindingSObjectAlternate__c;
  if (record.BindingSObject__c && alternate && alternate !== key) {
    return { bindingType, developerName: record.DeveloperName, key, alternateKey: alternate, source };
  }
  return undefined;
}

/** @returns The normalized binding record for an already-resolved `key`. */
function toRawRecord(
  bindingType: BindingType,
  record: OrgBindingRecord,
  key: string,
  source: string,
): RawBindingRecord {
  return {
    bindingType,
    developerName: record.DeveloperName,
    label: record.Label,
    key,
    keyField: bindingType === 'Service' ? undefined : record.BindingSObject__c ? 'primary' : 'alternate',
    to: record.To__c ?? undefined,
    priority: record.Priority__c ?? undefined,
    sequence: record.BindingSequence__c ?? undefined,
    source,
  };
}

export type OrgScanResult = {
  records: RawBindingRecord[];
  /** Records with no resolvable key. Excluded from `records`, see `MalformedBindingRecord`. */
  malformed: MalformedBindingRecord[];
  /** Selector/Domain/UnitOfWork records with both SObject reference fields set to different values. Still included in `records`, see `AmbiguousBindingRecord`. */
  ambiguous: AmbiguousBindingRecord[];
  /** Binding types whose query failed with `INVALID_TYPE` — the Custom Metadata Type doesn't exist in this org. */
  missingTypes: BindingType[];
};

/**
 * Query the target org for AT4DX Application Factory bindings, one SOQL query per requested
 * binding type, run in parallel. These are ordinary queryable Custom Metadata records — plain
 * REST (`connection.autoFetchQuery`), no Tooling API, no chunking (row counts are inherently
 * small).
 *
 * A type whose Custom Metadata Type doesn't exist in this org fails with `INVALID_TYPE`; that's
 * reported via `missingTypes` rather than thrown, so the caller can distinguish "AT4DX isn't here
 * at all" from "AT4DX is here, this type just has no records configured yet."
 *
 * @param connection - The org connection to query against.
 * @param types - Which binding types to query for.
 * @returns The discovered bindings, diagnostics, and which requested types don't exist in this org.
 */
export async function scanOrgBindings(connection: AepConnection, types: BindingType[]): Promise<OrgScanResult> {
  const source = connection.getUsername() ?? 'org';
  const missingTypes: BindingType[] = [];

  const perType = await Promise.all(
    types.map(async (bindingType) => {
      const records: RawBindingRecord[] = [];
      const malformed: MalformedBindingRecord[] = [];
      const ambiguous: AmbiguousBindingRecord[] = [];

      try {
        const result = await connection.autoFetchQuery(SOQL_BY_TYPE[bindingType]);
        for (const record of result.records as unknown as OrgBindingRecord[]) {
          const key = bindingType === 'Service' ? (record.BindingInterface__c ?? undefined) : resolveSObjectKey(record);

          if (!key) {
            malformed.push({ bindingType, developerName: record.DeveloperName, source });
            continue;
          }

          const ambiguousRecord =
            bindingType === 'Service' ? undefined : ambiguousKey(bindingType, record, key, source);
          if (ambiguousRecord) {
            ambiguous.push(ambiguousRecord);
          }

          records.push(toRawRecord(bindingType, record, key, source));
        }
      } catch (error) {
        if ((error as Error).name === 'INVALID_TYPE') {
          missingTypes.push(bindingType);
        } else {
          throw error;
        }
      }

      return { records, malformed, ambiguous };
    }),
  );

  return {
    records: perType.flatMap((result) => result.records),
    malformed: perType.flatMap((result) => result.malformed),
    ambiguous: perType.flatMap((result) => result.ambiguous),
    missingTypes,
  };
}
