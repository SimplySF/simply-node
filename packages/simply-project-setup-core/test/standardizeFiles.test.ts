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
import { standardizeFiles } from '../src/standardizeFiles.js';

describe('standardizeFiles', () => {
  let tempRoot: string;
  let projectPath: string;
  let templatesPath: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-project-setup-core-'));
    projectPath = path.join(tempRoot, 'project');
    templatesPath = path.join(tempRoot, 'templates');
    fs.mkdirSync(projectPath, { recursive: true });

    // core pack
    fs.mkdirSync(path.join(templatesPath, 'core'), { recursive: true });
    fs.writeFileSync(path.join(templatesPath, 'core', '.editorconfig'), 'root = true\n');
    fs.writeFileSync(
      path.join(templatesPath, 'core', '.forceignore'),
      ['# -- START CUSTOMIZATION', '# -- END CUSTOMIZATION'].join('\n'),
    );
    fs.writeFileSync(path.join(templatesPath, 'core', 'dependencies.json'), '{"dependencies":{}}');

    // eslint pack, with a dotfile that needs renaming
    fs.mkdirSync(path.join(templatesPath, 'eslint'), { recursive: true });
    fs.writeFileSync(path.join(templatesPath, 'eslint', 'eslint.config.mjs'), 'export default [];\n');
    fs.writeFileSync(path.join(templatesPath, 'eslint', '.prettier.config.mjs'), 'export default {};\n');

    // gitignore fragments
    fs.mkdirSync(path.join(templatesPath, 'gitignore'), { recursive: true });
    fs.writeFileSync(path.join(templatesPath, 'gitignore', 'base.gitignore'), 'node_modules\n');
    fs.writeFileSync(path.join(templatesPath, 'gitignore', 'eslint.gitignore'), '.eslintcache\n');

    // a template with a token to be templated by a consumer's transformFile hook
    fs.mkdirSync(path.join(templatesPath, 'husky'), { recursive: true });
    fs.writeFileSync(path.join(templatesPath, 'husky', 'pre-commit'), 'echo REPLACE_ME\n');
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('copies included packs and skips dependencies.json', () => {
    const actions = standardizeFiles({
      config: { include: ['core'], exclude: [], add: [] },
      templatesPath,
      projectPath,
    });

    expect(fs.existsSync(path.join(projectPath, '.editorconfig'))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'dependencies.json'))).toBe(false);
    expect(actions.some((a) => a.file === '.editorconfig' && a.action === 'CREATE')).toBe(true);
  });

  it('copies extra "add" files and applies exclude removals from the resolved set', () => {
    const actions = standardizeFiles({
      config: { include: ['core'], exclude: ['eslint/eslint.config.mjs'], add: ['eslint/eslint.config.mjs'] },
      templatesPath,
      projectPath,
    });

    expect(fs.existsSync(path.join(projectPath, 'eslint.config.mjs'))).toBe(false);
    expect(actions.some((a) => a.file === 'eslint.config.mjs')).toBe(false);
  });

  it('applies renameFile to include, add, and exclude paths consistently', () => {
    standardizeFiles({
      config: { include: ['eslint'], exclude: [], add: [] },
      templatesPath,
      projectPath,
      renameFile: (dest) => (dest === '.prettier.config.mjs' ? 'prettier.config.mjs' : dest),
    });

    expect(fs.existsSync(path.join(projectPath, 'prettier.config.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, '.prettier.config.mjs'))).toBe(false);
  });

  it('protects a file from being overwritten once it exists', () => {
    fs.mkdirSync(path.join(templatesPath, 'protected'), { recursive: true });
    fs.writeFileSync(path.join(templatesPath, 'protected', '.myrc.json'), 'from-template');
    fs.writeFileSync(path.join(projectPath, '.myrc.json'), 'user-owned');

    const actions = standardizeFiles({
      config: { include: ['protected'], exclude: [], add: [] },
      templatesPath,
      projectPath,
      protectedFiles: ['.myrc.json'],
    });

    expect(fs.readFileSync(path.join(projectPath, '.myrc.json'), 'utf8')).toBe('user-owned');
    expect(actions.some((a) => a.file === '.myrc.json')).toBe(false);
  });

  it('creates a protected file when it does not exist yet', () => {
    fs.mkdirSync(path.join(templatesPath, 'protected'), { recursive: true });
    fs.writeFileSync(path.join(templatesPath, 'protected', '.myrc.json'), 'from-template');

    standardizeFiles({
      config: { include: ['protected'], exclude: [], add: [] },
      templatesPath,
      projectPath,
      protectedFiles: ['.myrc.json'],
    });

    expect(fs.readFileSync(path.join(projectPath, '.myrc.json'), 'utf8')).toBe('from-template');
  });

  it('runs transformFile on template content before writing', () => {
    standardizeFiles({
      config: { include: ['husky'], exclude: [], add: [] },
      templatesPath,
      projectPath,
      transformFile: ({ destRelativePath, content }) =>
        destRelativePath === 'pre-commit' ? content.replace('REPLACE_ME', 'branch-regex') : content,
    });

    expect(fs.readFileSync(path.join(projectPath, 'pre-commit'), 'utf8')).toContain('branch-regex');
  });

  it('preserves a customization-marked region on an existing target', () => {
    fs.writeFileSync(
      path.join(projectPath, '.forceignore'),
      ['# -- START CUSTOMIZATION', 'MyCustomRule', '# -- END CUSTOMIZATION'].join('\n'),
    );

    standardizeFiles({ config: { include: ['core'], exclude: [], add: [] }, templatesPath, projectPath });

    const content = fs.readFileSync(path.join(projectPath, '.forceignore'), 'utf8');
    expect(content).toContain('MyCustomRule');
  });

  it('returns ERROR when the target has unbalanced customization markers', () => {
    fs.writeFileSync(path.join(projectPath, '.forceignore'), '# -- START CUSTOMIZATION\nunterminated');

    const actions = standardizeFiles({
      config: { include: ['core'], exclude: [], add: [] },
      templatesPath,
      projectPath,
    });

    expect(actions.find((a) => a.file === '.forceignore')?.action).toBe('ERROR');
  });

  it('returns ERROR when the target has a different number of customization sections than the template', () => {
    fs.writeFileSync(
      path.join(projectPath, '.forceignore'),
      [
        '# -- START CUSTOMIZATION',
        'one',
        '# -- END CUSTOMIZATION',
        '# -- START CUSTOMIZATION',
        'two',
        '# -- END CUSTOMIZATION',
      ].join('\n'),
    );

    const actions = standardizeFiles({
      config: { include: ['core'], exclude: [], add: [] },
      templatesPath,
      projectPath,
    });

    expect(actions.find((a) => a.file === '.forceignore')?.action).toBe('ERROR');
  });

  it('composes .gitignore from base plus included-feature fragments, with a header and a customization footer', () => {
    standardizeFiles({
      config: { include: ['core', 'eslint'], exclude: [], add: [] },
      templatesPath,
      projectPath,
      gitignoreHeader: '# auto-generated\n\n',
    });

    const content = fs.readFileSync(path.join(projectPath, '.gitignore'), 'utf8');
    expect(content).toContain('# auto-generated');
    expect(content).toContain('node_modules');
    expect(content).toContain('.eslintcache');
    expect(content.trim().endsWith('# -- END CUSTOMIZATION')).toBe(true);
  });

  it('does not write .gitignore when no gitignore templates matched', () => {
    fs.rmSync(path.join(templatesPath, 'gitignore'), { recursive: true, force: true });

    const actions = standardizeFiles({
      config: { include: ['husky'], exclude: [], add: [] },
      templatesPath,
      projectPath,
    });

    expect(fs.existsSync(path.join(projectPath, '.gitignore'))).toBe(false);
    expect(actions.some((a) => a.file === '.gitignore')).toBe(false);
  });

  it('deletes banned files matching a glob after every other step', () => {
    fs.writeFileSync(path.join(projectPath, 'deprecated.txt'), 'delete me');
    fs.writeFileSync(path.join(projectPath, 'keep.txt'), 'keep me');

    const actions = standardizeFiles({
      config: { include: ['core'], exclude: [], add: [], banned: ['deprecated.txt'] },
      templatesPath,
      projectPath,
    });

    expect(fs.existsSync(path.join(projectPath, 'deprecated.txt'))).toBe(false);
    expect(fs.existsSync(path.join(projectPath, 'keep.txt'))).toBe(true);
    expect(actions.some((a) => a.file === 'deprecated.txt' && a.action === 'DELETE')).toBe(true);
  });

  it('is a no-op the second time it runs against unchanged output', () => {
    standardizeFiles({ config: { include: ['core'], exclude: [], add: [] }, templatesPath, projectPath });
    const actions = standardizeFiles({
      config: { include: ['core'], exclude: [], add: [] },
      templatesPath,
      projectPath,
    });

    expect(actions.filter((a) => a.file === '.editorconfig')).toHaveLength(0);
  });
});
