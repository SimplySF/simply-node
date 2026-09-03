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

import { PackageJson } from './packageJson.js';
import { StandardizePackageJsonOptions } from './types.js';

/**
 * Writes `defaults.private`/`type`/`workspaces` onto the project's `package.json`, then merges in
 * `defaults.scripts`/`wireit` entries — pruning any entry that `defaults.featureScripts` ties to a
 * feature id not present in `config.include`, and always keeping entries not tied to any feature.
 * Returns whether anything changed. See this package's README for an end-to-end example.
 */
export function standardizePackageJson(options: StandardizePackageJsonOptions): boolean {
  const { config, defaults, projectPath } = options;
  const features = config.include;

  const pjson = new PackageJson(projectPath);

  if (defaults.private !== undefined) {
    pjson.contents.private = defaults.private;
  }
  if (defaults.type !== undefined) {
    pjson.contents.type = defaults.type;
  }
  if (defaults.workspaces !== undefined) {
    pjson.contents.workspaces = defaults.workspaces;
  }

  const featureScripts = defaults.featureScripts ?? {};
  const gatedScriptNames = new Set(Object.values(featureScripts).flat());

  const isGatedIn = (scriptName: string): boolean =>
    !gatedScriptNames.has(scriptName) ||
    Object.entries(featureScripts).some(([feature, names]) => names.includes(scriptName) && features.includes(feature));

  if (defaults.scripts) {
    const scripts = pjson.get<Record<string, string>>('scripts', {});
    for (const scriptName of gatedScriptNames) {
      delete scripts[scriptName];
    }
    for (const [scriptName, scriptCommand] of Object.entries(defaults.scripts)) {
      if (isGatedIn(scriptName)) {
        scripts[scriptName] = scriptCommand;
      }
    }
  }

  if (defaults.wireit) {
    const wireit = pjson.get<Record<string, unknown>>('wireit', {});
    for (const scriptName of gatedScriptNames) {
      delete wireit[scriptName];
    }
    for (const [scriptName, wireitConfig] of Object.entries(defaults.wireit)) {
      if (isGatedIn(scriptName)) {
        wireit[scriptName] = wireitConfig;
      }
    }
  }

  const hasChanges = pjson.originalContents !== pjson.stringify();
  pjson.write();
  return hasChanges;
}
