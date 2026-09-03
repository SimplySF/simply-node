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

import { Sfdevrc } from './sfdevrcSchema.js';
import { ResolveSetupConfigOptions, SetupConfig } from './types.js';

function applySfdevrc(config: SetupConfig, sfdevrc: Sfdevrc | undefined): void {
  if (sfdevrc?.setup) {
    const { setup } = sfdevrc;
    if (setup.exclude) {
      config.include = config.include.filter((f) => !setup.exclude?.includes(f));
    }
    if (setup.include) {
      config.include = [...new Set([...config.include, ...setup.include])];
    }
  }
}

function applyPreset(
  config: SetupConfig,
  presets: Record<string, string[]> | undefined,
  preset: string | undefined,
): boolean /* preset applied */ {
  if (preset) {
    const presetIncludes = presets?.[preset];
    if (presetIncludes) {
      config.include = [...presetIncludes];
    }
    return true;
  }
  return false;
}

function applyBooleanFlags(
  config: SetupConfig,
  flags: Record<string, boolean | string | undefined>,
  booleanFeatures: string[],
): void {
  for (const feature of booleanFeatures) {
    if (flags[feature] === false) {
      config.include = config.include.filter((f) => f !== feature);
    }
    if (flags[feature] === true && !config.include.includes(feature)) {
      config.include.push(feature);
    }
  }
}

/**
 * Resolves the feature list a setup run should apply from a base config, a project-local config
 * file's overrides, a named preset, and boolean CLI flags — in that precedence order. See this
 * package's README for the full resolution rules and an end-to-end example.
 */
export function resolveSetupConfig(options: ResolveSetupConfigOptions): SetupConfig {
  const {
    flags,
    sfdevrc,
    baseConfig,
    presets,
    booleanFeatures = [],
    presetFlagName = 'preset',
    dependentFeatures = [],
    packageJsonFeatureId = 'package-json',
  } = options;

  const config: SetupConfig = {
    include: [...baseConfig.include],
    exclude: [...baseConfig.exclude],
    add: [...baseConfig.add],
    banned: baseConfig.banned ? [...baseConfig.banned] : [],
  };

  applySfdevrc(config, sfdevrc);

  const presetApplied = applyPreset(config, presets, flags[presetFlagName] as string | undefined);

  if (!presetApplied) {
    applyBooleanFlags(config, flags, booleanFeatures);
  }

  const needsPackageJson = config.include.some((f) => dependentFeatures.includes(f));

  if (needsPackageJson) {
    if (!config.include.includes(packageJsonFeatureId)) {
      config.include.push(packageJsonFeatureId);
    }
  } else {
    config.include = config.include.filter((f) => f !== packageJsonFeatureId);
  }

  return config;
}
