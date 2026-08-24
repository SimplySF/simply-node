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

import { type Connection } from '@salesforce/core';
import { AT4DX_BINDING_OBJECTS, type BindingType, type RawBindingRecord } from './at4dxBindingTypes.js';

/** The shape of a single query result record, across all four binding objects. Unused columns for a given type are simply absent. */
type OrgBindingRecord = {
  DeveloperName: string;
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
  Service: `SELECT DeveloperName, To__c, BindingInterface__c, Priority__c FROM ${AT4DX_BINDING_OBJECTS.Service}`,
  Selector: `SELECT DeveloperName, To__c, BindingSObject__c, BindingSObject__r.QualifiedApiName, BindingSObjectAlternate__c, Priority__c FROM ${AT4DX_BINDING_OBJECTS.Selector}`,
  Domain: `SELECT DeveloperName, To__c, BindingSObject__c, BindingSObject__r.QualifiedApiName, BindingSObjectAlternate__c FROM ${AT4DX_BINDING_OBJECTS.Domain}`,
  UnitOfWork: `SELECT DeveloperName, BindingSequence__c, BindingSObject__c, BindingSObject__r.QualifiedApiName, BindingSObjectAlternate__c FROM ${AT4DX_BINDING_OBJECTS.UnitOfWork}`,
};

/** @returns The SObject key for a Selector/Domain/UnitOfWork record, preferring `BindingSObject__c`'s resolved API name and falling back to `BindingSObjectAlternate__c`, matching AT4DX's own fallback order. */
function resolveSObjectKey(record: OrgBindingRecord): string | undefined {
  if (record.BindingSObject__c) {
    return record.BindingSObject__r?.QualifiedApiName ?? undefined;
  }
  return record.BindingSObjectAlternate__c ?? undefined;
}

/** @returns The normalized binding record, or `undefined` if the record has no resolvable key (and so can't be bound to anything). */
function toRawRecord(bindingType: BindingType, record: OrgBindingRecord, source: string): RawBindingRecord | undefined {
  const key = bindingType === 'Service' ? (record.BindingInterface__c ?? undefined) : resolveSObjectKey(record);
  if (!key) {
    return undefined;
  }

  return {
    bindingType,
    developerName: record.DeveloperName,
    key,
    to: record.To__c ?? undefined,
    priority: record.Priority__c ?? undefined,
    sequence: record.BindingSequence__c ?? undefined,
    source,
  };
}

export type OrgScanResult = {
  records: RawBindingRecord[];
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
 * @returns The discovered bindings and which requested types don't exist in this org.
 */
export async function scanOrgBindings(connection: Connection, types: BindingType[]): Promise<OrgScanResult> {
  const source = connection.getUsername() ?? 'org';
  const missingTypes: BindingType[] = [];

  const perType = await Promise.all(
    types.map(async (bindingType): Promise<RawBindingRecord[]> => {
      try {
        const result = await connection.autoFetchQuery(SOQL_BY_TYPE[bindingType]);
        return (result.records as unknown as OrgBindingRecord[])
          .map((record) => toRawRecord(bindingType, record, source))
          .filter((record): record is RawBindingRecord => record !== undefined);
      } catch (error) {
        if ((error as Error).name === 'INVALID_TYPE') {
          missingTypes.push(bindingType);
          return [];
        }
        throw error;
      }
    }),
  );

  return { records: perType.flat(), missingTypes };
}
