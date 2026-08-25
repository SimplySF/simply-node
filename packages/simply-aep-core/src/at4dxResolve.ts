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
  ALL_BINDING_TYPES,
  type At4dxBindingRow,
  type BindingType,
  type RawBindingRecord,
} from './at4dxBindingTypes.js';

/**
 * Resolve one binding type's records, keyed by `record.key`.
 *
 * **UnitOfWork** has no winner concept at all: `ApplicationSObjectUnitOfWorkDIProvider` builds one
 * ordered SObjectType list for the shared Unit of Work, ordered by `BindingSequence__c` ascending
 * (nulls last, SOQL's default). Every record contributes.
 *
 * **Domain** has no `Priority__c` field and no `ORDER BY` in AT4DX's query — a key with more than
 * one record resolves in an org-defined order this command can't predict, so every record for that
 * key is flagged `ambiguous` rather than one being asserted as the winner.
 *
 * **Service/Selector** resolve deterministically: AT4DX orders its query
 * `Priority__c DESC NULLS FIRST` and overwrites a map keyed by the binding key, so the
 * *highest*-priority record (nulls treated as lowest) is written last and wins.
 */
function resolveByType(bindingType: BindingType, records: RawBindingRecord[]): At4dxBindingRow[] {
  if (bindingType === 'UnitOfWork') {
    return [...records]
      .sort((a, b) => (a.sequence ?? Number.POSITIVE_INFINITY) - (b.sequence ?? Number.POSITIVE_INFINITY))
      .map((record) => ({ ...record, effective: true }));
  }

  const byKey = new Map<string, RawBindingRecord[]>();
  for (const record of records) {
    const group = byKey.get(record.key) ?? [];
    group.push(record);
    byKey.set(record.key, group);
  }

  const rows: At4dxBindingRow[] = [];

  for (const group of byKey.values()) {
    if (bindingType === 'Domain') {
      const isAmbiguous = group.length > 1;
      for (const record of group) {
        rows.push({ ...record, effective: !isAmbiguous, ...(isAmbiguous ? { ambiguous: true } : {}) });
      }
      continue;
    }

    // Service/Selector: the record with the highest Priority__c wins; undefined/null sorts lowest.
    // A genuine tie is exactly as indeterminate here as it is in AT4DX's own map-overwrite (see
    // ApplicationServiceDIModule's `prioritizeBindings` comment) — this picks the last record
    // encountered among the tied maximum, which is as valid a choice as any other.
    let winner = group[0];
    for (const record of group) {
      if ((record.priority ?? Number.NEGATIVE_INFINITY) >= (winner.priority ?? Number.NEGATIVE_INFINITY)) {
        winner = record;
      }
    }
    for (const record of group) {
      rows.push({ ...record, effective: record === winner });
    }
  }

  return rows;
}

/**
 * Resolve raw binding records into rows annotated with which one AT4DX actually resolves to for
 * each key, applying the per-binding-type rules documented on {@link resolveByType}.
 *
 * @param records - The raw binding records to resolve, as returned by `scanOrgBindings`/`scanLocalBindings`.
 * @returns The resolved rows, grouped by binding type in `ALL_BINDING_TYPES` order.
 */
export function resolveBindings(records: RawBindingRecord[]): At4dxBindingRow[] {
  const byType = new Map<BindingType, RawBindingRecord[]>();
  for (const record of records) {
    const group = byType.get(record.bindingType) ?? [];
    group.push(record);
    byType.set(record.bindingType, group);
  }

  const rows: At4dxBindingRow[] = [];
  for (const bindingType of ALL_BINDING_TYPES) {
    const typeRecords = byType.get(bindingType);
    if (typeRecords) {
      rows.push(...resolveByType(bindingType, typeRecords));
    }
  }

  return rows;
}
