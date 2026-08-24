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

import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { ComponentSet, ComponentStatus } from '@salesforce/source-deploy-retrieve';
import sinon from 'sinon';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { retrieveCustomSite } from '../../src/common/retrieveCustomSite.js';

describe('retrieveCustomSite', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  it('returns the retrieved file path when the component exists in the org', async () => {
    const connection = await testOrg.getConnection();
    const fakeRetrieveResult = {
      getFileResponses: () => [
        {
          fullName: 'Partner_Portal',
          type: 'CustomSite',
          filePath: '/tmp/force-app/sites/Partner_Portal.site-meta.xml',
          state: ComponentStatus.Created,
        },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'retrieve').resolves({
      pollStatus: sinon.stub().resolves(fakeRetrieveResult),
    } as never);

    const result = await retrieveCustomSite(connection, 'Partner_Portal', '/tmp/force-app');

    expect(result).to.equal('/tmp/force-app/sites/Partner_Portal.site-meta.xml');
  });

  it('returns undefined when the org has no matching CustomSite', async () => {
    const connection = await testOrg.getConnection();
    const fakeRetrieveResult = { getFileResponses: () => [] };
    $$.SANDBOX.stub(ComponentSet.prototype, 'retrieve').resolves({
      pollStatus: sinon.stub().resolves(fakeRetrieveResult),
    } as never);

    const result = await retrieveCustomSite(connection, 'Partner_Portal', '/tmp/force-app');

    expect(result).to.be.undefined;
  });

  it('returns undefined when the retrieve reports the component as failed', async () => {
    const connection = await testOrg.getConnection();
    const fakeRetrieveResult = {
      getFileResponses: () => [
        {
          fullName: 'Partner_Portal',
          type: 'CustomSite',
          error: 'insufficient access',
          state: ComponentStatus.Failed,
        },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'retrieve').resolves({
      pollStatus: sinon.stub().resolves(fakeRetrieveResult),
    } as never);

    const result = await retrieveCustomSite(connection, 'Partner_Portal', '/tmp/force-app');

    expect(result).to.be.undefined;
  });
});
