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
import {
  DOMAIN_PROCESS_BINDING_OBJECT,
  type DomainProcessType,
  type ProcessContext,
  type RawDomainProcessBindingRecord,
  type TriggerOperation,
} from './at4dxDomainProcessBindingTypes.js';

/**
 * SOQL for `DomainProcessBinding__mdt`, including the `RelatedDomainBindingSObject__r.QualifiedApiName`
 * relationship traversal — like `ApplicationFactory_*Binding__mdt`'s `BindingSObject__c`, this field
 * holds an EntityDefinition reference, not a usable API name, when read from an org (local source XML
 * stores the API name directly; see `at4dxDomainProcessLocalScan.ts`).
 */
const SOQL = `SELECT DeveloperName, RelatedDomainBindingSObject__c, RelatedDomainBindingSObject__r.QualifiedApiName, RelatedDomainBindingSObjectAlternate__c, ProcessContext__c, TriggerOperation__c, DomainMethodToken__c, Type__c, ClassToInject__c, OrderOfExecution__c, IsActive__c, ExecuteAsynchronous__c, LogicalInverse__c, PreventRecursive__c, Description__c FROM ${DOMAIN_PROCESS_BINDING_OBJECT}`;

type OrgDomainProcessBindingRecord = {
  DeveloperName: string;
  RelatedDomainBindingSObject__c?: string | null;
  RelatedDomainBindingSObject__r?: { QualifiedApiName?: string | null } | null;
  RelatedDomainBindingSObjectAlternate__c?: string | null;
  ProcessContext__c: string;
  TriggerOperation__c?: string | null;
  DomainMethodToken__c?: string | null;
  Type__c: string;
  ClassToInject__c: string;
  OrderOfExecution__c: number;
  IsActive__c: boolean;
  ExecuteAsynchronous__c: boolean;
  LogicalInverse__c: boolean;
  PreventRecursive__c: boolean;
  Description__c?: string | null;
};

/** @returns The SObject API name, preferring `RelatedDomainBindingSObject__c`'s resolved API name and falling back to `RelatedDomainBindingSObjectAlternate__c`, matching the same fallback order `at4dxOrgScan.ts` uses for `BindingSObject__c`. */
function resolveSObject(record: OrgDomainProcessBindingRecord): string | undefined {
  if (record.RelatedDomainBindingSObject__c) {
    return record.RelatedDomainBindingSObject__r?.QualifiedApiName ?? undefined;
  }
  return record.RelatedDomainBindingSObjectAlternate__c ?? undefined;
}

/** @returns The normalized binding record, or `undefined` if the record has no resolvable SObject. */
function toRawRecord(record: OrgDomainProcessBindingRecord, source: string): RawDomainProcessBindingRecord | undefined {
  const sobject = resolveSObject(record);
  if (!sobject) {
    return undefined;
  }

  return {
    developerName: record.DeveloperName,
    sobject,
    processContext: record.ProcessContext__c as ProcessContext,
    triggerOperation: (record.TriggerOperation__c as TriggerOperation | null) ?? undefined,
    domainMethodToken: record.DomainMethodToken__c ?? undefined,
    type: record.Type__c as DomainProcessType,
    classToInject: record.ClassToInject__c,
    order: record.OrderOfExecution__c,
    isActive: record.IsActive__c,
    executeAsynchronous: record.ExecuteAsynchronous__c,
    logicalInverse: record.LogicalInverse__c,
    preventRecursive: record.PreventRecursive__c,
    description: record.Description__c ?? undefined,
    source,
  };
}

export type DomainProcessOrgScanResult = {
  records: RawDomainProcessBindingRecord[];
  /** `true` when the `DomainProcessBinding__mdt` Custom Metadata Type doesn't exist in this org. */
  missing: boolean;
};

/**
 * Query the target org for AT4DX `DomainProcessBinding__mdt` records — an ordinary queryable Custom
 * Metadata Type, plain REST (`connection.autoFetchQuery`), no Tooling API, no chunking (row counts
 * are inherently small).
 *
 * @param connection - The org connection to query against.
 * @returns The discovered bindings, and whether the Custom Metadata Type exists in this org at all.
 */
export async function scanOrgDomainProcessBindings(connection: Connection): Promise<DomainProcessOrgScanResult> {
  const source = connection.getUsername() ?? 'org';

  try {
    const result = await connection.autoFetchQuery(SOQL);
    const records = (result.records as unknown as OrgDomainProcessBindingRecord[])
      .map((record) => toRawRecord(record, source))
      .filter((record): record is RawDomainProcessBindingRecord => record !== undefined);
    return { records, missing: false };
  } catch (error) {
    if ((error as Error).name === 'INVALID_TYPE') {
      return { records: [], missing: true };
    }
    throw error;
  }
}
