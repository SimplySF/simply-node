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

import { SfError } from '@salesforce/core';

/** A result still being computed, tagged with its position in the source so it can be matched back up. */
type IndexedResult<R> = { index: number; result: R };

/**
 * Get the next item from either an async or sync iterator, presenting one interface regardless of
 * which kind `source` turned out to be.
 *
 * @param iterator - The source iterator.
 * @returns The iterator's next result, awaited if it was a promise.
 */
async function nextItem<T>(iterator: AsyncIterator<T> | Iterator<T>): Promise<IteratorResult<T>> {
  return iterator.next();
}

/**
 * Map over `source` with at most `concurrency` calls to `mapper` in flight at once, starting the
 * next item the instant a slot frees up rather than waiting for sibling items pulled at the same
 * time to finish too.
 *
 * This is the streaming counterpart to {@link mapChunked}: `mapChunked` requires the full input as
 * an in-memory array and advances in fixed-size, wait-for-the-whole-batch steps, which is right for
 * bounding concurrency against an already-loaded list. `mapConcurrent` instead consumes `source`
 * lazily — one item at a time, only as pool slots come free — so a huge source (e.g. rows streamed
 * from a large CSV) never has to be fully buffered in memory, and a pool slot doesn't sit idle
 * waiting on the slowest item in an arbitrary batch.
 *
 * Results are yielded in **completion order, not source order** — whichever `mapper` call finishes
 * first is yielded first. Callers that need source order should use {@link mapChunked} (or sort the
 * results themselves, if `T`/`R` carry an index).
 *
 * `mapper` is expected not to reject: this stays a plain concurrency pool, not an error-handling
 * layer, so a rejection propagates out of this generator immediately (ending iteration) rather than
 * being caught, retried, or turned into a result. A caller that wants a run to continue past
 * individual failures should have `mapper` catch its own errors and resolve with a result that
 * represents them.
 *
 * @param source - The items to map over, pulled lazily.
 * @param concurrency - Maximum number of `mapper` calls in flight at once. Must be at least 1.
 * @param mapper - Called once per item, as soon as a pool slot is free for it.
 * @yields Each `mapper` result, in completion order.
 * @throws {SfError} If `concurrency` is less than 1.
 */
export async function* mapConcurrent<T, R>(
  source: AsyncIterable<T> | Iterable<T>,
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): AsyncGenerator<R> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new SfError(`Concurrency must be a positive integer, but was ${concurrency}.`, 'InvalidConcurrencyError');
  }

  const asyncSource = source as AsyncIterable<T>;
  const iterator: AsyncIterator<T> | Iterator<T> =
    typeof asyncSource[Symbol.asyncIterator] === 'function'
      ? asyncSource[Symbol.asyncIterator]()
      : (source as Iterable<T>)[Symbol.iterator]();

  let sourceExhausted = false;
  let nextIndex = 0;
  const inFlight = new Map<number, Promise<IndexedResult<R>>>();

  /**
   * Pull one more item from `source`, if any remain, and start `mapper` on it.
   *
   * @returns Whether an item was pulled.
   */
  async function fillOneSlot(): Promise<boolean> {
    if (sourceExhausted) {
      return false;
    }

    const next = await nextItem(iterator);

    if (next.done) {
      sourceExhausted = true;
      return false;
    }

    const index = nextIndex++;
    inFlight.set(
      index,
      mapper(next.value).then((result) => ({ index, result })),
    );

    return true;
  }

  for (let slot = 0; slot < concurrency; slot++) {
    // eslint-disable-next-line no-await-in-loop -- filling the initial pool is inherently sequential (each pull decides whether the next is worth starting)
    if (!(await fillOneSlot())) {
      break;
    }
  }

  while (inFlight.size > 0) {
    // eslint-disable-next-line no-await-in-loop -- each iteration must observe the previous one's winner before racing again
    const { index, result } = await Promise.race(inFlight.values());
    inFlight.delete(index);

    yield result;

    // eslint-disable-next-line no-await-in-loop -- keeping the pool full is the point; this is not a bottleneck around other in-flight work
    await fillOneSlot();
  }
}
