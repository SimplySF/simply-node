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

import { describe, it, expect } from 'vitest';
import { mergeJsonPreservingTarget } from '../src/mergeJson.js';

describe('mergeJsonPreservingTarget', () => {
  it('keeps the target scalar when both sides have the key', () => {
    expect(mergeJsonPreservingTarget({ a: 1 }, { a: 2 })).toStrictEqual({ a: 2 });
  });

  it('adds a key present only in the template', () => {
    expect(mergeJsonPreservingTarget({ a: 1, b: 2 }, { a: 9 })).toStrictEqual({ a: 9, b: 2 });
  });

  it('leaves a key present only in the target untouched', () => {
    expect(mergeJsonPreservingTarget({ a: 1 }, { a: 1, c: 3 })).toStrictEqual({ a: 1, c: 3 });
  });

  it('recurses into nested objects present on both sides', () => {
    expect(mergeJsonPreservingTarget({ nested: { a: 1, b: 2 } }, { nested: { a: 9 } })).toStrictEqual({
      nested: { a: 9, b: 2 },
    });
  });

  it('replaces the template array outright with the target array, no element-wise merge', () => {
    expect(mergeJsonPreservingTarget({ list: [1, 2, 3] }, { list: [9] })).toStrictEqual({ list: [9] });
  });

  it('resolves a type mismatch (template object, target scalar) to the target value outright', () => {
    expect(mergeJsonPreservingTarget({ a: { nested: true } }, { a: 'scalar' })).toStrictEqual({ a: 'scalar' });
  });

  it('resolves a type mismatch (template scalar, target object) to the target value outright', () => {
    expect(mergeJsonPreservingTarget({ a: 'scalar' }, { a: { nested: true } })).toStrictEqual({ a: { nested: true } });
  });

  it('returns the target outright when either side is not a plain object', () => {
    expect(mergeJsonPreservingTarget([1, 2], { a: 1 })).toStrictEqual({ a: 1 });
    expect(mergeJsonPreservingTarget({ a: 1 }, 'not-an-object')).toBe('not-an-object');
  });
});
