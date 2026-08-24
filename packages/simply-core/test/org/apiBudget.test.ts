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

import { Connection } from '@salesforce/core';
import { describe, expect, it, vi } from 'vitest';
import { apiBudgetError, checkApiBudget } from '../../src/org/apiBudget.js';

/**
 * @param apiUsage - Value for `connection.limitInfo.apiUsage`, or `undefined` for an unprimed
 * connection that must fall back to the limits API.
 * @param limits - Behavior of `connection.limits()`.
 * @returns A connection stub.
 */
function stubConnection(
  apiUsage?: { used: number; limit: number },
  limits?: () => Promise<Record<string, { Max: number; Remaining: number }>>,
): Connection {
  return {
    limitInfo: apiUsage ? { apiUsage } : {},
    limits: limits ?? (() => Promise.reject(new Error('limits() should not have been called'))),
  } as unknown as Connection;
}

describe('checkApiBudget', () => {
  describe('header source', () => {
    it('should use limitInfo without calling the limits API', async () => {
      const limits = vi.fn();
      const result = await checkApiBudget(stubConnection({ used: 1_000, limit: 10_000 }, limits), 100, {
        maxUsagePercent: 20,
      });

      expect(limits).not.toHaveBeenCalled();
      expect(result.source).to.equal('header');
      expect(result.remaining).to.equal(9_000);
      expect(result.budget).to.equal(1_800);
      expect(result.status).to.equal('ok');
      // Nothing was spent obtaining the reading, so the planned count is untouched.
      expect(result.plannedRequests).to.equal(100);
    });

    it('should not report a negative remaining when usage exceeds the limit', async () => {
      const result = await checkApiBudget(stubConnection({ used: 12_000, limit: 10_000 }), 1, {
        maxUsagePercent: 20,
      });

      expect(result.remaining).to.equal(0);
      expect(result.status).to.equal('exceeded');
    });
  });

  describe('the budget boundary', () => {
    // remaining 1,000 at 20% => budget 200
    const connection = (): Connection => stubConnection({ used: 9_000, limit: 10_000 });

    it('should allow a run just under budget', async () => {
      expect((await checkApiBudget(connection(), 199, { maxUsagePercent: 20 })).status).to.equal('ok');
    });

    it('should allow a run exactly at budget', async () => {
      expect((await checkApiBudget(connection(), 200, { maxUsagePercent: 20 })).status).to.equal('ok');
    });

    it('should refuse a run one request over budget', async () => {
      expect((await checkApiBudget(connection(), 201, { maxUsagePercent: 20 })).status).to.equal('exceeded');
    });

    it('should round the budget down rather than up', async () => {
      // 999 remaining at 20% is 199.8 — budgeting 200 would allow a request the percentage does not.
      const result = await checkApiBudget(stubConnection({ used: 9_001, limit: 10_000 }), 200, {
        maxUsagePercent: 20,
      });

      expect(result.budget).to.equal(199);
      expect(result.status).to.equal('exceeded');
    });
  });

  describe('limits API fallback', () => {
    it('should fall back when limitInfo is empty, and charge itself one request', async () => {
      const result = await checkApiBudget(
        stubConnection(undefined, () => Promise.resolve({ DailyApiRequests: { Max: 10_000, Remaining: 5_000 } })),
        100,
        { maxUsagePercent: 20 },
      );

      expect(result.source).to.equal('limits-api');
      expect(result.remaining).to.equal(5_000);
      // Its own call comes out of the same allocation, so it is added to the plan...
      expect(result.plannedRequests).to.equal(101);
      // ...but Remaining already excludes it, so it is not subtracted a second time.
      expect(result.budget).to.equal(1_000);
    });

    it('should report unavailable rather than throwing when limits() is denied', async () => {
      const result = await checkApiBudget(
        stubConnection(undefined, () => Promise.reject(new Error('INSUFFICIENT_ACCESS'))),
        100,
        { maxUsagePercent: 20 },
      );

      expect(result.status).to.equal('unavailable');
      expect(result.reason).to.include('INSUFFICIENT_ACCESS');
      expect(result.remaining).to.equal(undefined);
    });

    it('should report unavailable when DailyApiRequests is missing', async () => {
      const result = await checkApiBudget(
        stubConnection(undefined, () => Promise.resolve({})),
        100,
        {
          maxUsagePercent: 20,
        },
      );

      expect(result.status).to.equal('unavailable');
      expect(result.reason).to.include('DailyApiRequests');
    });
  });

  describe('runs that cannot finish', () => {
    it('should refuse a run exceeding remaining even at 100 percent', async () => {
      const result = await checkApiBudget(stubConnection({ used: 9_000, limit: 10_000 }), 1_001, {
        maxUsagePercent: 100,
      });

      expect(result.status).to.equal('exceeded');
    });

    it('should allow a run that exactly consumes everything at 100 percent', async () => {
      const result = await checkApiBudget(stubConnection({ used: 9_000, limit: 10_000 }), 1_000, {
        maxUsagePercent: 100,
      });

      expect(result.status).to.equal('ok');
    });
  });
});

describe('apiBudgetError', () => {
  it('should name the planned count, the budget, and the flag', () => {
    const error = apiBudgetError(
      { status: 'exceeded', plannedRequests: 4_120, remaining: 8_240, limit: 15_000, budget: 1_648 },
      20,
    );

    expect(error.name).to.equal('ApiBudgetExceededError');
    expect(error.message).to.include('4,120');
    expect(error.message).to.include('1,648');
    expect(error.message).to.include('8,240');
    expect(error.message).to.include('--max-api-usage 20');
  });

  it('should explain differently when the run cannot finish at all', () => {
    const error = apiBudgetError(
      { status: 'exceeded', plannedRequests: 9_000, remaining: 800, limit: 15_000, budget: 160 },
      100,
    );

    expect(error.message).to.include('only 800 of the org');
    expect(error.message).to.include('15,000');
  });
});
