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
import { resolveDomainProcessBindings } from '../src/at4dxDomainProcessResolve.js';
import type { RawDomainProcessBindingRecord } from '../src/at4dxDomainProcessBindingTypes.js';

function record(
  overrides: Partial<RawDomainProcessBindingRecord> & Pick<RawDomainProcessBindingRecord, 'order'>,
): RawDomainProcessBindingRecord {
  return {
    developerName: `Record_${overrides.order}`,
    sobject: 'Account',
    processContext: 'TriggerExecution',
    triggerOperation: 'Before_Insert',
    type: 'Action',
    classToInject: 'SomeClass',
    isActive: true,
    executeAsynchronous: false,
    logicalInverse: false,
    preventRecursive: false,
    source: 'test',
    ...overrides,
  };
}

describe('resolveDomainProcessBindings', () => {
  it('sorts records within a group by order ascending', () => {
    const third = record({ order: 3, developerName: 'Third' });
    const first = record({ order: 1, developerName: 'First' });
    const second = record({ order: 2, developerName: 'Second' });

    const rows = resolveDomainProcessBindings([third, first, second]);

    expect(rows.map((row) => row.developerName)).toEqual(['First', 'Second', 'Third']);
  });

  it('flags orderCollision when two active records in the same group share an order', () => {
    const a = record({ order: 1, developerName: 'A' });
    const b = record({ order: 1, developerName: 'B' });

    const rows = resolveDomainProcessBindings([a, b]);

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.orderCollision).toBe(true);
    }
  });

  it('does not flag a collision between an active and an inactive record sharing an order', () => {
    const active = record({ order: 1, developerName: 'Active', isActive: true });
    const inactive = record({ order: 1, developerName: 'Inactive', isActive: false });

    const rows = resolveDomainProcessBindings([active, inactive]);

    expect(rows.find((row) => row.developerName === 'Active')?.orderCollision).toBeUndefined();
    expect(rows.find((row) => row.developerName === 'Inactive')?.orderCollision).toBeUndefined();
  });

  it('does not flag a collision between records in different groups (different SObject, context, or operation)', () => {
    const accountBeforeInsert = record({ order: 1, developerName: 'AccountBeforeInsert', sobject: 'Account' });
    const contactBeforeInsert = record({ order: 1, developerName: 'ContactBeforeInsert', sobject: 'Contact' });
    const accountAfterInsert = record({
      order: 1,
      developerName: 'AccountAfterInsert',
      sobject: 'Account',
      triggerOperation: 'After_Insert',
    });

    const rows = resolveDomainProcessBindings([accountBeforeInsert, contactBeforeInsert, accountAfterInsert]);

    for (const row of rows) {
      expect(row.orderCollision).toBeUndefined();
    }
  });

  it('does not flag a collision between a Criteria and an Action sharing an order', () => {
    const criteria = record({ order: 1, developerName: 'Criteria', type: 'Criteria' });
    const action = record({ order: 1, developerName: 'Action', type: 'Action' });

    const rows = resolveDomainProcessBindings([criteria, action]);

    expect(rows.find((row) => row.developerName === 'Criteria')?.orderCollision).toBeUndefined();
    expect(rows.find((row) => row.developerName === 'Action')?.orderCollision).toBeUndefined();
  });

  it('flags a collision between two active records of the same type sharing an order', () => {
    const first = record({ order: 1, developerName: 'FirstCriteria', type: 'Criteria' });
    const second = record({ order: 1, developerName: 'SecondCriteria', type: 'Criteria' });

    const rows = resolveDomainProcessBindings([first, second]);

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.orderCollision).toBe(true);
    }
  });

  it('groups DomainMethodExecution records by domainMethodToken instead of triggerOperation', () => {
    const first = record({
      order: 1,
      developerName: 'First',
      processContext: 'DomainMethodExecution',
      triggerOperation: undefined,
      domainMethodToken: 'ProcessDeals',
    });
    const differentToken = record({
      order: 1,
      developerName: 'DifferentToken',
      processContext: 'DomainMethodExecution',
      triggerOperation: undefined,
      domainMethodToken: 'ProcessOther',
    });

    const rows = resolveDomainProcessBindings([first, differentToken]);

    for (const row of rows) {
      expect(row.orderCollision).toBeUndefined();
    }
  });

  it('returns an empty array for an empty input', () => {
    expect(resolveDomainProcessBindings([])).toEqual([]);
  });
});
