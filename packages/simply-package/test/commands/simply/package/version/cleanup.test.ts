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

import { SfError } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { Package, PackageVersion, PackageVersionListResult } from '@salesforce/packaging';
import sinon from 'sinon';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PackageVersionCleanupResult } from '../../../../../src/commands/simply/package/version/cleanup.js';
import PackageVersionCleanup from '../../../../../src/commands/simply/package/version/cleanup.js';

const myPackage0Hot = '0Hot0000000YzlxBAB';
const packageVersion0101SubscriberId = '04t6A000002zgKSQAW';
const packageVersion0102SubscriberId = '04t6A000002zgKSQAX';
const packageVersion0201SubscriberId = '04t6A000002zgKSQAY';
const packageVersion0202SubscriberId = '04t6A000002zgKSQAZ';

const packageVersion0101ListResult: PackageVersionListResult = {
  Id: '',
  Package2Id: '',
  SubscriberPackageVersionId: packageVersion0101SubscriberId,
  Name: '',
  // @ts-ignore
  Package2: undefined,
  Description: '',
  Tag: '',
  Branch: '',
  MajorVersion: '0',
  MinorVersion: '1',
  PatchVersion: '0',
  BuildNumber: '1',
  IsReleased: false,
  CreatedDate: '1900-01-01',
  LastModifiedDate: '1900-01-01',
  IsPasswordProtected: false,
  AncestorId: '',
  ValidationSkipped: false,
  CreatedById: '',
  // @ts-ignore
  CodeCoverage: undefined,
  HasPassedCodeCoverageCheck: true,
  ConvertedFromVersionId: '',
  ReleaseVersion: '',
  BuildDurationInSeconds: 60,
  HasMetadataRemoved: false,
  Language: '',
};

const packageVersion0102ListResult: PackageVersionListResult = {
  Id: '',
  Package2Id: '',
  SubscriberPackageVersionId: packageVersion0102SubscriberId,
  Name: '',
  // @ts-ignore
  Package2: undefined,
  Description: '',
  Tag: '',
  Branch: '',
  MajorVersion: '0',
  MinorVersion: '1',
  PatchVersion: '0',
  BuildNumber: '2',
  IsReleased: true,
  CreatedDate: '1900-01-01',
  LastModifiedDate: '1900-01-01',
  IsPasswordProtected: false,
  AncestorId: '',
  ValidationSkipped: false,
  CreatedById: '',
  // @ts-ignore
  CodeCoverage: undefined,
  HasPassedCodeCoverageCheck: true,
  ConvertedFromVersionId: '',
  ReleaseVersion: '',
  BuildDurationInSeconds: 60,
  HasMetadataRemoved: false,
  Language: '',
};

const packageVersion0201ListResult: PackageVersionListResult = {
  Id: '',
  Package2Id: '',
  SubscriberPackageVersionId: packageVersion0201SubscriberId,
  Name: '',
  // @ts-ignore
  Package2: undefined,
  Description: '',
  Tag: '',
  Branch: '',
  MajorVersion: '0',
  MinorVersion: '2',
  PatchVersion: '0',
  BuildNumber: '1',
  IsReleased: false,
  CreatedDate: '1900-01-01',
  LastModifiedDate: '1900-01-01',
  IsPasswordProtected: false,
  AncestorId: '',
  ValidationSkipped: false,
  CreatedById: '',
  // @ts-ignore
  CodeCoverage: undefined,
  HasPassedCodeCoverageCheck: true,
  ConvertedFromVersionId: '',
  ReleaseVersion: '',
  BuildDurationInSeconds: 60,
  HasMetadataRemoved: false,
  Language: '',
};

const packageVersion0202ListResult: PackageVersionListResult = {
  Id: '',
  Package2Id: '',
  SubscriberPackageVersionId: packageVersion0202SubscriberId,
  Name: '',
  // @ts-ignore
  Package2: undefined,
  Description: '',
  Tag: '',
  Branch: '',
  MajorVersion: '0',
  MinorVersion: '2',
  PatchVersion: '0',
  BuildNumber: '2',
  IsReleased: true,
  CreatedDate: '1900-01-01',
  LastModifiedDate: '1900-01-01',
  IsPasswordProtected: false,
  AncestorId: '',
  ValidationSkipped: false,
  CreatedById: '',
  // @ts-ignore
  CodeCoverage: undefined,
  HasPassedCodeCoverageCheck: true,
  ConvertedFromVersionId: '',
  ReleaseVersion: '',
  BuildDurationInSeconds: 60,
  HasMetadataRemoved: false,
  Language: '',
};

describe('simply package version cleanup', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  it('should error without required --target-dev-hub flag', async () => {
    try {
      await PackageVersionCleanup.run();
      expect.fail('should have thrown NoDefaultDevHubError');
    } catch (err) {
      const error = err as SfError;
      expect(error.name).to.equal('NoDefaultDevHubError');
      expect(error.message).to.include('No default dev hub found.');
    }
  });

  it('should error without required flags', async () => {
    try {
      await PackageVersionCleanup.run(['--target-dev-hub', 'devHub']);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.name).to.equal('Error');
      expect(error.message).to.include('Missing required flag package');
    }
  });

  it('should error when neither --selector nor --selector-exclude is specified', async () => {
    try {
      await PackageVersionCleanup.run(['--package', myPackage0Hot, '--target-dev-hub', 'foor@bar.org']);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include('You must specify either --selector or --selector-exclude.');
    }
  });

  it('should error when both --selector and --selector-exclude are specified', async () => {
    try {
      await PackageVersionCleanup.run([
        '--selector',
        '0.2.0',
        '--selector-exclude',
        '0.1.0',
        '--package',
        myPackage0Hot,
        '--target-dev-hub',
        'foor@bar.org',
      ]);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.message.toLowerCase()).to.include('selector-exclude');
    }
  });

  it('should error when one of multiple --selector values is not in MAJOR.MINOR.PATCH format', async () => {
    try {
      await PackageVersionCleanup.run([
        '--selector',
        '0.1.0',
        '--selector',
        'bad-format',
        '--package',
        myPackage0Hot,
        '--target-dev-hub',
        'foor@bar.org',
      ]);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include('The selector "bad-format" must be in the format of MAJOR.MINOR.PATCH.');
    }
  });

  it('should select the correct versions for deletion', async () => {
    $$.SANDBOX.stub(Package, 'listVersions').resolves([
      packageVersion0101ListResult,
      packageVersion0102ListResult,
      packageVersion0201ListResult,
      packageVersion0202ListResult,
    ]);

    $$.SANDBOX.stub(PackageVersion.prototype, 'delete').resolves({
      errors: [],
      id: 'testId',
      success: true,
    });

    const results = await PackageVersionCleanup.run([
      '--selector',
      '0.2.0',
      '--package',
      myPackage0Hot,
      '--target-dev-hub',
      'foor@bar.org',
    ]);

    const expectedResults: PackageVersionCleanupResult[] = [
      { Success: true, SubscriberPackageVersionId: packageVersion0201SubscriberId },
    ];

    expect(results).to.deep.equal(expectedResults);
  });

  it('should select the union of versions matching multiple --selector values for deletion', async () => {
    $$.SANDBOX.stub(Package, 'listVersions').resolves([
      packageVersion0101ListResult,
      packageVersion0102ListResult,
      packageVersion0201ListResult,
      packageVersion0202ListResult,
    ]);

    $$.SANDBOX.stub(PackageVersion.prototype, 'delete').resolves({
      errors: [],
      id: 'testId',
      success: true,
    });

    const results = await PackageVersionCleanup.run([
      '--selector',
      '0.1.0',
      '--selector',
      '0.2.0',
      '--package',
      myPackage0Hot,
      '--target-dev-hub',
      'foor@bar.org',
    ]);

    // 0101 and 0201 are unreleased and match one of the two selectors, so both are deleted.
    // 0102/0202 are released, so they're never touched regardless of matching a selector.
    const expectedResults: PackageVersionCleanupResult[] = [
      { Success: true, SubscriberPackageVersionId: packageVersion0101SubscriberId },
      { Success: true, SubscriberPackageVersionId: packageVersion0201SubscriberId },
    ];

    expect(results).to.deep.equal(expectedResults);
  });

  it('should select every unreleased version not matching --selector-exclude for deletion', async () => {
    $$.SANDBOX.stub(Package, 'listVersions').resolves([
      packageVersion0101ListResult,
      packageVersion0102ListResult,
      packageVersion0201ListResult,
      packageVersion0202ListResult,
    ]);

    $$.SANDBOX.stub(PackageVersion.prototype, 'delete').resolves({
      errors: [],
      id: 'testId',
      success: true,
    });

    const results = await PackageVersionCleanup.run([
      '--selector-exclude',
      '0.2.0',
      '--package',
      myPackage0Hot,
      '--target-dev-hub',
      'foor@bar.org',
    ]);

    // 0101 is unreleased and doesn't match 0.2.0, so it's deleted. 0102/0202 are released (never
    // deleted), and 0201 is unreleased but matches the exclusion selector, so it's kept.
    const expectedResults: PackageVersionCleanupResult[] = [
      { Success: true, SubscriberPackageVersionId: packageVersion0101SubscriberId },
    ];

    expect(results).to.deep.equal(expectedResults);
  });

  it('should select every unreleased version matching none of multiple --selector-exclude values for deletion', async () => {
    $$.SANDBOX.stub(Package, 'listVersions').resolves([
      packageVersion0101ListResult,
      packageVersion0102ListResult,
      packageVersion0201ListResult,
      packageVersion0202ListResult,
    ]);

    $$.SANDBOX.stub(PackageVersion.prototype, 'delete').resolves({
      errors: [],
      id: 'testId',
      success: true,
    });

    const results = await PackageVersionCleanup.run([
      '--selector-exclude',
      '0.1.0',
      '--selector-exclude',
      '0.2.0',
      '--package',
      myPackage0Hot,
      '--target-dev-hub',
      'foor@bar.org',
    ]);

    // 0101 and 0201 are unreleased but each match one of the two exclusion selectors, so both are
    // kept. 0102/0202 are released, so they were never candidates regardless.
    const expectedResults: PackageVersionCleanupResult[] = [];

    expect(results).to.deep.equal(expectedResults);
  });
});
