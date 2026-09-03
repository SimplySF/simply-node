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
import { writeDependencies } from '../src/writeDependencies.js';

describe('writeDependencies', () => {
  let tempRoot: string;
  let projectPath: string;
  let templatesPath: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-project-setup-core-'));
    projectPath = path.join(tempRoot, 'project');
    templatesPath = path.join(tempRoot, 'templates');
    fs.mkdirSync(projectPath, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  function writePjson(contents: Record<string, unknown>): void {
    fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify(contents, null, 2));
  }

  function readPjson(): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8')) as Record<string, unknown>;
  }

  function writeFeatureDeps(
    feature: string,
    deps: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> },
  ): void {
    fs.mkdirSync(path.join(templatesPath, feature), { recursive: true });
    fs.writeFileSync(path.join(templatesPath, feature, 'dependencies.json'), JSON.stringify(deps));
  }

  it('adds a new dependency that is not present yet', async () => {
    writePjson({ name: 'test-project' });
    writeFeatureDeps('eslint', { devDependencies: { eslint: '9.0.0' } });

    const changed = await writeDependencies({
      config: { include: ['eslint'], exclude: [], add: [] },
      templatesPath,
      projectPath,
    });

    expect(changed).toBe(true);
    expect((readPjson().devDependencies as Record<string, string>).eslint).toBe('^9.0.0');
  });

  it('leaves an existing version alone when it already meets the minimum', async () => {
    writePjson({ name: 'test-project', devDependencies: { eslint: '^9.5.0' } });
    writeFeatureDeps('eslint', { devDependencies: { eslint: '9.0.0' } });

    const changed = await writeDependencies({
      config: { include: ['eslint'], exclude: [], add: [] },
      templatesPath,
      projectPath,
    });

    expect(changed).toBe(false);
    expect((readPjson().devDependencies as Record<string, string>).eslint).toBe('^9.5.0');
  });

  it('replaces a pinned version below the minimum with an unpinned minimum', async () => {
    writePjson({ name: 'test-project', devDependencies: { eslint: '8.0.0' } });
    writeFeatureDeps('eslint', { devDependencies: { eslint: '9.0.0' } });

    const changed = await writeDependencies({
      config: { include: ['eslint'], exclude: [], add: [] },
      templatesPath,
      projectPath,
    });

    expect(changed).toBe(true);
    expect((readPjson().devDependencies as Record<string, string>).eslint).toBe('9.0.0');
  });

  it('upgrades a caret-ranged version below the minimum, keeping the caret', async () => {
    writePjson({ name: 'test-project', devDependencies: { eslint: '^8.0.0' } });
    writeFeatureDeps('eslint', { devDependencies: { eslint: '9.0.0' } });

    const changed = await writeDependencies({
      config: { include: ['eslint'], exclude: [], add: [] },
      templatesPath,
      projectPath,
    });

    expect(changed).toBe(true);
    expect((readPjson().devDependencies as Record<string, string>).eslint).toBe('^9.0.0');
  });

  it('leaves a non-semver version range alone', async () => {
    writePjson({ name: 'test-project', dependencies: { 'my-pkg': 'workspace:^' } });
    writeFeatureDeps('utam', { dependencies: { 'my-pkg': '1.0.0' } });

    const changed = await writeDependencies({
      config: { include: ['utam'], exclude: [], add: [] },
      templatesPath,
      projectPath,
    });

    expect(changed).toBe(false);
    expect((readPjson().dependencies as Record<string, string>)['my-pkg']).toBe('workspace:^');
  });

  it('tolerates a feature with no dependencies.json', async () => {
    writePjson({ name: 'test-project' });
    fs.mkdirSync(path.join(templatesPath, 'vscode'), { recursive: true });

    const changed = await writeDependencies({
      config: { include: ['vscode'], exclude: [], add: [] },
      templatesPath,
      projectPath,
    });

    expect(changed).toBe(false);
  });
});
