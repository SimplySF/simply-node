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
import { ENTITY_DEFINITION_STANDARD_OBJECTS, isCustomObjectApiName } from './entityDefinitionEligibility.js';
import type { LocalScanResult } from './at4dxLocalScan.js';

/** `unsupported-entity-definition-object`/`unnecessary-entity-definition-alternate` for every Selector/Domain record. */
function entityDefinitionIssues(records: RawBindingRecord[]): BindingIssue[] {
  const issues: BindingIssue[] = [];

  for (const record of records) {
    if (record.bindingType === 'Service' || record.bindingType === 'UnitOfWork' || !record.keyField) {
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

/** `duplicate-domain-sobject` — two or more Domain records resolving to the same SObject. */
function duplicateDomainSObjectIssues(records: RawBindingRecord[]): BindingIssue[] {
  const byKey = new Map<string, RawBindingRecord[]>();
  for (const record of records) {
    if (record.bindingType !== 'Domain') {
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
      const info = BINDING_RULES['duplicate-domain-sobject'];
      issues.push({
        severity: info.severity,
        rule: info.rule,
        scope: info.scope,
        message: `${record.developerName}: shares SObject ${record.key} with another Domain binding — BindingSObject__c/BindingSObjectAlternate__c are unique on this binding type, so both cannot deploy together.`,
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

/** `missing-sobject-reference` — one issue per malformed record. `UnitOfWork` is never validated (see `validateBindings`). */
function missingSObjectReferenceIssues(malformed: MalformedBindingRecord[]): BindingIssue[] {
  return malformed
    .filter((record) => record.bindingType !== 'UnitOfWork')
    .map((record) => {
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

/** `ambiguous-sobject-reference` — one issue per ambiguous record. `UnitOfWork` is never validated (see `validateBindings`). */
function ambiguousSObjectReferenceIssues(ambiguous: AmbiguousBindingRecord[]): BindingIssue[] {
  return ambiguous
    .filter((record) => record.bindingType !== 'UnitOfWork')
    .map((record) => {
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
    if (raw.bindingType === 'UnitOfWork') {
      continue;
    }
    record({
      bindingType: raw.bindingType,
      developerName: raw.developerName,
      key: raw.key,
      source: raw.source,
      filePath: raw.filePath,
    });
  }
  for (const raw of malformed) {
    if (raw.bindingType === 'UnitOfWork') {
      continue;
    }
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
 * Validate a scan's AT4DX Application Factory binding records for wiring problems `resolveBindings`/
 * `list` don't fail on: a binding with no resolvable key, a Selector/Domain binding whose SObject
 * reference is ambiguous or names an object `EntityDefinition` can't actually reference, two records
 * sharing a platform-unique `To__c`, two Domain records resolving to the same SObject, and the same
 * `DeveloperName` defined more than once within one binding type.
 *
 * `UnitOfWork` records are never validated — see docs/design/0015-at4dx-binding-validate-create-set.md's
 * Problem section for why. A caller that scans `UnitOfWork` alongside the other types can pass its
 * records through unfiltered; this function simply ignores them.
 *
 * See docs/design/0015-at4dx-binding-validate-create-set.md for the full rationale behind each rule.
 *
 * @param scanOrRecords - Either a scan result envelope (`{ records, malformed, ambiguous }`, as returned by `scanOrgBindings`/`scanLocalBindings`), or the raw binding records alone.
 * @param diagnostics - The `malformed`/`ambiguous` records the same scan reported alongside `records`. Omitted when the first argument is already a scan envelope.
 * @returns One issue per problem found. Empty when nothing's wrong.
 */
export function validateBindings(scan: Pick<LocalScanResult, 'records' | 'malformed' | 'ambiguous'>): BindingIssue[];
export function validateBindings(
  records: RawBindingRecord[],
  diagnostics: { malformed: MalformedBindingRecord[]; ambiguous: AmbiguousBindingRecord[] },
): BindingIssue[];
export function validateBindings(
  scanOrRecords: Pick<LocalScanResult, 'records' | 'malformed' | 'ambiguous'> | RawBindingRecord[],
  diagnostics?: { malformed: MalformedBindingRecord[]; ambiguous: AmbiguousBindingRecord[] },
): BindingIssue[] {
  const { records, malformed, ambiguous } = Array.isArray(scanOrRecords)
    ? { records: scanOrRecords, malformed: diagnostics!.malformed, ambiguous: diagnostics!.ambiguous }
    : scanOrRecords;

  return [
    ...entityDefinitionIssues(records),
    ...duplicateDomainSObjectIssues(records),
    ...duplicateToIssues(records),
    ...missingSObjectReferenceIssues(malformed),
    ...ambiguousSObjectReferenceIssues(ambiguous),
    ...duplicateDeveloperNameIssues(records, malformed),
  ];
}
