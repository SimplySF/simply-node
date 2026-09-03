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
import { describe, it, expect, afterEach } from 'vitest';
import { exists } from '../src/exists.js';

describe('exists', () => {
  let tempFile: string | undefined;

  afterEach(() => {
    if (tempFile) {
      fs.rmSync(tempFile, { force: true });
      tempFile = undefined;
    }
  });

  it('returns true for a file that exists', () => {
    tempFile = path.join(os.tmpdir(), `simply-project-setup-core-exists-${Date.now()}.txt`);
    fs.writeFileSync(tempFile, 'x');
    expect(exists(tempFile)).toBe(true);
  });

  it('returns false for a path that does not exist', () => {
    expect(exists(path.join(os.tmpdir(), 'does-not-exist-simply-project-setup-core'))).toBe(false);
  });
});
