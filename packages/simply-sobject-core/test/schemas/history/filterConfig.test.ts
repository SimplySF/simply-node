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
import { FilterConfigSchema } from '../../../src/schemas/history/filterConfig.js';

describe('FilterConfigSchema', () => {
  it('accepts a flat filter group', () => {
    const result = FilterConfigSchema.safeParse({
      logic: 'AND',
      filters: [{ field: 'Field', operator: '=', value: 'Name' }],
    });

    expect(result.success).to.be.true;
  });

  it('accepts arbitrarily nested filter groups', () => {
    const result = FilterConfigSchema.safeParse({
      logic: 'AND',
      filters: [
        { field: 'Field', operator: '=', value: 'Status__c' },
        {
          logic: 'OR',
          filters: [
            { field: 'NewValue', operator: '=', value: 'A' },
            { field: 'NewValue', operator: '=', value: 'B' },
          ],
        },
      ],
    });

    expect(result.success).to.be.true;
  });

  it('normalizes lowercase logic operators to uppercase', () => {
    const result = FilterConfigSchema.safeParse({ logic: 'and', filters: [] });

    expect(result.success).to.be.true;
    if (result.success) {
      expect(result.data.logic).to.equal('AND');
    }
  });

  it('rejects an unknown operator', () => {
    const result = FilterConfigSchema.safeParse({
      logic: 'AND',
      filters: [{ field: 'Field', operator: 'CONTAINS', value: 'x' }],
    });

    expect(result.success).to.be.false;
  });

  it('rejects a missing filters array', () => {
    const result = FilterConfigSchema.safeParse({ logic: 'AND' });

    expect(result.success).to.be.false;
  });
});
