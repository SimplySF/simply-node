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
import { blankToUndefined, toBoolean } from '../src/schemaGenerateUtils.js';

describe('toBoolean', () => {
  it('returns undefined for undefined', () => {
    expect(toBoolean(undefined)).to.be.undefined;
  });

  it('returns undefined for an empty string', () => {
    expect(toBoolean('')).to.be.undefined;
  });

  it('passes a real boolean through unchanged', () => {
    expect(toBoolean(true)).to.equal(true);
    expect(toBoolean(false)).to.equal(false);
  });

  it('coerces the string "true" (case-insensitive) to true', () => {
    expect(toBoolean('true')).to.equal(true);
    expect(toBoolean('TRUE')).to.equal(true);
    expect(toBoolean('True')).to.equal(true);
  });

  it('coerces any other non-empty string to false', () => {
    expect(toBoolean('false')).to.equal(false);
    expect(toBoolean('no')).to.equal(false);
    expect(toBoolean('1')).to.equal(false);
  });

  it('coerces a number via its string form', () => {
    expect(toBoolean(1)).to.equal(false);
  });
});

describe('blankToUndefined', () => {
  it('returns undefined for an empty string', () => {
    expect(blankToUndefined('')).to.be.undefined;
  });

  it('returns undefined for undefined', () => {
    expect(blankToUndefined(undefined)).to.be.undefined;
  });

  it('returns a non-blank string unchanged', () => {
    expect(blankToUndefined('hello')).to.equal('hello');
  });
});
