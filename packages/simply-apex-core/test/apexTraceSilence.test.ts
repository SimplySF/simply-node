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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ApexTraceSilenceError,
  AT4DX_CLASSES,
  FFLIB_CLASSES,
  FORCE_DI_CLASSES,
  resolveClasses,
} from '../src/apexTraceSilence.js';

describe('resolveClasses', () => {
  let tmpFile: string | undefined;

  afterEach(() => {
    if (tmpFile) {
      fs.rmSync(tmpFile, { force: true });
      tmpFile = undefined;
    }
  });

  it('returns explicit class names as given', () => {
    expect(
      resolveClasses(['NoisyClass', 'ChattyTrigger'], undefined, { fflib: false, at4dx: false, forceDi: false }),
    ).toEqual(['NoisyClass', 'ChattyTrigger']);
  });

  it('combines explicit names with each preset, in order, and dedupes overlaps', () => {
    const result = resolveClasses(['NoisyClass', 'fflib_SObjectDescribe'], undefined, {
      fflib: true,
      at4dx: true,
      forceDi: false,
    });

    expect(result).toEqual(['NoisyClass', 'fflib_SObjectDescribe', 'fflib_SObjectDomain', ...AT4DX_CLASSES]);
  });

  it('adds every preset when all three are requested', () => {
    const result = resolveClasses([], undefined, { fflib: true, at4dx: true, forceDi: true });
    expect(result).toEqual([...FFLIB_CLASSES, ...AT4DX_CLASSES, ...FORCE_DI_CLASSES]);
  });

  it('reads class names from a classes-file', () => {
    tmpFile = path.join(os.tmpdir(), `simply-apex-silence-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ classes: ['FileClassOne', 'FileClassTwo'] }));

    const result = resolveClasses([], tmpFile, { fflib: false, at4dx: false, forceDi: false });
    expect(result).toEqual(['FileClassOne', 'FileClassTwo']);
  });

  it('throws ApexTraceSilenceError for a classes-file that fails schema validation', () => {
    tmpFile = path.join(os.tmpdir(), `simply-apex-silence-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ classes: [] }));

    expect(() => resolveClasses([], tmpFile, { fflib: false, at4dx: false, forceDi: false })).toThrow(
      ApexTraceSilenceError,
    );
  });

  it('returns an empty array when nothing is requested', () => {
    expect(resolveClasses([], undefined, { fflib: false, at4dx: false, forceDi: false })).toEqual([]);
  });
});
