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
import { semverIsLessThan } from '../src/semver.js';

describe('semverIsLessThan', () => {
  it('is true when the major version is lower', () => {
    expect(semverIsLessThan('1.0.0', '2.0.0')).toBe(true);
  });

  it('is true when major is equal and minor is lower', () => {
    expect(semverIsLessThan('1.1.0', '1.2.0')).toBe(true);
  });

  it('is true when major and minor are equal and patch is lower', () => {
    expect(semverIsLessThan('1.1.1', '1.1.2')).toBe(true);
  });

  it('is false when the versions are equal', () => {
    expect(semverIsLessThan('1.2.3', '1.2.3')).toBe(false);
  });

  it('is false when the version is greater', () => {
    expect(semverIsLessThan('2.0.0', '1.9.9')).toBe(false);
  });
});
