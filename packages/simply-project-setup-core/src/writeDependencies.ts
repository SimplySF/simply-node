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

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { PackageJson } from './packageJson.js';
import { semverIsLessThan } from './semver.js';
import { WriteDependenciesOptions } from './types.js';

const getVersionNum = (version: string): string => version.replace(/^[~^>=]*/, '');

const meetsMinimumVersion = (version: string, target: string): boolean => {
  // Do not compare non-semver versions (e.g. "workspace:^", "file:"); just keep the existing version.
  if (version.includes(':') || target.includes(':')) {
    return true;
  }
  return !semverIsLessThan(getVersionNum(version), getVersionNum(target));
};

type Dependencies = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function upgradeIfBelowMinimum(target: Record<string, string>, name: string, version: string, added: string[]): void {
  const currentVersion = target[name];
  if (!currentVersion) {
    target[name] = version.startsWith('^') ? version : `^${version}`;
    added.push(name);
  } else if (!meetsMinimumVersion(currentVersion, version)) {
    const isPinned = !currentVersion.startsWith('^') && !currentVersion.startsWith('~');
    target[name] = isPinned ? getVersionNum(version) : version.startsWith('^') ? version : `^${version}`;
    added.push(name);
  }
}

/**
 * Merges each included feature's `<templatesPath>/<feature>/dependencies.json` into the project's
 * `package.json`, upgrading a version only when the existing one doesn't meet the template's
 * minimum. Returns whether anything changed.
 */
export async function writeDependencies(options: WriteDependenciesOptions): Promise<boolean> {
  const { config, templatesPath, projectPath } = options;
  const features = config.include;
  const pjson = new PackageJson(projectPath);

  const dependencies = pjson.get<Record<string, string>>('dependencies', {});
  const devDependencies = pjson.get<Record<string, string>>('devDependencies', {});

  const addedDependencies: string[] = [];
  const addedDevDependencies: string[] = [];

  const allDependencies: Dependencies = { dependencies: {}, devDependencies: {} };

  const results = await Promise.all(
    features.map(async (feature) => {
      const featurePath = join(templatesPath, feature, 'dependencies.json');
      try {
        const content = await fs.readFile(featurePath, 'utf-8');
        return JSON.parse(content) as Dependencies;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
        return null;
      }
    }),
  );

  for (const featureDeps of results) {
    if (featureDeps) {
      allDependencies.dependencies = { ...allDependencies.dependencies, ...featureDeps.dependencies };
      allDependencies.devDependencies = { ...allDependencies.devDependencies, ...featureDeps.devDependencies };
    }
  }

  for (const [name, version] of Object.entries(allDependencies.dependencies ?? {})) {
    upgradeIfBelowMinimum(dependencies, name, version, addedDependencies);
  }

  for (const [name, version] of Object.entries(allDependencies.devDependencies ?? {})) {
    upgradeIfBelowMinimum(devDependencies, name, version, addedDevDependencies);
  }

  pjson.write();
  return addedDependencies.length > 0 || addedDevDependencies.length > 0;
}
