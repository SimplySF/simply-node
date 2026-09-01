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
import { DATE_TIME_PATTERN, parseOnBehalfOf } from '../src/apexTraceSetup.js';

describe('parseOnBehalfOf', () => {
  it('parses a Field:Value pair', () => {
    expect(parseOnBehalfOf('Username:someuser@example.com')).toEqual({
      field: 'Username',
      value: 'someuser@example.com',
    });
  });

  it('allows a colon within the value', () => {
    expect(parseOnBehalfOf('FederationIdentifier:123:456')).toEqual({
      field: 'FederationIdentifier',
      value: '123:456',
    });
  });

  it('returns undefined for input with no colon', () => {
    expect(parseOnBehalfOf('not-a-pair')).toBeUndefined();
  });

  it('returns undefined when the field starts with a digit', () => {
    expect(parseOnBehalfOf('1Field:value')).toBeUndefined();
  });
});

describe('DATE_TIME_PATTERN', () => {
  it('matches a valid ISO 8601 UTC date-time', () => {
    expect(DATE_TIME_PATTERN.test('2026-08-18T14:30:00Z')).toBe(true);
  });

  it('matches with fractional seconds', () => {
    expect(DATE_TIME_PATTERN.test('2026-08-18T14:30:00.123Z')).toBe(true);
  });

  it('rejects a date without a time component', () => {
    expect(DATE_TIME_PATTERN.test('2026-08-18')).toBe(false);
  });

  it('rejects a date-time without the trailing Z', () => {
    expect(DATE_TIME_PATTERN.test('2026-08-18T14:30:00')).toBe(false);
  });
});
