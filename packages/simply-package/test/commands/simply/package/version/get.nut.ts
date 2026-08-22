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

import path from 'node:path';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PackageVersionGetResult } from './../../../../../src/commands/simply/package/version/get.js';

describe('simply package version get', () => {
  let session: TestSession;

  beforeAll(async () => {
    // No org flags on this command, so the session needs no dev hub and no scratch org.
    session = await TestSession.create({
      devhubAuthStrategy: 'NONE',
      project: {
        sourceDir: path.join(process.cwd(), 'test/reference-projects/version-project'),
      },
    });
  });

  it('should print only the version to stdout', () => {
    const output = execCmd('simply package version get --package test-package', { ensureExitCode: 0 });

    expect(output?.shellOutput?.stdout.trim()).to.equal('0.1.0+2');
  });

  it('should return a dependency alias version as json', () => {
    const output = execCmd<PackageVersionGetResult>('simply package version get --package test-package --json', {
      ensureExitCode: 0,
    }).jsonOutput;

    expect(output!.result.version).to.equal('0.1.0+2');
    expect(output!.result.source).to.equal('dependency');
    expect(output!.result.packageDirectory).to.equal('sfdx-source');
    expect(output!.result.subscriberPackageVersionId).to.equal('04t4W000002nizeQAA');
  });

  it('should return a non-pinned dependency version number', () => {
    const output = execCmd<PackageVersionGetResult>('simply package version get --package ESBaseCodeLWC --json', {
      ensureExitCode: 0,
    }).jsonOutput;

    expect(output!.result.version).to.equal('57.0.0.LATEST');
  });

  it('should resolve a dependency declared as a raw subscriber package version id', () => {
    const output = execCmd<PackageVersionGetResult>('simply package version get --package ESSpaceMgmtLWC --json', {
      ensureExitCode: 0,
    }).jsonOutput;

    expect(output!.result.version).to.equal('57.0.0-4');
    expect(output!.result.subscriberPackageVersionId).to.equal('04t4W000002nizsQAA');
  });

  it("should return the project's own package version", () => {
    const output = execCmd<PackageVersionGetResult>('simply package version get --package simply-version --json', {
      ensureExitCode: 0,
    }).jsonOutput;

    expect(output!.result.version).to.equal('57.0.0.NEXT');
    expect(output!.result.source).to.equal('packageDirectory');
  });

  it('should fail when the package is not declared', () => {
    const output = execCmd('simply package version get --package absent-package --json', { ensureExitCode: 1 });

    expect(output?.shellOutput?.stdout).to.contain('absent-package');
  });

  afterAll(async () => {
    await session?.clean();
  });
});
