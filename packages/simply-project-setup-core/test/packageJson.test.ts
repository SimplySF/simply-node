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
import { PackageJson } from '../src/packageJson.js';

describe('PackageJson', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-project-setup-core-'));
  });

  afterEach(() => {
    fs.rmSync(projectPath, { recursive: true, force: true });
  });

  it('starts from a minimal contents object when package.json does not exist yet', () => {
    const pjson = new PackageJson(projectPath);
    expect(pjson.contents.name).toBe(path.basename(projectPath));
  });

  it('reads existing contents when package.json exists', () => {
    fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({ name: 'existing-project' }));
    const pjson = new PackageJson(projectPath);
    expect(pjson.contents.name).toBe('existing-project');
  });

  it('get fills in and returns a default value when the property is missing', () => {
    const pjson = new PackageJson(projectPath);
    expect(pjson.get('scripts', { build: 'noop' })).toEqual({ build: 'noop' });
    expect(pjson.contents.scripts).toEqual({ build: 'noop' });
  });

  it('get throws without a property name', () => {
    const pjson = new PackageJson(projectPath);
    expect(() => pjson.get('', {})).toThrow();
  });

  it('write does nothing when contents are unchanged from what was read', () => {
    fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({ name: 'test' }, null, 2) + '\n');
    const before = fs.statSync(path.join(projectPath, 'package.json')).mtimeMs;
    const pjson = new PackageJson(projectPath);
    pjson.write();
    const after = fs.statSync(path.join(projectPath, 'package.json')).mtimeMs;
    expect(after).toBe(before);
  });

  it('write persists changes and orders scripts/dependencies/devDependencies keys', () => {
    const pjson = new PackageJson(projectPath);
    pjson.contents.scripts = { z: '1', a: '2' };
    pjson.contents.dependencies = { z: '1', a: '2' };
    pjson.write();

    const written = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(Object.keys(written.scripts)).toEqual(['a', 'z']);
    expect(Object.keys(written.dependencies)).toEqual(['a', 'z']);
  });
});
