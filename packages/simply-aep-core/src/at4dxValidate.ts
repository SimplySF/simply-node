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
  BINDING_RULES,
  type AmbiguousBindingRecord,
  type BindingIssue,
  type MalformedBindingRecord,
  type RawBindingRecord,
} from './at4dxBindingTypes.js';
import type { RawApexTriggerRecord } from './at4dxApexTriggerTypes.js';
import { ENTITY_DEFINITION_STANDARD_OBJECTS, isCustomObjectApiName } from './entityDefinitionEligibility.js';
import type { LocalScanResult } from './at4dxLocalScan.js';

/** `unsupported-entity-definition-object`/`unnecessary-entity-definition-alternate` for every Selector/Domain/UnitOfWork record. */
function entityDefinitionIssues(records: RawBindingRecord[]): BindingIssue[] {
  const issues: BindingIssue[] = [];

  for (const record of records) {
    if (record.bindingType === 'Service' || !record.keyField) {
      continue;
    }

    const isEligible = isCustomObjectApiName(record.key) || ENTITY_DEFINITION_STANDARD_OBJECTS.has(record.key);

    if (record.keyField === 'primary' && !isEligible) {
      const info = BINDING_RULES['unsupported-entity-definition-object'];
      issues.push({
        severity: info.severity,
        rule: info.rule,
        scope: info.scope,
        message: `${record.developerName}: BindingSObject__c is set to ${record.key}, a standard object not known to support EntityDefinition metadata relationships — use BindingSObjectAlternate__c instead.`,
        bindingType: record.bindingType,
        developerName: record.developerName,
        key: record.key,
        source: record.source,
        filePath: record.filePath,
      });
    } else if (record.keyField === 'alternate' && isEligible) {
      const info = BINDING_RULES['unnecessary-entity-definition-alternate'];
      issues.push({
        severity: info.severity,
        rule: info.rule,
        scope: info.scope,
        message: `${record.developerName}: BindingSObjectAlternate__c is set to ${record.key}, which supports EntityDefinition metadata relationships — use BindingSObject__c instead.`,
        bindingType: record.bindingType,
        developerName: record.developerName,
        key: record.key,
        source: record.source,
        filePath: record.filePath,
      });
    }
  }

  return issues;
}

/**
 * `duplicate-domain-sobject`/`duplicate-unit-of-work-sobject` — two or more records of the same
 * (Domain or UnitOfWork) binding type resolving to the same SObject. Both types have
 * `BindingSObject__c`/`BindingSObjectAlternate__c` platform-unique (see
 * docs/design/0017-at4dx-binding-unit-of-work-write-support.md for UnitOfWork's confirmed schema), so
 * this is the identical detection logic for each — parameterized by `bindingType`/`rule` rather than
 * duplicated, but kept as two distinct public rule ids (not merged into one) since
 * `duplicate-domain-sobject` already shipped in docs/design/0015-at4dx-binding-validate-create-set.md
 * and renaming it would break an existing consumer's `BindingIssueRule` match.
 */
function duplicateUniqueSObjectIssues(
  records: RawBindingRecord[],
  bindingType: 'Domain' | 'UnitOfWork',
  rule: 'duplicate-domain-sobject' | 'duplicate-unit-of-work-sobject',
): BindingIssue[] {
  const byKey = new Map<string, RawBindingRecord[]>();
  for (const record of records) {
    if (record.bindingType !== bindingType) {
      continue;
    }
    const group = byKey.get(record.key) ?? [];
    group.push(record);
    byKey.set(record.key, group);
  }

  const issues: BindingIssue[] = [];
  for (const group of byKey.values()) {
    if (group.length <= 1) {
      continue;
    }
    for (const record of group) {
      const info = BINDING_RULES[rule];
      issues.push({
        severity: info.severity,
        rule: info.rule,
        scope: info.scope,
        message: `${record.developerName}: shares SObject ${record.key} with another ${bindingType} binding — BindingSObject__c/BindingSObjectAlternate__c are unique on this binding type, so both cannot deploy together.`,
        bindingType: record.bindingType,
        developerName: record.developerName,
        key: record.key,
        source: record.source,
        filePath: record.filePath,
      });
    }
  }
  return issues;
}

/** `sequence-collision` — two or more UnitOfWork records sharing a defined `BindingSequence__c`. Records with no `sequence` at all are never flagged — that's the ordinary "unordered" default, not a conflict. */
function sequenceCollisionIssues(records: RawBindingRecord[]): BindingIssue[] {
  const bySequence = new Map<number, RawBindingRecord[]>();
  for (const record of records) {
    if (record.bindingType !== 'UnitOfWork' || record.sequence === undefined) {
      continue;
    }
    const group = bySequence.get(record.sequence) ?? [];
    group.push(record);
    bySequence.set(record.sequence, group);
  }

  const issues: BindingIssue[] = [];
  for (const group of bySequence.values()) {
    if (group.length <= 1) {
      continue;
    }
    for (const record of group) {
      const info = BINDING_RULES['sequence-collision'];
      issues.push({
        severity: info.severity,
        rule: info.rule,
        scope: info.scope,
        message: `${record.developerName}: shares BindingSequence__c ${String(record.sequence)} with another UnitOfWork binding — both SObjects are still registered, but their relative commit order is no longer deterministic.`,
        bindingType: record.bindingType,
        developerName: record.developerName,
        key: record.key,
        source: record.source,
        filePath: record.filePath,
      });
    }
  }
  return issues;
}

/** `duplicate-to` — two or more records of the same binding type sharing a `To__c` value. */
function duplicateToIssues(records: RawBindingRecord[]): BindingIssue[] {
  const byTypeAndTo = new Map<string, RawBindingRecord[]>();
  for (const record of records) {
    if (record.bindingType === 'UnitOfWork' || !record.to) {
      continue;
    }
    const mapKey = `${record.bindingType} ${record.to}`;
    const group = byTypeAndTo.get(mapKey) ?? [];
    group.push(record);
    byTypeAndTo.set(mapKey, group);
  }

  const issues: BindingIssue[] = [];
  for (const group of byTypeAndTo.values()) {
    if (group.length <= 1) {
      continue;
    }
    for (const record of group) {
      const info = BINDING_RULES['duplicate-to'];
      issues.push({
        severity: info.severity,
        rule: info.rule,
        scope: info.scope,
        message: `${record.developerName}: shares To__c "${String(record.to)}" with another ${record.bindingType} binding — To__c is unique, so both cannot deploy together.`,
        bindingType: record.bindingType,
        developerName: record.developerName,
        key: record.key,
        source: record.source,
        filePath: record.filePath,
      });
    }
  }
  return issues;
}

/** `missing-sobject-reference` — one issue per malformed record. */
function missingSObjectReferenceIssues(malformed: MalformedBindingRecord[]): BindingIssue[] {
  return malformed.map((record) => {
    const info = BINDING_RULES['missing-sobject-reference'];
    const message =
      record.bindingType === 'Service'
        ? `${record.developerName}: BindingInterface__c is not set — this binding has no interface to bind against.`
        : `${record.developerName}: neither BindingSObject__c nor BindingSObjectAlternate__c is set — this binding has no SObject to bind against.`;
    return {
      severity: info.severity,
      rule: info.rule,
      scope: info.scope,
      message,
      bindingType: record.bindingType,
      developerName: record.developerName,
      source: record.source,
      filePath: record.filePath,
    };
  });
}

/** `ambiguous-sobject-reference` — one issue per ambiguous record. */
function ambiguousSObjectReferenceIssues(ambiguous: AmbiguousBindingRecord[]): BindingIssue[] {
  return ambiguous.map((record) => {
    const info = BINDING_RULES['ambiguous-sobject-reference'];
    return {
      severity: info.severity,
      rule: info.rule,
      scope: info.scope,
      message: `${record.developerName}: BindingSObject__c (${record.key}) and BindingSObjectAlternate__c (${record.alternateKey}) are both set to different values — only one should be specified.`,
      bindingType: record.bindingType,
      developerName: record.developerName,
      key: record.key,
      source: record.source,
      filePath: record.filePath,
    };
  });
}

type DeveloperNameOccurrence = {
  bindingType: RawBindingRecord['bindingType'];
  developerName: string;
  key?: string;
  source: string;
  filePath?: string;
};

/** `duplicate-developer-name` — the same `DeveloperName` defined more than once within one binding type. */
function duplicateDeveloperNameIssues(
  records: RawBindingRecord[],
  malformed: MalformedBindingRecord[],
): BindingIssue[] {
  const occurrencesByKey = new Map<string, DeveloperNameOccurrence[]>();

  const record = (occurrence: DeveloperNameOccurrence): void => {
    const mapKey = `${occurrence.bindingType} ${occurrence.developerName}`;
    const occurrences = occurrencesByKey.get(mapKey) ?? [];
    occurrences.push(occurrence);
    occurrencesByKey.set(mapKey, occurrences);
  };

  for (const raw of records) {
    record({
      bindingType: raw.bindingType,
      developerName: raw.developerName,
      key: raw.key,
      source: raw.source,
      filePath: raw.filePath,
    });
  }
  for (const raw of malformed) {
    record({
      bindingType: raw.bindingType,
      developerName: raw.developerName,
      source: raw.source,
      filePath: raw.filePath,
    });
  }

  const issues: BindingIssue[] = [];
  for (const occurrences of occurrencesByKey.values()) {
    if (occurrences.length <= 1) {
      continue;
    }
    const developerName = occurrences[0].developerName;
    for (const occurrence of occurrences) {
      const info = BINDING_RULES['duplicate-developer-name'];
      issues.push({
        severity: info.severity,
        rule: info.rule,
        scope: info.scope,
        message: `${developerName}: defined more than once (also in ${occurrences
          .filter((other) => other !== occurrence)
          .map((other) => other.source)
          .join(
            ', ',
          )}) — Custom Metadata records are keyed by DeveloperName, so deploying these together is a conflict.`,
        bindingType: occurrence.bindingType,
        developerName,
        key: occurrence.key,
        source: occurrence.source,
        filePath: occurrence.filePath,
      });
    }
  }
  return issues;
}

/**
 * @returns Whether `classes` (a trigger's `triggerHandlerClasses`) contains `domainClass` — matched
 * case-insensitively, and tolerant of a namespace-qualified reference in the trigger
 * (`ns.AccountsDomain` satisfies a binding's unqualified `to: 'AccountsDomain'`).
 */
function triggerHandlesClass(classes: string[], domainClass: string): boolean {
  const target = domainClass.toLowerCase();
  return classes.some((className) => {
    const lower = className.toLowerCase();
    return lower === target || lower.endsWith(`.${target}`);
  });
}

/**
 * `missing-domain-trigger` — a `Domain` binding whose SObject (`key`) has no *Active* Apex trigger
 * whose body calls `fflib_SObjectDomain.triggerHandler(<to>.class)`. Skipped entirely when `triggers`
 * isn't supplied (existing callers see no behavior change), and for a record whose `to` is blank
 * (nothing to check against — see docs/design/0036's Open questions). Three message shapes depending
 * on what was found on `key`: no trigger at all, trigger(s) that never call the right class, or only
 * an Inactive trigger that does.
 */
function missingDomainTriggerIssues(
  records: RawBindingRecord[],
  triggers: RawApexTriggerRecord[] | undefined,
): BindingIssue[] {
  if (!triggers) {
    return [];
  }

  const issues: BindingIssue[] = [];

  for (const record of records) {
    if (record.bindingType !== 'Domain' || !record.to) {
      continue;
    }

    const domainClass = record.to;
    const onSObject = triggers.filter((trigger) => trigger.sobject.toLowerCase() === record.key.toLowerCase());
    const wired = onSObject.filter((trigger) => triggerHandlesClass(trigger.triggerHandlerClasses, domainClass));

    if (wired.some((trigger) => trigger.active)) {
      continue;
    }

    const info = BINDING_RULES['missing-domain-trigger'];
    const neverFires = `this Domain's logic (and any Domain Process Bindings on ${record.key}) never fires`;
    const message =
      onSObject.length === 0
        ? `${record.developerName}: no Apex trigger exists on ${record.key} — fflib_SObjectDomain.triggerHandler(${domainClass}.class) is never called, so ${neverFires}.`
        : wired.length === 0
          ? `${record.developerName}: found ${onSObject.map((trigger) => trigger.name).join(', ')} on ${record.key}, but none call fflib_SObjectDomain.triggerHandler(${domainClass}.class) — ${neverFires}.`
          : `${record.developerName}: ${wired.map((trigger) => trigger.name).join(', ')} calls fflib_SObjectDomain.triggerHandler(${domainClass}.class), but its Status is Inactive — ${neverFires}.`;

    issues.push({
      severity: info.severity,
      rule: info.rule,
      scope: info.scope,
      message,
      bindingType: record.bindingType,
      developerName: record.developerName,
      key: record.key,
      source: record.source,
      filePath: record.filePath,
    });
  }

  return issues;
}

/**
 * Validate a scan's AT4DX Application Factory binding records for wiring problems `resolveBindings`/
 * `list` don't fail on: a binding with no resolvable key, a Selector/Domain/UnitOfWork binding whose
 * SObject reference is ambiguous or names an object `EntityDefinition` can't actually reference, two
 * Service/Selector/Domain records sharing a platform-unique `To__c`, two Domain (or two UnitOfWork)
 * records resolving to the same SObject, two UnitOfWork records sharing a `BindingSequence__c`, and the
 * same `DeveloperName` defined more than once within one binding type.
 *
 * See docs/design/0015-at4dx-binding-validate-create-set.md for the original rationale behind each rule,
 * and docs/design/0017-at4dx-binding-unit-of-work-write-support.md for why UnitOfWork was brought into
 * every rule here except `duplicate-to` (it has no `To__c` field, permanently).
 *
 * @param scanOrRecords - Either a scan result envelope (`{ records, malformed, ambiguous }`, as returned by `scanOrgBindings`/`scanLocalBindings`), or the raw binding records alone.
 * @param diagnostics - The `malformed`/`ambiguous` records the same scan reported alongside `records`. Omitted when the first argument is already a scan envelope.
 * @param triggers - Apex triggers scanned via `scanLocalApexTriggers`/`scanOrgApexTriggers`, for `missing-domain-trigger`. Omitted entirely (in either call form) skips that one rule — every other rule is unaffected.
 * @returns One issue per problem found. Empty when nothing's wrong.
 */
export function validateBindings(
  scan: Pick<LocalScanResult, 'records' | 'malformed' | 'ambiguous'>,
  triggers?: RawApexTriggerRecord[],
): BindingIssue[];
export function validateBindings(
  records: RawBindingRecord[],
  diagnostics: { malformed: MalformedBindingRecord[]; ambiguous: AmbiguousBindingRecord[] },
  triggers?: RawApexTriggerRecord[],
): BindingIssue[];
export function validateBindings(
  scanOrRecords: Pick<LocalScanResult, 'records' | 'malformed' | 'ambiguous'> | RawBindingRecord[],
  diagnosticsOrTriggers?:
    { malformed: MalformedBindingRecord[]; ambiguous: AmbiguousBindingRecord[] } | RawApexTriggerRecord[],
  maybeTriggers?: RawApexTriggerRecord[],
): BindingIssue[] {
  const isRecordsForm = Array.isArray(scanOrRecords);

  const { records, malformed, ambiguous } = isRecordsForm
    ? {
        records: scanOrRecords,
        malformed: (diagnosticsOrTriggers as { malformed: MalformedBindingRecord[] }).malformed,
        ambiguous: (diagnosticsOrTriggers as { ambiguous: AmbiguousBindingRecord[] }).ambiguous,
      }
    : scanOrRecords;

  const triggers = isRecordsForm ? maybeTriggers : (diagnosticsOrTriggers as RawApexTriggerRecord[] | undefined);

  return [
    ...entityDefinitionIssues(records),
    ...duplicateUniqueSObjectIssues(records, 'Domain', 'duplicate-domain-sobject'),
    ...duplicateUniqueSObjectIssues(records, 'UnitOfWork', 'duplicate-unit-of-work-sobject'),
    ...sequenceCollisionIssues(records),
    ...duplicateToIssues(records),
    ...missingSObjectReferenceIssues(malformed),
    ...ambiguousSObjectReferenceIssues(ambiguous),
    ...duplicateDeveloperNameIssues(records, malformed),
    ...missingDomainTriggerIssues(records, triggers),
  ];
}
