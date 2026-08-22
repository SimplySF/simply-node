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

import { SfError, SfProject } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import sinon from 'sinon';
import { afterEach, describe, expect, it } from 'vitest';
import PackageVersionGet from '../../../../../src/commands/simply/package/version/get.js';

const mockSubscriberPackageVersionId = '04t4W000002nizdQAA';

// Every dependency declaration form the command has to handle, in one project.
const mockProjectContents = {
  packageDirectories: [
    {
      path: 'force-app',
      default: true,
      package: 'my-package',
      versionNumber: '57.0.0.NEXT',
      dependencies: [
        { package: 'test-package@0.1.0+2' },
        { package: 'ESObjects@57.0.0-3' },
        { package: 'latest-package', versionNumber: '1.2.3.LATEST' },
        { package: mockSubscriberPackageVersionId },
        { package: 'unversioned-package' },
      ],
    },
  ],
  packageAliases: {
    'test-package@0.1.0+2': '04t4W000002niziQAA',
    'id-package@2.0.0-4': mockSubscriberPackageVersionId,
    'unversioned-package': '0Ho4W000000CaeJSAS',
  },
  namespace: '',
  sourceApiVersion: '62.0',
};

// The same dependency at two versions in two directories, for the ambiguity cases.
const mockConflictingProjectContents = {
  packageDirectories: [
    { path: 'force-app', default: true, dependencies: [{ package: 'test-package@0.1.0+2' }] },
    { path: 'other-app', dependencies: [{ package: 'test-package@0.2.0+1' }] },
  ],
  packageAliases: {},
};

function stubProject($$: TestContext, contents: Record<string, unknown> = mockProjectContents): void {
  $$.SANDBOX.stub(SfProject.prototype, 'retrieveSfProjectJson').resolves({
    getContents: () => contents,
  } as never);
}

describe('simply package version get', () => {
  const $$ = new TestContext({ sinon });

  afterEach(() => {
    $$.restore();
  });

  it('should return the version from a dependency alias with a + build', async () => {
    stubProject($$);

    const result = await PackageVersionGet.run(['--package', 'test-package']);

    expect(result.version).to.equal('0.1.0+2');
    expect(result.source).to.equal('dependency');
    expect(result.packageDirectory).to.equal('force-app');
    expect(result.subscriberPackageVersionId).to.equal('04t4W000002niziQAA');
  });

  it('should return the version from a dependency alias with a - build', async () => {
    stubProject($$);

    const result = await PackageVersionGet.run(['--package', 'ESObjects']);

    expect(result.version).to.equal('57.0.0-3');
    expect(result.source).to.equal('dependency');
  });

  it('should return the versionNumber of a non-pinned dependency', async () => {
    stubProject($$);

    const result = await PackageVersionGet.run(['--package', 'latest-package']);

    expect(result.version).to.equal('1.2.3.LATEST');
    expect(result.source).to.equal('dependency');
  });

  it("should return the project's own package version from its package directory", async () => {
    stubProject($$);

    const result = await PackageVersionGet.run(['--package', 'my-package']);

    expect(result.version).to.equal('57.0.0.NEXT');
    expect(result.source).to.equal('packageDirectory');
    expect(result.packageDirectory).to.equal('force-app');
  });

  it('should resolve a dependency declared as a raw ID through packageAliases', async () => {
    stubProject($$);

    const result = await PackageVersionGet.run(['--package', 'id-package']);

    expect(result.version).to.equal('2.0.0-4');
    expect(result.source).to.equal('dependency');
    expect(result.subscriberPackageVersionId).to.equal(mockSubscriberPackageVersionId);
  });

  it('should error when the package is not declared at all', async () => {
    stubProject($$);

    try {
      await PackageVersionGet.run(['--package', 'absent-package']);
      expect.fail('should have thrown packageNotFound');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include("No package named 'absent-package'");
      expect(error.message).to.include('force-app');
    }
  });

  it('should error when the package is declared without a version', async () => {
    stubProject($$);

    try {
      await PackageVersionGet.run(['--package', 'unversioned-package']);
      expect.fail('should have thrown noVersionFound');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include("declared in 'force-app', but without a version");
    }
  });

  it('should error when the same package is declared at different versions', async () => {
    stubProject($$, mockConflictingProjectContents);

    try {
      await PackageVersionGet.run(['--package', 'test-package']);
      expect.fail('should have thrown ambiguousMatch');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include('0.1.0+2 (force-app)');
      expect(error.message).to.include('0.2.0+1 (other-app)');
      expect(error.message).to.include('--directory');
    }
  });

  it('should resolve an ambiguous package with --directory', async () => {
    stubProject($$, mockConflictingProjectContents);

    const result = await PackageVersionGet.run(['--package', 'test-package', '--directory', 'other-app']);

    expect(result.version).to.equal('0.2.0+1');
    expect(result.packageDirectory).to.equal('other-app');
  });

  it('should report the searched directory when --directory has no match', async () => {
    stubProject($$, mockConflictingProjectContents);

    try {
      await PackageVersionGet.run(['--package', 'test-package', '--directory', 'missing-app']);
      expect.fail('should have thrown packageNotFound');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include("package directory 'missing-app'");
    }
  });
});
