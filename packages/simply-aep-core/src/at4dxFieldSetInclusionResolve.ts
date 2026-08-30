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

import { ENTITY_DEFINITION_STANDARD_OBJECTS, isCustomObjectApiName } from './entityDefinitionEligibility.js';
import {
  FIELD_SET_INCLUSION_RULES,
  type AmbiguousFieldSetInclusionRecord,
  type FieldSetInclusionIssue,
  type MalformedFieldSetInclusionRecord,
  type RawFieldSetInclusionRecord,
} from './at4dxFieldSetInclusionTypes.js';
import type { FieldSetInclusionLocalScanResult } from './at4dxFieldSetInclusionLocalScan.js';

/** `unsupported-entity-definition-object`/`unnecessary-entity-definition-alternate` for every record. */
function entityDefinitionIssues(records: RawFieldSetInclusionRecord[]): FieldSetInclusionIssue[] {
  const issues: FieldSetInclusionIssue[] = [];

  for (const record of records) {
    const isEligible = isCustomObjectApiName(record.sobject) || ENTITY_DEFINITION_STANDARD_OBJECTS.has(record.sobject);

    if (record.sobjectField === 'primary' && !isEligible) {
      const info = FIELD_SET_INCLUSION_RULES['unsupported-entity-definition-object'];
      issues.push({
        severity: info.severity,
        rule: info.rule,
        scope: info.scope,
        message: `${record.developerName}: BindingSObject__c is set to ${record.sobject}, a standard object not known to support EntityDefinition metadata relationships — use BindingSObjectAlternate__c instead.`,
        developerName: record.developerName,
        sobject: record.sobject,
        source: record.source,
        filePath: record.filePath,
      });
    } else if (record.sobjectField === 'alternate' && isEligible) {
      const info = FIELD_SET_INCLUSION_RULES['unnecessary-entity-definition-alternate'];
      issues.push({
        severity: info.severity,
        rule: info.rule,
        scope: info.scope,
        message: `${record.developerName}: BindingSObjectAlternate__c is set to ${record.sobject}, which supports EntityDefinition metadata relationships — use BindingSObject__c instead.`,
        developerName: record.developerName,
        sobject: record.sobject,
        source: record.source,
        filePath: record.filePath,
      });
    }
  }

  return issues;
}

/** `duplicate-fieldset-name` — `FieldsetName__c` is unique org-wide, not per-SObject, so grouping is by name alone. */
function duplicateFieldsetNameIssues(records: RawFieldSetInclusionRecord[]): FieldSetInclusionIssue[] {
  const byFieldsetName = new Map<string, RawFieldSetInclusionRecord[]>();
  for (const record of records) {
    const group = byFieldsetName.get(record.fieldsetName) ?? [];
    group.push(record);
    byFieldsetName.set(record.fieldsetName, group);
  }

  const issues: FieldSetInclusionIssue[] = [];
  for (const group of byFieldsetName.values()) {
    if (group.length <= 1) {
      continue;
    }
    for (const record of group) {
      const info = FIELD_SET_INCLUSION_RULES['duplicate-fieldset-name'];
      issues.push({
        severity: info.severity,
        rule: info.rule,
        scope: info.scope,
        message: `${record.developerName}: shares FieldsetName__c "${record.fieldsetName}" with another record — the field is unique org-wide, so both cannot deploy together.`,
        developerName: record.developerName,
        sobject: record.sobject,
        source: record.source,
        filePath: record.filePath,
      });
    }
  }
  return issues;
}

/** `missing-sobject-reference` — one issue per malformed record. */
function missingSObjectReferenceIssues(malformed: MalformedFieldSetInclusionRecord[]): FieldSetInclusionIssue[] {
  return malformed.map((record) => {
    const info = FIELD_SET_INCLUSION_RULES['missing-sobject-reference'];
    return {
      severity: info.severity,
      rule: info.rule,
      scope: info.scope,
      message: `${record.developerName}: neither BindingSObject__c nor BindingSObjectAlternate__c is set — this record has no SObject to bind against.`,
      developerName: record.developerName,
      source: record.source,
      filePath: record.filePath,
    };
  });
}

/** `ambiguous-sobject-reference` — one issue per ambiguous record. */
function ambiguousSObjectReferenceIssues(ambiguous: AmbiguousFieldSetInclusionRecord[]): FieldSetInclusionIssue[] {
  return ambiguous.map((record) => {
    const info = FIELD_SET_INCLUSION_RULES['ambiguous-sobject-reference'];
    return {
      severity: info.severity,
      rule: info.rule,
      scope: info.scope,
      message: `${record.developerName}: BindingSObject__c (${record.sobject}) and BindingSObjectAlternate__c (${record.alternateSobject}) are both set to different values — only one should be specified.`,
      developerName: record.developerName,
      sobject: record.sobject,
      source: record.source,
      filePath: record.filePath,
    };
  });
}

type DeveloperNameOccurrence = {
  developerName: string;
  sobject?: string;
  source: string;
  filePath?: string;
};

/** `duplicate-developer-name` — the same `DeveloperName` defined more than once across the scan. */
function duplicateDeveloperNameIssues(
  records: RawFieldSetInclusionRecord[],
  malformed: MalformedFieldSetInclusionRecord[],
): FieldSetInclusionIssue[] {
  const occurrencesByDeveloperName = new Map<string, DeveloperNameOccurrence[]>();

  const record = (occurrence: DeveloperNameOccurrence): void => {
    const occurrences = occurrencesByDeveloperName.get(occurrence.developerName) ?? [];
    occurrences.push(occurrence);
    occurrencesByDeveloperName.set(occurrence.developerName, occurrences);
  };

  for (const raw of records) {
    record({ developerName: raw.developerName, sobject: raw.sobject, source: raw.source, filePath: raw.filePath });
  }
  for (const raw of malformed) {
    record({ developerName: raw.developerName, source: raw.source, filePath: raw.filePath });
  }

  const issues: FieldSetInclusionIssue[] = [];
  for (const [developerName, occurrences] of occurrencesByDeveloperName) {
    if (occurrences.length <= 1) {
      continue;
    }
    for (const occurrence of occurrences) {
      const info = FIELD_SET_INCLUSION_RULES['duplicate-developer-name'];
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
        developerName,
        sobject: occurrence.sobject,
        source: occurrence.source,
        filePath: occurrence.filePath,
      });
    }
  }
  return issues;
}

/**
 * Validate a scan's `SelectorConfig_FieldSetInclusion__mdt` records for wiring problems `list` doesn't
 * fail on: a record with no resolvable SObject, an ambiguous SObject reference, a SObject reference
 * naming a standard object that can't actually go through `EntityDefinition`, two records sharing a
 * `FieldsetName__c` (unique org-wide, not per-SObject), and the same `DeveloperName` defined more than
 * once.
 *
 * Unlike `binding list`/`resolve`, there's no priority/winner concept here to validate around — every
 * active record for a SObject contributes its field set simultaneously (see
 * docs/design/0016-at4dx-selector-config-field-set-inclusion.md).
 *
 * @param scanOrRecords - Either a scan result envelope (`{ records, malformed, ambiguous }`, as returned by `scanOrgFieldSetInclusions`/`scanLocalFieldSetInclusions`), or the raw records alone.
 * @param diagnostics - The `malformed`/`ambiguous` records the same scan reported alongside `records`. Omitted when the first argument is already a scan envelope.
 * @returns One issue per problem found. Empty when nothing's wrong.
 */
export function validateFieldSetInclusions(
  scan: Pick<FieldSetInclusionLocalScanResult, 'records' | 'malformed' | 'ambiguous'>,
): FieldSetInclusionIssue[];
export function validateFieldSetInclusions(
  records: RawFieldSetInclusionRecord[],
  diagnostics: {
    malformed: MalformedFieldSetInclusionRecord[];
    ambiguous: AmbiguousFieldSetInclusionRecord[];
  },
): FieldSetInclusionIssue[];
export function validateFieldSetInclusions(
  scanOrRecords:
    Pick<FieldSetInclusionLocalScanResult, 'records' | 'malformed' | 'ambiguous'> | RawFieldSetInclusionRecord[],
  diagnostics?: {
    malformed: MalformedFieldSetInclusionRecord[];
    ambiguous: AmbiguousFieldSetInclusionRecord[];
  },
): FieldSetInclusionIssue[] {
  const { records, malformed, ambiguous } = Array.isArray(scanOrRecords)
    ? { records: scanOrRecords, malformed: diagnostics!.malformed, ambiguous: diagnostics!.ambiguous }
    : scanOrRecords;

  return [
    ...entityDefinitionIssues(records),
    ...duplicateFieldsetNameIssues(records),
    ...missingSObjectReferenceIssues(malformed),
    ...ambiguousSObjectReferenceIssues(ambiguous),
    ...duplicateDeveloperNameIssues(records, malformed),
  ];
}
