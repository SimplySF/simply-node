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

import { Duration } from '@salesforce/kit';

export type RetryWithBackoffOptions = {
  /** How many additional attempts to make after the first one fails. `0` disables retrying. */
  retryAttempts: number;
  /** Multiplier applied to the delay between each successive retry (e.g. `2` doubles it each time). */
  backoffFactor: number;
  /** Delay before the first retry. Defaults to 1 second. */
  initialDelay?: Duration;
};

/**
 * Calls `fn`, retrying on failure up to `options.retryAttempts` additional times with an
 * exponentially growing delay between attempts, before rethrowing the last error.
 *
 * @param fn - The operation to attempt.
 * @param options - Retry attempt count and backoff configuration.
 * @param attempt - The current attempt number, `0`-indexed. Used internally for recursion.
 * @returns The result of `fn` once it succeeds.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryWithBackoffOptions,
  attempt = 0,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (attempt >= options.retryAttempts) {
      throw err;
    }

    const initialDelay = options.initialDelay ?? Duration.seconds(1);
    const delay = initialDelay.milliseconds * options.backoffFactor ** attempt;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delay);
    });

    return retryWithBackoff(fn, options, attempt + 1);
  }
}
