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

import { Connection, SfError } from '@salesforce/core';
import { describe, expect, it, vi } from 'vitest';
import { assertApiBudget, DEFAULT_MAX_API_USAGE } from '../../src/common/apiBudgetFlag.js';

/**
 * @param apiUsage - Value for `connection.limitInfo.apiUsage`.
 * @returns A connection stub whose limits API always fails, so only the header path is exercised.
 */
function stubConnection(apiUsage: { used: number; limit: number }): Connection {
  return {
    limitInfo: { apiUsage },
    limits: () => Promise.reject(new Error('nope')),
  } as unknown as Connection;
}

describe('assertApiBudget', () => {
  it('should default to 20 percent', () => {
    expect(DEFAULT_MAX_API_USAGE).to.equal(20);
  });

  it('should return the result and not warn when the run fits', async () => {
    const warn = vi.fn();
    const result = await assertApiBudget(stubConnection({ used: 0, limit: 10_000 }), 100, 20, warn);

    expect(result.status).to.equal('ok');
    expect(warn).not.toHaveBeenCalled();
  });

  it('should throw when the run exceeds its budget', async () => {
    await expect(assertApiBudget(stubConnection({ used: 9_000, limit: 10_000 }), 500, 20, vi.fn())).rejects.toThrow(
      /needs 500 API requests/,
    );
  });

  it('should throw an SfError carrying the budget error name', async () => {
    try {
      await assertApiBudget(stubConnection({ used: 9_000, limit: 10_000 }), 500, 20, vi.fn());
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as SfError).name).to.equal('ApiBudgetExceededError');
    }
  });

  it('should warn and continue when the allocation cannot be read', async () => {
    const warn = vi.fn();
    const connection = {
      limitInfo: {},
      limits: () => Promise.reject(new Error('INSUFFICIENT_ACCESS')),
    } as unknown as Connection;

    const result = await assertApiBudget(connection, 5_000, 20, warn);

    expect(result.status).to.equal('unavailable');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).to.include('INSUFFICIENT_ACCESS');
  });
});
