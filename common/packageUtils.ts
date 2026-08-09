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

import { NamedPackageDir } from '@salesforce/core';
import { InstalledPackages, PackagingSObjects } from '@salesforce/packaging';
import { BasePackageDirWithDependencies } from '../schemas/sfdx-project/packageDirs.js';

type PackageInstallRequest = PackagingSObjects.PackageInstallRequest;

export const PACKAGE_PREFIX_PACKAGE2 = '0Ho';
export const PACKAGE_PREFIX_PACKAGE2_VERSION = '05i';
export const PACKAGE_PREFIX_SUBSCRIBER_PACKAGE = '033';
export const PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION = '04t';

export const isPackage2Id = (inputToEvaluate: string): boolean =>
  inputToEvaluate ? inputToEvaluate.startsWith(PACKAGE_PREFIX_PACKAGE2) : false;

export const isPackage2VersionId = (inputToEvaluate: string): boolean =>
  inputToEvaluate ? inputToEvaluate.startsWith(PACKAGE_PREFIX_PACKAGE2_VERSION) : false;

export const isSubscriberPackageId = (inputToEvaluate: string): boolean =>
  inputToEvaluate ? inputToEvaluate.startsWith(PACKAGE_PREFIX_SUBSCRIBER_PACKAGE) : false;

export const isSubscriberPackageVersionId = (inputToEvaluate: string): boolean =>
  inputToEvaluate ? inputToEvaluate.startsWith(PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION) : false;

export const isSubscriberPackageVersionInstalled = (
  installedPackages: InstalledPackages[],
  subscriberPackageVersionId: string
): boolean =>
  installedPackages.some(
    (installedPackage) => installedPackage?.SubscriberPackageVersion?.Id === subscriberPackageVersionId
  );

export const reducePackageInstallRequestErrors = (request: PackageInstallRequest): string => {
  let errorMessage = '<empty>';
  const errors = request?.Errors?.errors;
  if (errors?.length) {
    errorMessage = 'Installation errors: ';
    for (let i = 0; i < errors.length; i++) {
      errorMessage += `\n${i + 1}) ${errors[i].message}`;
    }
  }

  return errorMessage;
};

export const isDependenciesPackagingDirectory = (
  packageDir: NamedPackageDir
): packageDir is NamedPackageDir & BasePackageDirWithDependencies =>
  'dependencies' in packageDir && Array.isArray(packageDir?.dependencies);
