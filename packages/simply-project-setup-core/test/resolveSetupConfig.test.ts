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

import { describe, it, expect } from 'vitest';
import { resolveSetupConfig } from '../src/resolveSetupConfig.js';
import { SetupConfig } from '../src/types.js';

const baseConfig: SetupConfig = { include: ['core'], exclude: [], add: [], banned: [] };

describe('resolveSetupConfig', () => {
  it('returns the base config unchanged when nothing overrides it', () => {
    const config = resolveSetupConfig({ flags: {}, baseConfig });
    expect(config.include).toEqual(['core']);
  });

  it('applies localOverrides include/exclude before a preset or flags', () => {
    const config = resolveSetupConfig({
      flags: {},
      baseConfig,
      localOverrides: { include: ['vscode'], exclude: ['core'] },
    });
    expect(config.include).toEqual(['vscode']);
  });

  it('a matched preset replaces include and short-circuits boolean flags', () => {
    const config = resolveSetupConfig({
      flags: { preset: 'hrm', eslint: false },
      baseConfig,
      presets: { hrm: ['core', 'eslint', 'jest'] },
      booleanFeatures: ['eslint'],
    });
    expect(config.include).toEqual(['core', 'eslint', 'jest']);
  });

  it('an unmatched preset name still short-circuits boolean flags, leaving include unchanged', () => {
    const config = resolveSetupConfig({
      flags: { preset: 'nonexistent', eslint: true },
      baseConfig,
      presets: { hrm: ['core'] },
      booleanFeatures: ['eslint'],
    });
    expect(config.include).toEqual(['core']);
  });

  it('a true boolean flag adds the feature and a false flag removes it', () => {
    const config = resolveSetupConfig({
      flags: { eslint: true, core: false },
      baseConfig,
      booleanFeatures: ['eslint', 'core'],
    });
    expect(config.include).toEqual(['eslint']);
  });

  it('respects a custom preset flag name', () => {
    const config = resolveSetupConfig({
      flags: { template: 'hrm' },
      baseConfig,
      presets: { hrm: ['core', 'jest'] },
      presetFlagName: 'template',
    });
    expect(config.include).toEqual(['core', 'jest']);
  });

  it('adds the package-json feature id once a dependent feature is included', () => {
    const config = resolveSetupConfig({
      flags: { eslint: true },
      baseConfig,
      booleanFeatures: ['eslint'],
      dependentFeatures: ['eslint'],
    });
    expect(config.include).toContain('package-json');
  });

  it('removes the package-json feature id when no dependent feature is included', () => {
    const config = resolveSetupConfig({
      flags: {},
      baseConfig: { include: ['core', 'package-json'], exclude: [], add: [] },
      dependentFeatures: ['eslint'],
    });
    expect(config.include).not.toContain('package-json');
  });

  it('uses a custom package-json feature id', () => {
    const config = resolveSetupConfig({
      flags: { jest: true },
      baseConfig,
      booleanFeatures: ['jest'],
      dependentFeatures: ['jest'],
      packageJsonFeatureId: 'pjson',
    });
    expect(config.include).toContain('pjson');
  });
});
