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

import { Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import sinon from 'sinon';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { verifyDomain } from '../src/verifyDomain.js';

describe('verifyDomain', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  it('reports found with no bound sites when the domain exists with no DomainSites', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(Connection.prototype, 'query').resolves({
      done: true,
      totalSize: 1,
      records: [{ Id: '0Dm000000000001', Domain: 'partners.acme.com', DomainSites: { records: [] } }],
    });

    const result = await verifyDomain(connection, 'partners.acme.com');

    expect(result).to.deep.equal({ status: 'found', domainId: '0Dm000000000001', boundToSiteIds: [] });
  });

  it('reports the site ids already bound via DomainSites', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(Connection.prototype, 'query').resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Id: '0Dm000000000001',
          Domain: 'partners.acme.com',
          DomainSites: { records: [{ Id: '0Wf000000000001', SiteId: '0DB000000000001', PathPrefix: 'help' }] },
        },
      ],
    });

    const result = await verifyDomain(connection, 'partners.acme.com');

    expect(result.status).to.equal('found');
    expect(result.boundToSiteIds).to.deep.equal(['0DB000000000001']);
  });

  it('reports missing when no Domain record matches', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(Connection.prototype, 'query').resolves({ done: true, totalSize: 0, records: [] });

    const result = await verifyDomain(connection, 'nowhere.acme.com');

    expect(result).to.deep.equal({ status: 'missing', boundToSiteIds: [] });
  });

  it('reports unavailable rather than throwing when the query itself fails', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(Connection.prototype, 'query').rejects(new Error('INSUFFICIENT_ACCESS'));

    const result = await verifyDomain(connection, 'partners.acme.com');

    expect(result).to.deep.equal({ status: 'unavailable', boundToSiteIds: [] });
  });

  it('escapes a domain containing a quote in the SOQL literal', async () => {
    const connection = await testOrg.getConnection();
    const queryStub = $$.SANDBOX.stub(Connection.prototype, 'query').resolves({
      done: true,
      totalSize: 0,
      records: [],
    });

    await verifyDomain(connection, "partners'.acme.com");

    expect(queryStub.firstCall.args[0]).to.include("partners\\'.acme.com");
  });
});
