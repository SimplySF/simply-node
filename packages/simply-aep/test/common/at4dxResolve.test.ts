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
import { resolveBindings } from '../../src/common/at4dxResolve.js';
import type { RawBindingRecord } from '../../src/common/at4dxBindingTypes.js';

function record(
  overrides: Partial<RawBindingRecord> & Pick<RawBindingRecord, 'bindingType' | 'key'>,
): RawBindingRecord {
  return {
    developerName: overrides.key,
    source: 'test',
    ...overrides,
  };
}

describe('resolveBindings', () => {
  it('resolves Service bindings by highest Priority__c, nulls sorting lowest', () => {
    const low = record({ bindingType: 'Service', key: 'IMyService', developerName: 'Low', priority: 1, to: 'LowImpl' });
    const high = record({
      bindingType: 'Service',
      key: 'IMyService',
      developerName: 'High',
      priority: 5,
      to: 'HighImpl',
    });

    const rows = resolveBindings([low, high]);

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.developerName === 'High')?.effective).toBe(true);
    expect(rows.find((row) => row.developerName === 'Low')?.effective).toBe(false);
  });

  it('treats a null Priority__c as lower than any declared priority', () => {
    const noPriority = record({
      bindingType: 'Service',
      key: 'IMyService',
      developerName: 'NoPriority',
      to: 'DefaultImpl',
    });
    const withPriority = record({
      bindingType: 'Service',
      key: 'IMyService',
      developerName: 'WithPriority',
      priority: 0,
      to: 'OverrideImpl',
    });

    const rows = resolveBindings([noPriority, withPriority]);

    expect(rows.find((row) => row.developerName === 'WithPriority')?.effective).toBe(true);
    expect(rows.find((row) => row.developerName === 'NoPriority')?.effective).toBe(false);
  });

  it('falls back to BindingSObjectAlternate__c as the Selector key when BindingSObject__c is blank', () => {
    // at4dxOrgScan/at4dxLocalScan already resolve the alternate-field fallback into `key` before
    // resolveBindings ever sees the record, so this just pins down that resolution treats the
    // alternate-derived key like any other key.
    const row = record({ bindingType: 'Selector', key: 'My_Custom_Object__c', to: 'MyCustomObjectSelector' });

    const rows = resolveBindings([row]);

    expect(rows).toEqual([{ ...row, effective: true }]);
  });

  it('flags every row ambiguous when two Domain bindings share a key, and asserts no winner', () => {
    const first = record({ bindingType: 'Domain', key: 'Campaign', developerName: 'First', to: 'FirstDomain' });
    const second = record({ bindingType: 'Domain', key: 'Campaign', developerName: 'Second', to: 'SecondDomain' });

    const rows = resolveBindings([first, second]);

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.effective).toBe(false);
      expect(row.ambiguous).toBe(true);
    }
  });

  it('does not flag a single Domain binding per SObject as ambiguous', () => {
    const row = record({ bindingType: 'Domain', key: 'Campaign', to: 'CampaignDomain' });

    const rows = resolveBindings([row]);

    expect(rows).toHaveLength(1);
    expect(rows[0].effective).toBe(true);
    expect(rows[0].ambiguous).toBeUndefined();
  });

  it('includes every UnitOfWork binding, ordered by BindingSequence__c ascending, with no `to`', () => {
    const third = record({ bindingType: 'UnitOfWork', key: 'Opportunity', developerName: 'Third', sequence: 30 });
    const first = record({ bindingType: 'UnitOfWork', key: 'Account', developerName: 'First', sequence: 10 });
    const second = record({ bindingType: 'UnitOfWork', key: 'Contact', developerName: 'Second', sequence: 20 });

    const rows = resolveBindings([third, first, second]);

    expect(rows.map((row) => row.developerName)).toEqual(['First', 'Second', 'Third']);
    for (const row of rows) {
      expect(row.effective).toBe(true);
      expect(row.to).toBeUndefined();
    }
  });

  it('returns an empty array for an empty input', () => {
    expect(resolveBindings([])).toEqual([]);
  });
});
