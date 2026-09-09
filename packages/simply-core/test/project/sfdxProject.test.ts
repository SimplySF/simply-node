/*
 * Copyright (c) 2026, SimplySF.
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
import { afterEach, describe, expect, it } from 'vitest';
import {
  getDefaultPackageDirectory,
  getPluginConfig,
  readSfdxProject,
  type SfdxProject,
} from '../../src/project/sfdxProject.js';

describe('readSfdxProject', () => {
  let projectDir: string | undefined;

  afterEach(() => {
    if (projectDir && fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
    projectDir = undefined;
  });

  const writeProject = (contents: string): string => {
    const target = path.join(os.tmpdir(), `simply-core-sfdx-project-${process.pid}-${Date.now()}`);
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'sfdx-project.json'), contents);
    return target;
  };

  it('parses a project and exposes every package directory property callers read', async () => {
    projectDir = writeProject(
      JSON.stringify({
        packageDirectories: [
          {
            path: 'force-app',
            default: true,
            package: 'MyPackage',
            versionNumber: '1.2.3.NEXT',
            definitionFile: 'config/project-scratch-def.json',
            branch: 'main',
            seedMetadata: { path: 'seed' },
            packageMetadataAccess: { permissionSets: ['Admin'] },
            dependencies: [{ package: 'Dep@1.0.0-1' }],
          },
        ],
        packageAliases: { MyPackage: '0Ho000000000001AAA' },
        plugins: { simply: { coverageRequirement: { minimumCoverageRequired: '80' } } },
      }),
    );

    const project = await readSfdxProject(projectDir);
    const [directory] = project.packageDirectories;

    expect(directory.path).to.equal('force-app');
    expect(directory.package).to.equal('MyPackage');
    expect(directory.versionNumber).to.equal('1.2.3.NEXT');
    expect(directory.definitionFile).to.equal('config/project-scratch-def.json');
    expect(directory.branch).to.equal('main');
    expect(directory.seedMetadata?.path).to.equal('seed');
    expect(directory.packageMetadataAccess?.permissionSets).to.deep.equal(['Admin']);
    expect(directory.dependencies?.[0].package).to.equal('Dep@1.0.0-1');
    expect(project.packageAliases?.MyPackage).to.equal('0Ho000000000001AAA');
  });

  it('keeps unlisted properties reachable through the index signature', async () => {
    projectDir = writeProject(
      JSON.stringify({ packageDirectories: [{ path: 'force-app' }], someFutureSalesforceKey: 'value' }),
    );

    const project = await readSfdxProject(projectDir);

    expect(project.someFutureSalesforceKey).to.equal('value');
  });

  it('throws a typed error when packageDirectories is missing', async () => {
    projectDir = writeProject(JSON.stringify({ namespace: 'acme' }));

    await expect(readSfdxProject(projectDir)).rejects.toThrow('Invalid or missing packageDirectories array');
  });

  it('throws a typed error when packageDirectories is not an array', async () => {
    projectDir = writeProject(JSON.stringify({ packageDirectories: 'force-app' }));

    await expect(readSfdxProject(projectDir)).rejects.toThrow('Invalid or missing packageDirectories array');
  });

  it('rejects with an ENOENT error when the project file is absent, so callers can treat it as non-fatal', async () => {
    projectDir = path.join(os.tmpdir(), `simply-core-sfdx-project-missing-${process.pid}-${Date.now()}`);
    fs.mkdirSync(projectDir, { recursive: true });

    await expect(readSfdxProject(projectDir)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects with a SyntaxError for malformed JSON', async () => {
    projectDir = writeProject('{ not json');

    await expect(readSfdxProject(projectDir)).rejects.toThrow(SyntaxError);
  });
});

describe('getDefaultPackageDirectory', () => {
  it('returns the directory marked default', () => {
    const project: SfdxProject = {
      packageDirectories: [{ path: 'util' }, { path: 'force-app', default: true }],
    };

    expect(getDefaultPackageDirectory(project)?.path).to.equal('force-app');
  });

  it('returns undefined when no directory is marked default', () => {
    const project: SfdxProject = { packageDirectories: [{ path: 'util' }, { path: 'force-app' }] };

    expect(getDefaultPackageDirectory(project)).to.equal(undefined);
  });

  it('returns the first default when more than one is marked, matching find() semantics', () => {
    const project: SfdxProject = {
      packageDirectories: [
        { path: 'a', default: true },
        { path: 'b', default: true },
      ],
    };

    expect(getDefaultPackageDirectory(project)?.path).to.equal('a');
  });
});

describe('getPluginConfig', () => {
  const project: SfdxProject = {
    packageDirectories: [],
    plugins: { simply: { dependencies: { ignore: ['0Ho000000000001AAA'] }, coverageRequirement: { min: 80 } } },
  };

  it('walks a dot-delimited path to a nested value', () => {
    expect(getPluginConfig<string[]>(project, 'plugins.simply.dependencies.ignore')).to.deep.equal([
      '0Ho000000000001AAA',
    ]);
  });

  it('reads a scalar as readily as an object', () => {
    expect(getPluginConfig<number>(project, 'plugins.simply.coverageRequirement.min')).to.equal(80);
  });

  it('returns undefined when a segment along the path is missing', () => {
    expect(getPluginConfig(project, 'plugins.other.thing')).to.equal(undefined);
    expect(getPluginConfig(project, 'plugins.simply.nope.deeper')).to.equal(undefined);
  });

  it('returns undefined rather than throwing when a segment is a scalar, not an object', () => {
    expect(getPluginConfig(project, 'plugins.simply.coverageRequirement.min.deeper')).to.equal(undefined);
  });

  it('returns undefined for a path into an absent top-level key', () => {
    expect(getPluginConfig({ packageDirectories: [] }, 'plugins.simply.anything')).to.equal(undefined);
  });
});
