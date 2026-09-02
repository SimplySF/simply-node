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

import { describe, expect, it } from 'vitest';
import { parseDependency } from '../src/schemas/manage/parsedDependency.js';

describe('parseDependency', () => {
  it('parses a subscriber package version ID as pinned', () => {
    expect(parseDependency('04t000000000001AAA')).to.deep.equal({
      subscriberPackageVersionId: '04t000000000001AAA',
      isPinned: true,
      isLatest: false,
    });
  });

  it('ignores a versionNumber argument for a subscriber package version ID', () => {
    expect(parseDependency('04t000000000001AAA', '1.0.0.5')).to.deep.equal({
      subscriberPackageVersionId: '04t000000000001AAA',
      isPinned: true,
      isLatest: false,
    });
  });

  it('parses a Package2Id with a numeric version as pinned', () => {
    expect(parseDependency('0Ho000000000000AAA', '1.2.3.4')).to.deep.equal({
      package2Id: '0Ho000000000000AAA',
      versionNumber: '1.2.3.4',
      majorVersion: 1,
      minorVersion: 2,
      patchVersion: 3,
      buildVersion: 4,
      isLatest: false,
      isPinned: true,
    });
  });

  it('parses a Package2Id with a NEXT/LATEST build suffix as not latest and not pinned', () => {
    const result = parseDependency('0Ho000000000000AAA', '1.2.3.LATEST');

    expect(result.isLatest).to.equal(true);
    expect(result.isPinned).to.equal(false);
    expect(result.majorVersion).to.equal(1);
    expect(result.minorVersion).to.equal(2);
    expect(result.patchVersion).to.equal(3);
    expect(result.buildVersion).to.be.undefined;
  });

  it('parses a Package2Id with a -LATEST branch suffix the same way as .LATEST', () => {
    const result = parseDependency('0Ho000000000000AAA', '1.2.3-LATEST');

    expect(result.isLatest).to.equal(true);
    expect(result.isPinned).to.equal(false);
  });

  it('returns neither ID field set for an unrecognized prefix', () => {
    expect(parseDependency('not-a-package-id')).to.deep.equal({ isLatest: false, isPinned: false });
  });
});
