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
import { describe, expect, it } from 'vitest';
import { isDependenciesPackagingDirectory, reducePackageInstallRequestErrors } from '../src/packageUtils.js';

type PackageInstallRequest = PackagingSObjects.PackageInstallRequest;

describe('reducePackageInstallRequestErrors', () => {
  it('returns a placeholder when there are no errors', () => {
    const request = {} as PackageInstallRequest;

    expect(reducePackageInstallRequestErrors(request)).to.equal('<empty>');
  });

  it('returns a placeholder when the errors array is empty', () => {
    const request = { Errors: { errors: [] } } as unknown as PackageInstallRequest;

    expect(reducePackageInstallRequestErrors(request)).to.equal('<empty>');
  });

  it('formats a single error as a numbered list of one', () => {
    const request = { Errors: { errors: [{ message: 'boom' }] } } as unknown as PackageInstallRequest;

    expect(reducePackageInstallRequestErrors(request)).to.equal('Installation errors: \n1) boom');
  });

  it('formats multiple errors as a numbered list', () => {
    const request = {
      Errors: { errors: [{ message: 'first' }, { message: 'second' }] },
    } as unknown as PackageInstallRequest;

    expect(reducePackageInstallRequestErrors(request)).to.equal('Installation errors: \n1) first\n2) second');
  });
});

describe('isDependenciesPackagingDirectory', () => {
  it('returns true when dependencies is an array', () => {
    const packageDir = { path: 'force-app', dependencies: [] } as unknown as NamedPackageDir;

    expect(isDependenciesPackagingDirectory(packageDir)).to.equal(true);
  });

  it('returns false when dependencies is missing', () => {
    const packageDir = { path: 'force-app' } as unknown as NamedPackageDir;

    expect(isDependenciesPackagingDirectory(packageDir)).to.equal(false);
  });

  it('returns false when dependencies is not an array', () => {
    const packageDir = { path: 'force-app', dependencies: 'not-an-array' } as unknown as NamedPackageDir;

    expect(isDependenciesPackagingDirectory(packageDir)).to.equal(false);
  });
});
