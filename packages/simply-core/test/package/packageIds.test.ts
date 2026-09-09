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

import { describe, expect, it } from 'vitest';
import {
  isPackage2Id,
  isPackage2VersionId,
  isSubscriberPackageId,
  isSubscriberPackageVersionId,
} from '../../src/package/packageIds.js';

describe('package ID predicates', () => {
  it('recognizes each ID type by its prefix', () => {
    expect(isPackage2Id('0Ho000000000001AAA')).to.equal(true);
    expect(isPackage2VersionId('05i000000000001AAA')).to.equal(true);
    expect(isSubscriberPackageId('033000000000001AAA')).to.equal(true);
    expect(isSubscriberPackageVersionId('04t000000000001AAA')).to.equal(true);
  });

  it('does not confuse one ID type for another', () => {
    expect(isPackage2Id('04t000000000001AAA')).to.equal(false);
    expect(isSubscriberPackageVersionId('0Ho000000000001AAA')).to.equal(false);
    expect(isPackage2VersionId('033000000000001AAA')).to.equal(false);
    expect(isSubscriberPackageId('05i000000000001AAA')).to.equal(false);
  });

  it('returns false for an empty string rather than matching everything', () => {
    expect(isPackage2Id('')).to.equal(false);
    expect(isPackage2VersionId('')).to.equal(false);
    expect(isSubscriberPackageId('')).to.equal(false);
    expect(isSubscriberPackageVersionId('')).to.equal(false);
  });

  it('rejects a package alias, which is what these guard against in practice', () => {
    expect(isSubscriberPackageVersionId('MyPackage@1.2.3-4')).to.equal(false);
    expect(isPackage2Id('MyPackage')).to.equal(false);
  });

  it('accepts the 15-character ID form as well as the 18-character one', () => {
    expect(isSubscriberPackageVersionId('04t000000000001')).to.equal(true);
  });
});
