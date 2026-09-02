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

import type { FilterCondition, FilterGroup } from './schemas/history/filterConfig.js';

/**
 * Derive the field history object's API name for an sobject. Opportunity is a special case —
 * its history object is `OpportunityFieldHistory`, not `OpportunityHistory`.
 *
 * @param sobject - The tracked sobject's API name.
 * @returns The corresponding field history object's API name.
 */
export function getHistoryObjectName(sobject: string): string {
  if (sobject === 'Opportunity') {
    return 'OpportunityFieldHistory';
  }

  if (sobject.endsWith('__c')) {
    return `${sobject.slice(0, -3)}__History`;
  }

  return `${sobject}History`;
}

/**
 * Derive the field history object's lookup field back to the parent record.
 *
 * @param sobject - The tracked sobject's API name.
 * @returns The field history object's lookup field name (e.g. `AccountId`, `ParentId`).
 */
export function getParentIdField(sobject: string): string {
  if (sobject === 'Opportunity') {
    return 'OpportunityId';
  }

  if (sobject.endsWith('__c')) {
    return 'ParentId';
  }

  return `${sobject}Id`;
}

/** Type guard distinguishing a nested {@link FilterGroup} from a leaf {@link FilterCondition}. */
function isFilterGroup(filter: FilterCondition | FilterGroup): filter is FilterGroup {
  return 'logic' in filter;
}

/**
 * @param field - The filter's configured field name; `'ParentId'` is a placeholder for the
 * history object's actual parent lookup field.
 * @param parentFieldName - The history object's real parent lookup field (e.g. `AccountId`).
 * @returns `parentFieldName` if `field` is the `'ParentId'` placeholder, otherwise `field` as-is.
 */
function resolveFieldName(field: string, parentFieldName: string): string {
  return field === 'ParentId' ? parentFieldName : field;
}

/**
 * @param operator - The filter condition's operator.
 * @param value - The filter condition's configured value.
 * @param isDateField - Whether the field being compared is a date/datetime field (affects string
 * quoting, since date literals shouldn't be quoted).
 * @returns The value formatted as a SOQL literal, ready to interpolate into a WHERE clause.
 */
function formatSoqlValue(operator: FilterCondition['operator'], value: unknown, isDateField: boolean): string {
  if (operator === 'IN' || operator === 'NOT IN') {
    const values = Array.isArray(value) ? value : [value];
    return `(${values.map((v) => (typeof v === 'string' ? `'${v}'` : String(v))).join(',')})`;
  }

  if (typeof value === 'string' && !isDateField) {
    return `'${value}'`;
  }

  return String(value);
}

/**
 * Build a SOQL WHERE clause from the subset of a filter tree that references SOQL-filterable
 * fields. Conditions on any other field are left for {@link recordMatchesClientFilters} to
 * apply after the query runs.
 *
 * @param node - The filter tree (or subtree) to build a clause from.
 * @param parentFieldName - The history object's real parent lookup field, substituted for the
 * `'ParentId'` placeholder.
 * @param soqlFilterableFields - Fields that can be safely pushed into the SOQL WHERE clause;
 * conditions on any other field are omitted here.
 * @returns The WHERE clause body (no leading `WHERE`), or `''` if nothing was filterable.
 */
export function buildWhereClause(
  node: FilterGroup | undefined,
  parentFieldName: string,
  soqlFilterableFields: ReadonlySet<string>,
): string {
  if (!node || node.filters.length === 0) {
    return '';
  }

  const clause = node.filters
    .map((filter) => {
      if (isFilterGroup(filter)) {
        const nested = buildWhereClause(filter, parentFieldName, soqlFilterableFields);
        return nested ? `(${nested})` : '';
      }

      const field = resolveFieldName(filter.field, parentFieldName);

      if (!soqlFilterableFields.has(field)) {
        return '';
      }

      const value = formatSoqlValue(filter.operator, filter.value, field === 'CreatedDate');

      return `${field} ${filter.operator} ${value}`;
    })
    .filter((part) => part.length > 0)
    .join(` ${node.logic} `);

  return clause;
}

/**
 * @param pattern - A SOQL `LIKE` pattern (`%` as the wildcard).
 * @returns An equivalent `RegExp` source string, with regex metacharacters escaped and `%`
 * translated to `.*`.
 */
function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*');
}

/**
 * @param recordValue - The record's (string-valued) field value.
 * @param filterValue - The filter condition's configured value.
 * @param operator - The filter condition's operator.
 * @returns Whether the comparison holds. Numeric-looking values are compared numerically.
 */
function compareValues(
  recordValue: string | undefined,
  filterValue: unknown,
  operator: FilterCondition['operator'],
): boolean {
  if (operator === 'IN' || operator === 'NOT IN') {
    const values = Array.isArray(filterValue) ? filterValue : [filterValue];
    const isMember = values.some((value) => String(value) === recordValue);
    return operator === 'IN' ? isMember : !isMember;
  }

  if (operator === 'LIKE') {
    return new RegExp(`^${escapeLikePattern(String(filterValue))}$`).test(recordValue ?? '');
  }

  // record values are always strings (queryRecords() normalizes both the REST and Bulk API
  // paths to strings), so numeric/date comparisons need explicit coercion back to numbers —
  // otherwise e.g. "9" > "10" would be true, and "5" === 5 would never match.
  const numericRecord = recordValue !== undefined && recordValue !== '' ? Number(recordValue) : NaN;
  const numericFilter = typeof filterValue === 'number' ? filterValue : Number(filterValue);
  const bothNumeric = !Number.isNaN(numericRecord) && !Number.isNaN(numericFilter);

  const left = bothNumeric ? numericRecord : (recordValue ?? '');
  const right = bothNumeric ? numericFilter : String(filterValue);

  switch (operator) {
    case '=':
      return left === right;
    case '!=':
      return left !== right;
    case '>':
      return left > right;
    case '<':
      return left < right;
    case '>=':
      return left >= right;
    case '<=':
      return left <= right;
    default:
      return false;
  }
}

/**
 * Evaluate whether a queried record satisfies the parts of a filter tree that reference fields
 * *not* covered by the SOQL WHERE clause (e.g. OldValue/NewValue). Conditions on SOQL-filterable
 * fields are treated as already satisfied, since the query itself enforced them.
 *
 * @param record - The queried record to test.
 * @param node - The filter tree (or subtree) to evaluate.
 * @param parentFieldName - The history object's real parent lookup field, substituted for the
 * `'ParentId'` placeholder.
 * @param soqlFilterableFields - Fields already enforced by the SOQL WHERE clause; conditions on
 * these fields are treated as satisfied without re-checking.
 * @returns Whether `record` satisfies the non-SOQL-filterable parts of `node`.
 */
export function recordMatchesClientFilters(
  record: Record<string, string>,
  node: FilterGroup | undefined,
  parentFieldName: string,
  soqlFilterableFields: ReadonlySet<string>,
): boolean {
  if (!node || node.filters.length === 0) {
    return true;
  }

  const matches = (filter: FilterCondition | FilterGroup): boolean => {
    if (isFilterGroup(filter)) {
      return recordMatchesClientFilters(record, filter, parentFieldName, soqlFilterableFields);
    }

    const field = resolveFieldName(filter.field, parentFieldName);

    if (soqlFilterableFields.has(field)) {
      return true;
    }

    return compareValues(record[field], filter.value, filter.operator);
  };

  return node.logic === 'AND' ? node.filters.every(matches) : node.filters.some(matches);
}
