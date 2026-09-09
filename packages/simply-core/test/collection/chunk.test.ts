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

import { describe, expect, it } from 'vitest';
import { chunk, mapChunked } from '../../src/collection/chunk.js';

describe('chunk', () => {
  it('splits an array into consecutive chunks of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5, 6], 2)).to.deep.equal([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('leaves the trailing chunk short when the length is not a multiple of the size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).to.deep.equal([[1, 2], [3, 4], [5]]);
  });

  it('returns a single chunk when the size exceeds the length', () => {
    expect(chunk([1, 2], 10)).to.deep.equal([[1, 2]]);
  });

  it('returns no chunks for an empty array', () => {
    expect(chunk([], 5)).to.deep.equal([]);
  });

  it('does not mutate the source array', () => {
    const items = [1, 2, 3];
    chunk(items, 2);
    expect(items).to.deep.equal([1, 2, 3]);
  });

  it('throws for a size below 1', () => {
    expect(() => chunk([1, 2, 3], 0)).to.throw('Chunk size must be a positive integer');
  });

  it('throws for a non-integer size', () => {
    expect(() => chunk([1, 2, 3], 1.5)).to.throw('Chunk size must be a positive integer');
  });
});

describe('mapChunked', () => {
  it('returns results in source order, not completion order', async () => {
    const results = await mapChunked([30, 10, 20], 3, async (delay) => {
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
      return delay;
    });

    expect(results).to.deep.equal([30, 10, 20]);
  });

  it('passes each item its index in the source array, across chunk boundaries', async () => {
    const seen: Array<[string, number]> = [];

    await mapChunked(['a', 'b', 'c', 'd', 'e'], 2, async (item, index) => {
      seen.push([item, index]);
    });

    expect(seen).to.deep.equal([
      ['a', 0],
      ['b', 1],
      ['c', 2],
      ['d', 3],
      ['e', 4],
    ]);
  });

  it('runs a chunk concurrently but waits for it before starting the next', async () => {
    const inFlight: number[] = [];
    let concurrent = 0;

    await mapChunked([1, 2, 3, 4, 5], 2, async (item) => {
      concurrent++;
      inFlight.push(concurrent);
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      concurrent--;
      return item;
    });

    expect(Math.max(...inFlight)).to.equal(2);
  });

  it('returns an empty array for no items', async () => {
    expect(await mapChunked([], 3, () => Promise.resolve('never'))).to.deep.equal([]);
  });

  it('rejects when a mapper rejects', async () => {
    await expect(
      mapChunked([1, 2], 2, (item) => (item === 2 ? Promise.reject(new Error('boom')) : Promise.resolve(item))),
    ).rejects.toThrow('boom');
  });
});
