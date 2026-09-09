/*
 * Copyright (c) 2026, SimplySF.
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

/**
 * Split an array into consecutive chunks of at most `size` elements.
 *
 * Salesforce work is full of batch limits — how many IDs fit in a `WHERE Id IN (...)` clause
 * before the query gets too long, how many records the Tooling API will delete in one call — and
 * each of those limits ends up as the same hand-written index loop. This is that loop, once.
 *
 * @param items - The items to split. Not mutated.
 * @param size - Maximum number of items per chunk. Must be at least 1.
 * @returns The chunks, in order. Empty if `items` is empty.
 * @throws {SfError} If `size` is less than 1.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new SfError(`Chunk size must be a positive integer, but was ${size}.`, 'InvalidChunkSizeError');
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

/**
 * Map over `items` in chunks: every item within a chunk is processed concurrently, but one chunk
 * finishes before the next one starts.
 *
 * Use this to bound concurrency against an org — firing hundreds of `describe()` calls at once
 * gets you rate-limited, while doing them one at a time is needlessly slow. Chunking gives a
 * fixed-width window without pulling in a queue library.
 *
 * @param items - The items to map over.
 * @param size - Maximum number of items processed concurrently. Must be at least 1.
 * @param mapper - Called once per item, with the item and its index in `items`.
 * @returns Every mapper result, in `items` order (not completion order).
 * @throws {SfError} If `size` is less than 1.
 */
export async function mapChunked<T, R>(
  items: readonly T[],
  size: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let offset = 0;

  for (const batch of chunk(items, size)) {
    const batchOffset = offset;
    // eslint-disable-next-line no-await-in-loop -- chunks run sequentially on purpose; that's the concurrency bound
    const batchResults = await Promise.all(batch.map((item, index) => mapper(item, batchOffset + index)));
    results.push(...batchResults);
    offset += batch.length;
  }

  return results;
}
