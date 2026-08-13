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
import { PackagingSObjects } from '@salesforce/packaging';
import { BasePackageDirWithDependencies } from '../schemas/sfdx-project/packageDirs.js';

type PackageInstallRequest = PackagingSObjects.PackageInstallRequest;

/** ID prefix for a `Package2` (a 2GP package definition). */
export const PACKAGE_PREFIX_PACKAGE2 = '0Ho';
/** ID prefix for a `Package2Version` (a 2GP package version, as known to the Dev Hub). */
export const PACKAGE_PREFIX_PACKAGE2_VERSION = '05i';
/** ID prefix for a `SubscriberPackage` (a package as installed/installable in a subscriber org). */
export const PACKAGE_PREFIX_SUBSCRIBER_PACKAGE = '033';
/** ID prefix for a `SubscriberPackageVersion` (an installable version of a subscriber package). */
export const PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION = '04t';

/**
 * @param inputToEvaluate - The ID (or other string) to check.
 * @returns Whether `inputToEvaluate` looks like a `Package2Id`.
 */
export const isPackage2Id = (inputToEvaluate: string): boolean =>
  inputToEvaluate ? inputToEvaluate.startsWith(PACKAGE_PREFIX_PACKAGE2) : false;

/**
 * @param inputToEvaluate - The ID (or other string) to check.
 * @returns Whether `inputToEvaluate` looks like a `Package2VersionId`.
 */
export const isPackage2VersionId = (inputToEvaluate: string): boolean =>
  inputToEvaluate ? inputToEvaluate.startsWith(PACKAGE_PREFIX_PACKAGE2_VERSION) : false;

/**
 * @param inputToEvaluate - The ID (or other string) to check.
 * @returns Whether `inputToEvaluate` looks like a `SubscriberPackageId`.
 */
export const isSubscriberPackageId = (inputToEvaluate: string): boolean =>
  inputToEvaluate ? inputToEvaluate.startsWith(PACKAGE_PREFIX_SUBSCRIBER_PACKAGE) : false;

/**
 * @param inputToEvaluate - The ID (or other string) to check.
 * @returns Whether `inputToEvaluate` looks like a `SubscriberPackageVersionId`.
 */
export const isSubscriberPackageVersionId = (inputToEvaluate: string): boolean =>
  inputToEvaluate ? inputToEvaluate.startsWith(PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION) : false;

/**
 * Format a `PackageInstallRequest`'s errors as a single human-readable, numbered-list string.
 *
 * @param request - The (failed) package install request to summarize.
 * @returns A numbered list of error messages, or `'<empty>'` if there were none.
 */
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

/**
 * Type guard narrowing a package directory to one that declares a `dependencies` array.
 *
 * @param packageDir - The package directory entry to check.
 * @returns Whether `packageDir` has a `dependencies` array.
 */
export const isDependenciesPackagingDirectory = (
  packageDir: NamedPackageDir,
): packageDir is NamedPackageDir & BasePackageDirWithDependencies =>
  'dependencies' in packageDir && Array.isArray(packageDir?.dependencies);
