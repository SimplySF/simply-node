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

import type {
  AmbiguousDomainProcessBindingRecord,
  DomainProcessBindingIssue,
  DomainProcessBindingRow,
  MalformedDomainProcessBindingRecord,
  RawDomainProcessBindingRecord,
} from './at4dxDomainProcessBindingTypes.js';

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
        const key = `${collisionKey(record)} ${record.order}`;
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
      const orderCollision =
        record.isActive && (activeOrderCounts.get(`${collisionKey(record)} ${record.order}`) ?? 0) > 1;
      rows.push({ ...record, ...(orderCollision ? { orderCollision: true } : {}) });
    }
  }

  return rows;
}

/**
 * Validate a scan's `DomainProcessBinding__mdt` records for wiring problems `resolveDomainProcessBindings`/
 * `list` don't fail on: order collisions (reused from `resolveDomainProcessBindings`), records with no
 * resolvable SObject, bindings whose declared `processContext` doesn't match the field that's actually
 * populated (dead — never matches any real execution), duplicate `DeveloperName`s across everything
 * scanned, and an ambiguous SObject reference (both fields set to different values).
 *
 * See docs/design/0010-at4dx-domain-process-binding-validate.md for the full rationale behind each rule.
 *
 * @param records - The raw binding records to validate, as returned by `scanOrgDomainProcessBindings`/`scanLocalDomainProcessBindings`.
 * @param diagnostics - The `malformed`/`ambiguous` records the same scan reported alongside `records`.
 * @returns One issue per problem found. Empty when nothing's wrong.
 */
export function validateDomainProcessBindings(
  records: RawDomainProcessBindingRecord[],
  diagnostics: { malformed: MalformedDomainProcessBindingRecord[]; ambiguous: AmbiguousDomainProcessBindingRecord[] },
): DomainProcessBindingIssue[] {
  const issues: DomainProcessBindingIssue[] = [];

  for (const row of resolveDomainProcessBindings(records)) {
    if (row.orderCollision) {
      issues.push({
        severity: 'error',
        rule: 'order-collision',
        message: `${row.developerName}: shares OrderOfExecution__c ${row.order} with another active ${row.type} record for the same SObject/context/trigger-or-token — one of them will silently never run.`,
        developerName: row.developerName,
        sobject: row.sobject,
        source: row.source,
      });
    }

    if (row.processContext === 'TriggerExecution' && !row.triggerOperation) {
      issues.push({
        severity: 'error',
        rule: 'missing-context-field',
        message: `${row.developerName}: processContext is TriggerExecution but TriggerOperation__c is blank — this binding will never match any trigger execution.`,
        developerName: row.developerName,
        sobject: row.sobject,
        source: row.source,
      });
    } else if (row.processContext === 'DomainMethodExecution' && !row.domainMethodToken) {
      issues.push({
        severity: 'error',
        rule: 'missing-context-field',
        message: `${row.developerName}: processContext is DomainMethodExecution but DomainMethodToken__c is blank — this binding will never match any domain method call.`,
        developerName: row.developerName,
        sobject: row.sobject,
        source: row.source,
      });
    }
  }

  for (const record of diagnostics.malformed) {
    issues.push({
      severity: 'error',
      rule: 'missing-sobject-reference',
      message: `${record.developerName}: neither RelatedDomainBindingSObject__c nor RelatedDomainBindingSObjectAlternate__c is set — this binding has no SObject to bind against.`,
      developerName: record.developerName,
      source: record.source,
    });
  }

  for (const record of diagnostics.ambiguous) {
    issues.push({
      severity: 'warning',
      rule: 'ambiguous-sobject-reference',
      message: `${record.developerName}: RelatedDomainBindingSObject__c (${record.sobject}) and RelatedDomainBindingSObjectAlternate__c (${record.alternateSobject}) are both set to different values — only one should be specified.`,
      developerName: record.developerName,
      sobject: record.sobject,
      source: record.source,
    });
  }

  const occurrencesByDeveloperName = new Map<string, Array<{ sobject?: string; source: string }>>();
  for (const record of records) {
    const occurrences = occurrencesByDeveloperName.get(record.developerName) ?? [];
    occurrences.push({ sobject: record.sobject, source: record.source });
    occurrencesByDeveloperName.set(record.developerName, occurrences);
  }
  for (const record of diagnostics.malformed) {
    const occurrences = occurrencesByDeveloperName.get(record.developerName) ?? [];
    occurrences.push({ source: record.source });
    occurrencesByDeveloperName.set(record.developerName, occurrences);
  }

  for (const [developerName, occurrences] of occurrencesByDeveloperName) {
    if (occurrences.length <= 1) {
      continue;
    }
    for (const occurrence of occurrences) {
      issues.push({
        severity: 'error',
        rule: 'duplicate-developer-name',
        message: `${developerName}: defined more than once (also in ${occurrences
          .filter((other) => other !== occurrence)
          .map((other) => other.source)
          .join(
            ', ',
          )}) — Custom Metadata records are keyed by DeveloperName, so deploying these together is a conflict.`,
        developerName,
        sobject: occurrence.sobject,
        source: occurrence.source,
      });
    }
  }

  return issues;
}
