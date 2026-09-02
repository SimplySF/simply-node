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

import { NamedPackageDir } from '@salesforce/core';
import { PackagingSObjects } from '@salesforce/packaging';
import { BasePackageDirWithDependencies } from '../schemas/sfdx-project/packageDirs.js';

type PackageInstallRequest = PackagingSObjects.PackageInstallRequest;

// The package ID prefixes and their predicates live in @simplysf/simply-core so simply-cicd can
// share them. Re-exported here so this module stays the one import site for package helpers.
export {
  isPackage2Id,
  isPackage2VersionId,
  isSubscriberPackageId,
  isSubscriberPackageVersionId,
  PACKAGE_PREFIX_PACKAGE2,
  PACKAGE_PREFIX_PACKAGE2_VERSION,
  PACKAGE_PREFIX_SUBSCRIBER_PACKAGE,
  PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION,
} from '@simplysf/simply-core';

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
