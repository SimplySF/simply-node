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
import { matchesAny } from '../src/matchesPath.js';

describe('matchesAny', () => {
  it('matches a literal path', () => {
    expect(matchesAny('.sfdevrc.json', ['.sfdevrc.json'])).toBe(true);
  });

  it('matches a glob pattern', () => {
    expect(matchesAny('config/foo.local.json', ['config/*.local.json'])).toBe(true);
  });

  it('matches a dotfile without an explicit leading-dot escape', () => {
    expect(matchesAny('.myrc.json', ['*.json'])).toBe(true);
  });

  it('does not match when no pattern applies', () => {
    expect(matchesAny('other.json', ['config/*.local.json', '.sfdevrc.json'])).toBe(false);
  });

  it('returns false for an empty pattern list', () => {
    expect(matchesAny('anything.json', [])).toBe(false);
  });
});
