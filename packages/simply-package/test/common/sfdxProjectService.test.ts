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

import { SfProject } from '@salesforce/core';
import { describe, expect, it } from 'vitest';
import { buildProjectService } from '../../src/common/sfdxProjectService.js';
import { DependencyChange } from '../../src/schemas/manage/dependencyChange.js';

// `sfdx-project.json` on disk always uses forward slashes for `packageDirectories[].path`, but
// `SfProject.getPackageDirectories()` normalizes that path to the OS separator. On Windows this
// produces a backslash-separated path, which must still match the forward-slash path stored in
// the raw JSON when `applyChanges` looks up the directory to patch.
function buildFakeProject(rawPath: string, osNormalizedPath: string, initialAliases: Record<string, string> = {}) {
  const contents = {
    packageDirectories: [
      {
        path: rawPath,
        package: 'MyProject',
        versionNumber: '1.0.0.NEXT',
        default: true,
        dependencies: [{ package: '04t100000000000AAA' }],
      },
    ],
    packageAliases: initialAliases,
    namespace: '',
    sourceApiVersion: '62.0',
  };

  let written: typeof contents | undefined;

  const projectJson = {
    getContents: () => contents,
    set(key: string, value: unknown) {
      (contents as unknown as Record<string, unknown>)[key] = value;
    },
    write: async () => {
      written = JSON.parse(JSON.stringify(contents)) as typeof contents;
      return contents;
    },
  };

  const project = {
    retrieveSfProjectJson: async () => projectJson,
    getPackageDirectories: () => [
      {
        path: osNormalizedPath,
        name: osNormalizedPath,
        fullPath: `/test/${osNormalizedPath}`,
        default: true,
        package: 'MyProject',
        versionNumber: '1.0.0.NEXT',
        dependencies: [{ package: '04t100000000000AAA' }],
      },
    ],
    getPackageIdFromAlias: () => undefined,
  } as unknown as SfProject;

  return { project, getWritten: () => written };
}

describe('buildProjectService applyChanges', () => {
  it('patches the dependency even when the directory path uses OS-native separators', async () => {
    // Simulates Windows: raw JSON uses forward slashes, SfProject normalizes to backslashes.
    const { project, getWritten } = buildFakeProject('force-app/main/default', 'force-app\\main\\default');
    const service = await buildProjectService(project);

    const dependenciesByDirectory = service.getDependenciesByDirectory();
    const dirPath = [...dependenciesByDirectory.keys()][0];
    expect(dirPath).to.equal('force-app\\main\\default');

    const change: DependencyChange = {
      oldAlias: 'MyPackage@1.0.0-1',
      oldDependency: dependenciesByDirectory.get(dirPath)![0],
      newAlias: 'MyPackage@1.0.1-1',
      newSubscriberPackageVersionId: '04t100000000001AAA',
      newPackage2Id: '0Ho000000000000AAA',
      isSameAsOld: false,
    };

    await service.applyChanges(new Map([[dirPath, [change]]]));

    const written = getWritten();
    expect(written).to.not.be.undefined;
    expect(written!.packageDirectories[0].dependencies[0].package).to.equal('MyPackage@1.0.1-1');
  });

  it('writes packageAliases sorted alphabetically by key', async () => {
    const { project, getWritten } = buildFakeProject('force-app/main/default', 'force-app/main/default', {
      ZPackage: '0Ho900000000000AAA',
      APackage: '0Ho100000000000AAA',
    });
    const service = await buildProjectService(project);

    const dependenciesByDirectory = service.getDependenciesByDirectory();
    const dirPath = [...dependenciesByDirectory.keys()][0];

    const change: DependencyChange = {
      oldAlias: 'MyPackage@1.0.0-1',
      oldDependency: dependenciesByDirectory.get(dirPath)![0],
      newAlias: 'MPackage@1.0.1-1',
      newSubscriberPackageVersionId: '04t500000000001AAA',
      newPackage2Id: '0Ho500000000000AAA',
      isSameAsOld: false,
    };

    await service.applyChanges(new Map([[dirPath, [change]]]));

    const written = getWritten();
    expect(written).to.not.be.undefined;
    expect(Object.keys(written!.packageAliases)).to.deep.equal([
      'APackage',
      'MPackage',
      'MPackage@1.0.1-1',
      'ZPackage',
    ]);
  });
});
