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
 * Groups records by the (SObject, process context, trigger operation/domain method token) scope
 * AT4DX evaluates together — this is the unit the resolved table displays as one ordered sequence,
 * Criteria and Action interleaved.
 */
function scopeKey(record: RawDomainProcessBindingRecord): string {
  return [record.sobject, record.processContext, record.triggerOperation ?? record.domainMethodToken ?? ''].join(' ');
}

/**
 * Groups records by the same scope as {@link scopeKey} plus `type`, matching AT4DX's
 * `DomainProcessCoordinator` map, which keys `Criteria` and `Action` records separately. Used only
 * for collision detection: a Criteria and an Action sharing the same `OrderOfExecution__c` — a
 * normal, common configuration — never contend for the same slot and must not be flagged as a
 * collision, even though they're displayed side by side.
 */
function collisionKey(record: RawDomainProcessBindingRecord): string {
  return [scopeKey(record), record.type].join(' ');
}

/**
 * Resolve raw `DomainProcessBinding__mdt` records into rows sorted by execution order within each
 * (SObject, process context, trigger operation/domain method token) scope, flagging `orderCollision`
 * where AT4DX itself doesn't guarantee a deterministic tiebreak.
 *
 * Unlike Application Factory bindings, there's no "winner" here — every active record in a scope
 * runs, in `OrderOfExecution__c` order. Within a scope, rows are sorted by `order` ascending and, for
 * a Criteria and an Action sharing an `order`, Criteria first — a human reading the table wants to see
 * everything gating a sequence before the actions that sequence runs, not an arbitrary interleaving.
 * That display ordering is independent of collision detection: two *active* records of the *same
 * type* sharing an order within a scope is the one thing worth flagging, since AT4DX's Custom
 * Metadata query has no `ORDER BY` tiebreak for equal order values within a type, so which one
 * actually runs first isn't something this command can determine (the same "flag it, don't guess"
 * precedent `at4dxResolve.ts` applies to ambiguous Domain bindings). A Criteria and an Action sharing
 * an order never collide, since AT4DX's runtime map keys them separately. Inactive records never
 * contribute to a collision, since AT4DX skips them entirely.
 *
 * @param records - The raw binding records to resolve, as returned by `scanOrgDomainProcessBindings`/`scanLocalDomainProcessBindings`.
 * @returns The resolved rows, grouped in first-seen order, sorted by `order` ascending (Criteria before Action on a tie) within each group.
 */
export function resolveDomainProcessBindings(records: RawDomainProcessBindingRecord[]): DomainProcessBindingRow[] {
  const byScope = new Map<string, RawDomainProcessBindingRecord[]>();
  for (const record of records) {
    const key = scopeKey(record);
    const group = byScope.get(key) ?? [];
    group.push(record);
    byScope.set(key, group);
  }

  const rows: DomainProcessBindingRow[] = [];

  for (const group of byScope.values()) {
    const activeOrderCounts = new Map<string, number>();
    for (const record of group) {
      if (record.isActive) {
        const key = collisionKey(record);
        activeOrderCounts.set(key, (activeOrderCounts.get(key) ?? 0) + 1);
      }
    }

    const sorted = [...group].sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.type === b.type ? 0 : a.type === 'Criteria' ? -1 : 1;
    });

    for (const record of sorted) {
      const orderCollision = record.isActive && (activeOrderCounts.get(collisionKey(record)) ?? 0) > 1;
      rows.push({ ...record, ...(orderCollision ? { orderCollision: true } : {}) });
    }
  }

  return rows;
}
