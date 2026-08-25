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

import type { DomainProcessBindingRow, RawDomainProcessBindingRecord } from './at4dxDomainProcessBindingTypes.js';

/**
 * Groups records by the same (SObject, process context, trigger operation/domain method token, type)
 * scope AT4DX's `DomainProcessCoordinator` map contends over. `type` matters: AT4DX's runtime map keys
 * `Criteria` and `Action` records separately, so a Criteria and an Action sharing the same
 * `OrderOfExecution__c` — a normal, common configuration — never contend for the same slot and must
 * not be flagged as a collision.
 */
function groupKey(record: RawDomainProcessBindingRecord): string {
  return [
    record.sobject,
    record.processContext,
    record.triggerOperation ?? record.domainMethodToken ?? '',
    record.type,
  ].join(' ');
}

/**
 * Resolve raw `DomainProcessBinding__mdt` records into rows sorted by execution order within each
 * (SObject, process context, trigger operation/domain method token, type) group, flagging
 * `orderCollision` where AT4DX itself doesn't guarantee a deterministic tiebreak.
 *
 * Unlike Application Factory bindings, there's no "winner" here — every active record in a group
 * runs, in `OrderOfExecution__c` order. Two *active* records sharing the same order within a group is
 * the one thing worth flagging: AT4DX's Custom Metadata query has no `ORDER BY` tiebreak for equal
 * order values, so which one actually runs first isn't something this command can determine (the same
 * "flag it, don't guess" precedent `at4dxResolve.ts` applies to ambiguous Domain bindings). Inactive
 * records never contribute to a collision, since AT4DX skips them entirely.
 *
 * @param records - The raw binding records to resolve, as returned by `scanOrgDomainProcessBindings`/`scanLocalDomainProcessBindings`.
 * @returns The resolved rows, grouped in first-seen order, sorted by `order` ascending within each group.
 */
export function resolveDomainProcessBindings(records: RawDomainProcessBindingRecord[]): DomainProcessBindingRow[] {
  const byGroup = new Map<string, RawDomainProcessBindingRecord[]>();
  for (const record of records) {
    const key = groupKey(record);
    const group = byGroup.get(key) ?? [];
    group.push(record);
    byGroup.set(key, group);
  }

  const rows: DomainProcessBindingRow[] = [];

  for (const group of byGroup.values()) {
    const activeOrderCounts = new Map<number, number>();
    for (const record of group) {
      if (record.isActive) {
        activeOrderCounts.set(record.order, (activeOrderCounts.get(record.order) ?? 0) + 1);
      }
    }

    const sorted = [...group].sort((a, b) => a.order - b.order);
    for (const record of sorted) {
      const orderCollision = record.isActive && (activeOrderCounts.get(record.order) ?? 0) > 1;
      rows.push({ ...record, ...(orderCollision ? { orderCollision: true } : {}) });
    }
  }

  return rows;
}
