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

import { Connection, SfProject } from '@salesforce/core';
import { Package, PackagingSObjects, PackageVersionListResult } from '@salesforce/packaging';
import sinon from 'sinon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildVersionService, PackageVersionService } from '../src/packageVersionService.js';
import { ParsedDependency } from '../src/schemas/manage/parsedDependency.js';

const PACKAGE2_ID = '0Ho000000000000AAA';
const RELEASED_VERSION_ID = '04t000000000001AAA';
const CURRENT_VERSION_ID = '04t000000000002AAA';
const NEWER_MINOR_VERSION_ID = '04t000000000003AAA';

/** Builds a minimal `PackageVersionListResult` fixture. */
function version(
  subscriberPackageVersionId: string,
  major: number,
  minor: number,
  patch: number,
  build: number,
  isReleased: boolean,
): PackageVersionListResult {
  return {
    Package2Id: PACKAGE2_ID,
    SubscriberPackageVersionId: subscriberPackageVersionId,
    Branch: '',
    MajorVersion: String(major),
    MinorVersion: String(minor),
    PatchVersion: String(patch),
    BuildNumber: String(build),
    IsReleased: isReleased,
  } as unknown as PackageVersionListResult;
}

describe('buildVersionService', () => {
  const sandbox = sinon.createSandbox();
  let service: PackageVersionService;
  let dependency: ParsedDependency;

  beforeEach(async () => {
    sandbox
      .stub(Package, 'list')
      .resolves([
        { Id: PACKAGE2_ID, Name: 'MyPackage', NamespacePrefix: '' },
      ] as unknown as PackagingSObjects.Package2[]);
    sandbox
      .stub(Package, 'listVersions')
      .resolves([
        version(RELEASED_VERSION_ID, 1, 0, 0, 1, true),
        version(CURRENT_VERSION_ID, 1, 0, 0, 2, false),
        version(NEWER_MINOR_VERSION_ID, 1, 1, 0, 1, false),
      ]);

    service = await buildVersionService({} as Connection, {} as SfProject);
    dependency = {
      package2Id: PACKAGE2_ID,
      subscriberPackageVersionId: CURRENT_VERSION_ID,
      majorVersion: 1,
      minorVersion: 0,
      patchVersion: 0,
      isPinned: true,
      isLatest: false,
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('knows about a loaded package and version', () => {
    expect(service.knowsAboutPackage(PACKAGE2_ID)).to.equal(true);
    expect(service.knowsAboutVersion(CURRENT_VERSION_ID)).to.equal(true);
  });

  it('does not know about an unloaded package or version', () => {
    expect(service.knowsAboutPackage('0Ho999999999999AAA')).to.equal(false);
    expect(service.knowsAboutVersion('04t999999999999AAA')).to.equal(false);
  });

  it('resolves the owning package for a version', () => {
    expect(service.getPackage2IdForVersion(CURRENT_VERSION_ID)).to.equal(PACKAGE2_ID);
    expect(service.getPackage2IdForVersion('04t999999999999AAA')).to.be.undefined;
  });

  it('computes the package alias without a namespace prefix', () => {
    expect(service.getPackageAlias(PACKAGE2_ID)).to.equal('MyPackage');
  });

  it('computes the version alias as package@major.minor.patch-build', () => {
    expect(service.getVersionAlias(CURRENT_VERSION_ID)).to.equal('MyPackage@1.0.0-2');
  });

  it('finds the full version record by ID', () => {
    expect(service.findVersionById(CURRENT_VERSION_ID)?.MajorVersion).to.equal('1');
    expect(service.findVersionById('04t999999999999AAA')).to.be.undefined;
  });

  describe('enrichDependency', () => {
    it('fills in package2Id and version components from a known subscriberPackageVersionId', () => {
      const enriched = service.enrichDependency({
        subscriberPackageVersionId: CURRENT_VERSION_ID,
        isPinned: true,
        isLatest: false,
      });

      expect(enriched).to.deep.include({
        package2Id: PACKAGE2_ID,
        versionNumber: '1.0.0.2',
        majorVersion: 1,
        minorVersion: 0,
        patchVersion: 0,
        buildVersion: 2,
      });
    });

    it('returns the dependency unchanged when package2Id is already set', () => {
      const input = { package2Id: PACKAGE2_ID, isPinned: true, isLatest: false };

      expect(service.enrichDependency(input)).to.equal(input);
    });

    it('returns the dependency unchanged when the subscriberPackageVersionId is unknown', () => {
      const input = { subscriberPackageVersionId: '04t999999999999AAA', isPinned: true, isLatest: false };

      expect(service.enrichDependency(input)).to.equal(input);
    });
  });

  it('buildReleasedChoices returns the latest released version on the main branch', () => {
    expect(service.buildReleasedChoices(dependency, [])).to.deep.equal([
      { name: 'Latest released version on main build branch: 1.0.0-1', value: RELEASED_VERSION_ID, short: '1.0.0-1' },
    ]);
  });

  it('buildLatestChoices returns a single non-pinned build choice for the current patch tier', () => {
    expect(service.buildLatestChoices(dependency)).to.deep.equal([
      { name: 'Non-pinned latest 1.0.0 build', value: `${PACKAGE2_ID}|1.0.0.LATEST`, short: '1.0.0.LATEST' },
    ]);
  });

  it('buildInteractiveChoices ranks choices and de-duplicates by version ID', () => {
    const choices = service.buildInteractiveChoices(dependency, '', []);

    expect(choices.map((c) => c.value)).to.deep.equal([
      CURRENT_VERSION_ID,
      NEWER_MINOR_VERSION_ID,
      RELEASED_VERSION_ID,
      `${PACKAGE2_ID}|1.0.0.LATEST`,
      CURRENT_VERSION_ID,
    ]);
    expect(choices[0].name).to.equal('Latest 1.0.0 version on main build branch: 1.0.0-2');
    expect(choices[1].name).to.equal('Latest 1.0 version on main build branch: 1.1.0-1');
    expect(choices[4].name).to.equal('Current version specified: 1.0.0-2');
  });
});
