/*
 * Copyright (c) 2026, Clay Chipps; Copyright (c) 2026 Salesforce, Inc.
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

import { PACKAGE_PREFIX_PACKAGE2, PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION } from '../../common/packageUtils.js';

export type ParsedDependency = {
  subscriberPackageVersionId?: string;
  package2Id?: string;
  versionNumber?: string;
  majorVersion?: number;
  minorVersion?: number;
  patchVersion?: number;
  buildVersion?: number;
  isLatest: boolean;
  isPinned: boolean;
};

export function parseDependency(resolvedPackage: string, versionNumber?: string): ParsedDependency {
  const result: ParsedDependency = { isLatest: false, isPinned: false };

  if (resolvedPackage.startsWith(PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION)) {
    result.subscriberPackageVersionId = resolvedPackage;
    result.isPinned = true;
    return result;
  }

  if (resolvedPackage.startsWith(PACKAGE_PREFIX_PACKAGE2)) {
    result.package2Id = resolvedPackage;
    result.versionNumber = versionNumber;

    const versionWorking = (versionNumber ?? '').toUpperCase().replace('-LATEST', '').replace('.LATEST', '');
    const parts = versionWorking.split('.');

    result.majorVersion = parts[0] ? parseInt(parts[0], 10) : undefined;
    result.minorVersion = parts[1] ? parseInt(parts[1], 10) : undefined;
    result.patchVersion = parts[2] ? parseInt(parts[2], 10) : undefined;
    result.buildVersion = parts[3] ? parseInt(parts[3], 10) : undefined;
    result.isLatest = (versionNumber ?? '').toUpperCase().endsWith('LATEST');
    result.isPinned = !result.isLatest;
    return result;
  }

  return result;
}
