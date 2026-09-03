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
import { findSfdevrcPath, loadSfdevrc } from '../src/loadSfdevrc.js';

describe('loadSfdevrc / findSfdevrcPath', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-project-setup-core-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('returns undefined when no .sfdevrc.json is found', () => {
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-project-setup-core-isolated-'));
    try {
      expect(findSfdevrcPath(isolated)).toBeUndefined();
      expect(loadSfdevrc(isolated)).toBeUndefined();
    } finally {
      fs.rmSync(isolated, { recursive: true, force: true });
    }
  });

  it('finds, reads, and validates an existing .sfdevrc.json', () => {
    fs.writeFileSync(path.join(tempRoot, '.sfdevrc.json'), JSON.stringify({ jiraProjectKey: 'ABC' }));
    expect(findSfdevrcPath(tempRoot)).toBe(path.join(tempRoot, '.sfdevrc.json'));
    expect(loadSfdevrc(tempRoot)).toEqual({ jiraProjectKey: 'ABC' });
  });

  it('walks up through ancestor directories', () => {
    fs.writeFileSync(path.join(tempRoot, '.sfdevrc.json'), JSON.stringify({}));
    const nested = path.join(tempRoot, 'a', 'b');
    fs.mkdirSync(nested, { recursive: true });
    expect(loadSfdevrc(nested)).toEqual({});
  });

  it('throws on invalid JSON', () => {
    fs.writeFileSync(path.join(tempRoot, '.sfdevrc.json'), '{not valid json');
    expect(() => loadSfdevrc(tempRoot)).toThrow(/Failed to parse/);
  });

  it('throws when the contents fail schema validation', () => {
    fs.writeFileSync(path.join(tempRoot, '.sfdevrc.json'), JSON.stringify({ notAField: true }));
    expect(() => loadSfdevrc(tempRoot)).toThrow(/Invalid/);
  });
});
