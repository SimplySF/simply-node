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

import { SfdxProject } from '@simplysf/simply-core';
import { describe, expect, it } from 'vitest';
import { findPackageVersions, splitPackageAlias } from '../src/packageVersionLookup.js';

describe('splitPackageAlias', () => {
  it('returns a bare name with no version when there is no @', () => {
    expect(splitPackageAlias('MyPackage')).to.deep.equal({ name: 'MyPackage' });
  });

  it('splits a name and version on the last @', () => {
    expect(splitPackageAlias('MyPackage@1.2.3-4')).to.deep.equal({ name: 'MyPackage', version: '1.2.3-4' });
  });

  it('keeps a leading @ (scoped-style name) intact', () => {
    expect(splitPackageAlias('@ns/pkg')).to.deep.equal({ name: '@ns/pkg' });
  });

  it('treats a scoped-style name with a version as name + version on the last @', () => {
    expect(splitPackageAlias('@ns/pkg@1.0.0-1')).to.deep.equal({ name: '@ns/pkg', version: '1.0.0-1' });
  });

  it('returns undefined version for a trailing bare @', () => {
    expect(splitPackageAlias('MyPackage@')).to.deep.equal({ name: 'MyPackage', version: undefined });
  });
});

describe('findPackageVersions', () => {
  function buildProject(overrides: Partial<SfdxProject> = {}): SfdxProject {
    return {
      packageDirectories: [],
      packageAliases: {},
      ...overrides,
    };
  }

  it('matches a dependency declared as a versioned alias', () => {
    const project = buildProject({
      packageDirectories: [{ path: 'force-app', dependencies: [{ package: 'MyPackage@1.0.0-1' }] }],
    });

    const matches = findPackageVersions(project, 'MyPackage');

    expect(matches).to.deep.equal([
      {
        package: 'MyPackage@1.0.0-1',
        version: '1.0.0-1',
        source: 'dependency',
        packageDirectory: 'force-app',
        subscriberPackageVersionId: undefined,
      },
    ]);
  });

  it('matches a dependency whose package is a bare name plus a sibling versionNumber', () => {
    const project = buildProject({
      packageDirectories: [
        { path: 'force-app', dependencies: [{ package: 'MyPackage', versionNumber: '2.0.0.LATEST' }] },
      ],
    });

    const matches = findPackageVersions(project, 'MyPackage');

    expect(matches).to.deep.equal([
      {
        package: 'MyPackage',
        version: '2.0.0.LATEST',
        source: 'dependency',
        packageDirectory: 'force-app',
        subscriberPackageVersionId: undefined,
      },
    ]);
  });

  it('recovers the version from a versioned alias when the dependency is a raw Package2Id', () => {
    const project = buildProject({
      packageDirectories: [{ path: 'force-app', dependencies: [{ package: '0Ho000000000000AAA' }] }],
      packageAliases: { 'MyPackage@1.0.0-1': '0Ho000000000000AAA' },
    });

    const matches = findPackageVersions(project, 'MyPackage');

    expect(matches).to.deep.equal([
      {
        package: 'MyPackage@1.0.0-1',
        version: '1.0.0-1',
        source: 'dependency',
        packageDirectory: 'force-app',
        subscriberPackageVersionId: undefined,
      },
    ]);
  });

  it('resolves a subscriber package version ID directly, without needing an alias', () => {
    const project = buildProject({
      packageDirectories: [{ path: 'force-app', dependencies: [{ package: '04t000000000001AAA' }] }],
      packageAliases: { 'MyPackage@1.0.0-1': '04t000000000001AAA' },
    });

    const matches = findPackageVersions(project, 'MyPackage');

    expect(matches[0].subscriberPackageVersionId).to.equal('04t000000000001AAA');
  });

  it('matches the package directory that itself builds the named package', () => {
    const project = buildProject({
      packageDirectories: [{ path: 'force-app', package: 'MyPackage', versionNumber: '3.1.0.NEXT' }],
    });

    const matches = findPackageVersions(project, 'MyPackage');

    expect(matches).to.deep.equal([
      { package: 'MyPackage', version: '3.1.0.NEXT', source: 'packageDirectory', packageDirectory: 'force-app' },
    ]);
  });

  it('scopes the search to a single directory when the directory option is given', () => {
    const project = buildProject({
      packageDirectories: [
        { path: 'force-app', dependencies: [{ package: 'MyPackage@1.0.0-1' }] },
        { path: 'other-app', dependencies: [{ package: 'MyPackage@2.0.0-1' }] },
      ],
    });

    const matches = findPackageVersions(project, 'MyPackage', { directory: 'other-app' });

    expect(matches).to.have.lengthOf(1);
    expect(matches[0].packageDirectory).to.equal('other-app');
  });

  it('returns an empty array when nothing matches', () => {
    const project = buildProject({
      packageDirectories: [{ path: 'force-app', dependencies: [{ package: 'OtherPackage@1.0.0-1' }] }],
    });

    expect(findPackageVersions(project, 'MyPackage')).to.deep.equal([]);
  });
});
