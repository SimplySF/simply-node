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
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadRootPath } from '../src/loadRootPath.js';

describe('loadRootPath', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-project-setup-core-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('finds the marker file in the starting directory', () => {
    fs.writeFileSync(path.join(tempRoot, 'package.json'), '{}');
    expect(loadRootPath('package.json', tempRoot)).toBe(tempRoot);
  });

  it('walks up through ancestor directories to find the marker file', () => {
    fs.writeFileSync(path.join(tempRoot, 'package.json'), '{}');
    const nested = path.join(tempRoot, 'a', 'b', 'c');
    fs.mkdirSync(nested, { recursive: true });
    expect(loadRootPath('package.json', nested)).toBe(tempRoot);
  });

  it('throws when the marker file is never found', () => {
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-project-setup-core-isolated-'));
    try {
      expect(() => loadRootPath('nonexistent-marker-file.json', isolated)).toThrow();
    } finally {
      fs.rmSync(isolated, { recursive: true, force: true });
    }
  });
});
