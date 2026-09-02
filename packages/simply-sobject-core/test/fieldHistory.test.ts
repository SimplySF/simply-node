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

import { describe, expect, it } from 'vitest';
import {
  buildWhereClause,
  getHistoryObjectName,
  getParentIdField,
  recordMatchesClientFilters,
} from '../src/fieldHistory.js';
import type { FilterGroup } from '../src/schemas/history/filterConfig.js';

describe('getHistoryObjectName', () => {
  it('special-cases Opportunity', () => {
    expect(getHistoryObjectName('Opportunity')).to.equal('OpportunityFieldHistory');
  });

  it('replaces a __c suffix with __History', () => {
    expect(getHistoryObjectName('Custom_Object__c')).to.equal('Custom_Object__History');
  });

  it('appends History for other standard objects', () => {
    expect(getHistoryObjectName('Account')).to.equal('AccountHistory');
  });
});

describe('getParentIdField', () => {
  it('special-cases Opportunity', () => {
    expect(getParentIdField('Opportunity')).to.equal('OpportunityId');
  });

  it('uses ParentId for custom objects', () => {
    expect(getParentIdField('Custom_Object__c')).to.equal('ParentId');
  });

  it('uses {Object}Id for other standard objects', () => {
    expect(getParentIdField('Account')).to.equal('AccountId');
  });
});

describe('buildWhereClause', () => {
  const soqlFilterableFields = new Set(['Field', 'CreatedById', 'CreatedDate', 'ParentId', 'AccountId']);

  it('returns an empty string when there is no filter tree', () => {
    expect(buildWhereClause(undefined, 'AccountId', soqlFilterableFields)).to.equal('');
  });

  it('builds a simple AND clause and quotes string values', () => {
    const filterConfig: FilterGroup = {
      logic: 'AND',
      filters: [
        { field: 'Field', operator: '=', value: 'Name' },
        { field: 'ParentId', operator: '=', value: '001xx0000000001' },
      ],
    };

    expect(buildWhereClause(filterConfig, 'AccountId', soqlFilterableFields)).to.equal(
      "Field = 'Name' AND AccountId = '001xx0000000001'",
    );
  });

  it('does not quote CreatedDate values', () => {
    const filterConfig: FilterGroup = {
      logic: 'AND',
      filters: [{ field: 'CreatedDate', operator: '>', value: '2026-01-01T00:00:00Z' }],
    };

    expect(buildWhereClause(filterConfig, 'AccountId', soqlFilterableFields)).to.equal(
      'CreatedDate > 2026-01-01T00:00:00Z',
    );
  });

  it('drops conditions on fields that are not SOQL-filterable, without leaving empty parens', () => {
    const filterConfig: FilterGroup = {
      logic: 'AND',
      filters: [
        { field: 'Field', operator: '=', value: 'Status__c' },
        {
          logic: 'AND',
          filters: [
            { field: 'NewValue', operator: '=', value: 'Queued' },
            { field: 'OldValue', operator: '=', value: 'Transmit' },
          ],
        },
      ],
    };

    expect(buildWhereClause(filterConfig, 'AccountId', soqlFilterableFields)).to.equal("Field = 'Status__c'");
  });

  it('formats IN/NOT IN values as a SOQL literal list', () => {
    const filterConfig: FilterGroup = {
      logic: 'OR',
      filters: [{ field: 'CreatedById', operator: 'IN', value: ['005xx1', '005xx2'] }],
    };

    expect(buildWhereClause(filterConfig, 'AccountId', soqlFilterableFields)).to.equal(
      "CreatedById IN ('005xx1','005xx2')",
    );
  });
});

describe('recordMatchesClientFilters', () => {
  const soqlFilterableFields = new Set(['Field', 'CreatedById', 'CreatedDate', 'ParentId', 'AccountId']);

  it('passes every record when there is no filter tree', () => {
    expect(recordMatchesClientFilters({ NewValue: 'x' }, undefined, 'AccountId', soqlFilterableFields)).to.be.true;
  });

  it('treats SOQL-filterable fields as already satisfied', () => {
    const filterConfig: FilterGroup = { logic: 'AND', filters: [{ field: 'Field', operator: '=', value: 'Name' }] };
    expect(recordMatchesClientFilters({ Field: 'AnythingAtAll' }, filterConfig, 'AccountId', soqlFilterableFields)).to
      .be.true;
  });

  it('numerically compares record strings against filter numbers', () => {
    const filterConfig: FilterGroup = { logic: 'AND', filters: [{ field: 'Amount', operator: '>', value: 9 }] };
    expect(recordMatchesClientFilters({ Amount: '10' }, filterConfig, 'AccountId', soqlFilterableFields)).to.be.true;
    expect(recordMatchesClientFilters({ Amount: '5' }, filterConfig, 'AccountId', soqlFilterableFields)).to.be.false;
  });

  it('evaluates IN against an array value', () => {
    const filterConfig: FilterGroup = {
      logic: 'AND',
      filters: [{ field: 'NewValue', operator: 'IN', value: ['A', 'B'] }],
    };
    expect(recordMatchesClientFilters({ NewValue: 'B' }, filterConfig, 'AccountId', soqlFilterableFields)).to.be.true;
    expect(recordMatchesClientFilters({ NewValue: 'C' }, filterConfig, 'AccountId', soqlFilterableFields)).to.be.false;
  });

  it('evaluates LIKE with % as a wildcard and escapes other regex characters', () => {
    const filterConfig: FilterGroup = {
      logic: 'AND',
      filters: [{ field: 'NewValue', operator: 'LIKE', value: 'Queued (%)' }],
    };
    expect(
      recordMatchesClientFilters({ NewValue: 'Queued (for review)' }, filterConfig, 'AccountId', soqlFilterableFields),
    ).to.be.true;
    expect(
      recordMatchesClientFilters({ NewValue: 'Queued for review' }, filterConfig, 'AccountId', soqlFilterableFields),
    ).to.be.false;
  });

  it('applies OR logic across sibling filters', () => {
    const filterConfig: FilterGroup = {
      logic: 'OR',
      filters: [
        { field: 'NewValue', operator: '=', value: 'A' },
        { field: 'NewValue', operator: '=', value: 'B' },
      ],
    };
    expect(recordMatchesClientFilters({ NewValue: 'B' }, filterConfig, 'AccountId', soqlFilterableFields)).to.be.true;
    expect(recordMatchesClientFilters({ NewValue: 'C' }, filterConfig, 'AccountId', soqlFilterableFields)).to.be.false;
  });
});
