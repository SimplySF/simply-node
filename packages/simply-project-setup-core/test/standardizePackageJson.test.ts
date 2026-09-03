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
import { standardizePackageJson } from '../src/standardizePackageJson.js';

describe('standardizePackageJson', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-project-setup-core-'));
    fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({ name: 'test-project' }, null, 2));
  });

  afterEach(() => {
    fs.rmSync(projectPath, { recursive: true, force: true });
  });

  const defaults = {
    private: true,
    type: 'module' as const,
    workspaces: ['./'],
    scripts: {
      prepare: 'husky',
      format: 'wireit',
      'test:unit': 'wireit',
    },
    featureScripts: {
      prettier: ['format'],
      jest: ['test:unit'],
    },
  };

  function readPjson(): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8')) as Record<string, unknown>;
  }

  it('writes private/type/workspaces and unconditional scripts', () => {
    const changed = standardizePackageJson({
      config: { include: ['core'], exclude: [], add: [] },
      defaults,
      projectPath,
    });

    const pjson = readPjson();
    expect(changed).toBe(true);
    expect(pjson.private).toBe(true);
    expect(pjson.type).toBe('module');
    expect(pjson.workspaces).toEqual(['./']);
    expect((pjson.scripts as Record<string, string>).prepare).toBe('husky');
  });

  it('includes a feature-gated script only when its feature is included', () => {
    standardizePackageJson({ config: { include: ['core', 'prettier'], exclude: [], add: [] }, defaults, projectPath });

    const pjson = readPjson();
    const scripts = pjson.scripts as Record<string, string>;
    expect(scripts.format).toBe('wireit');
    expect(scripts['test:unit']).toBeUndefined();
  });

  it('removes a previously-written feature-gated script once its feature is no longer included', () => {
    standardizePackageJson({
      config: { include: ['core', 'prettier', 'jest'], exclude: [], add: [] },
      defaults,
      projectPath,
    });
    standardizePackageJson({ config: { include: ['core'], exclude: [], add: [] }, defaults, projectPath });

    const pjson = readPjson();
    const scripts = pjson.scripts as Record<string, string>;
    expect(scripts.format).toBeUndefined();
    expect(scripts['test:unit']).toBeUndefined();
    expect(scripts.prepare).toBe('husky');
  });

  it('reports no change on a second run with the same config', () => {
    standardizePackageJson({ config: { include: ['core', 'prettier'], exclude: [], add: [] }, defaults, projectPath });
    const changed = standardizePackageJson({
      config: { include: ['core', 'prettier'], exclude: [], add: [] },
      defaults,
      projectPath,
    });

    expect(changed).toBe(false);
  });
});
