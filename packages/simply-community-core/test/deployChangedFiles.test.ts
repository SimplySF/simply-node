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

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Duration } from '@salesforce/kit';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { ComponentSet, ComponentStatus } from '@salesforce/source-deploy-retrieve';
import sinon from 'sinon';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deployChangedFiles } from '../src/deployChangedFiles.js';

describe('deployChangedFiles', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();
  let projectDir: string;
  let siteFile: string;

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'simply-community-deploy-test-'));
    siteFile = path.join(projectDir, 'sites', 'Partner_Portal.site-meta.xml');
    await fs.mkdir(path.dirname(siteFile), { recursive: true });
    await fs.writeFile(
      siteFile,
      `<?xml version="1.0" encoding="UTF-8"?>\n<CustomSite xmlns="http://soap.sforce.com/2006/04/metadata"><label>Partner Portal</label></CustomSite>\n`,
      'utf-8',
    );
  });

  afterEach(async () => {
    $$.restore();
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  it('reports success and the deployed component on a successful deploy', async () => {
    const connection = await testOrg.getConnection();

    const fakeDeployResult = {
      response: { id: '0Af000000000001', status: 'Succeeded', success: true },
      getFileResponses: () => [
        { fullName: 'Partner_Portal', type: 'CustomSite', filePath: siteFile, state: ComponentStatus.Changed },
      ],
    };
    const fakeMetadataApiDeploy = { pollStatus: sinon.stub().resolves(fakeDeployResult) };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves(fakeMetadataApiDeploy as never);

    const result = await deployChangedFiles({
      connection,
      filePaths: [siteFile],
      wait: Duration.minutes(1),
    });

    expect(result).to.deep.equal({
      id: '0Af000000000001',
      status: 'Succeeded',
      success: true,
      componentsDeployed: ['Partner_Portal'],
      failures: [],
    });
  });

  it('reports failures without throwing', async () => {
    const connection = await testOrg.getConnection();

    const fakeDeployResult = {
      response: { id: '0Af000000000002', status: 'Failed', success: false },
      getFileResponses: () => [
        {
          fullName: 'Partner_Portal',
          type: 'CustomSite',
          filePath: siteFile,
          state: ComponentStatus.Failed,
          error: 'Domain is not registered',
        },
      ],
    };
    const fakeMetadataApiDeploy = { pollStatus: sinon.stub().resolves(fakeDeployResult) };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves(fakeMetadataApiDeploy as never);

    const result = await deployChangedFiles({
      connection,
      filePaths: [siteFile],
      wait: Duration.minutes(1),
    });

    expect(result.success).to.equal(false);
    expect(result.componentsDeployed).to.deep.equal([]);
    expect(result.failures).to.deep.equal([
      { fullName: 'Partner_Portal', type: 'CustomSite', filePath: siteFile, error: 'Domain is not registered' },
    ]);
  });
});
