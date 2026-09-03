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

import type { Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import sinon from 'sinon';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { scanOrgApexTriggers } from '../src/at4dxApexTriggerOrgScan.js';

/**
 * `autoFetchQuery`'s real return type is generic over a jsforce `Schema` the mocked `Connection` here
 * has no concrete instance of, so a query-shaped mock (`{ Name, Body, Status }`) can't structurally
 * satisfy it without a cast — this is that cast, applied once instead of at every `.resolves()` call.
 */
type OrgQueryResult = Awaited<ReturnType<Connection['autoFetchQuery']>>;

function queryResult(records: Array<Record<string, unknown>>): OrgQueryResult {
  return { records, done: true, totalSize: records.length } as unknown as OrgQueryResult;
}

describe('scanOrgApexTriggers', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  it('queries the Tooling API and parses each trigger Body', async () => {
    const connection = await testOrg.getConnection();
    const autoFetchQuery = $$.SANDBOX.stub(connection, 'autoFetchQuery').resolves(
      queryResult([
        {
          Name: 'AccountTrigger',
          Body: 'trigger AccountTrigger on Account (before insert) {\n  fflib_SObjectDomain.triggerHandler(AccountsDomain.class);\n}\n',
          Status: 'Active',
        },
      ]),
    );

    const records = await scanOrgApexTriggers(connection);

    expect(autoFetchQuery.calledWithMatch('SELECT Name, Body, Status FROM ApexTrigger', { tooling: true })).toBe(true);
    expect(records).toEqual([
      {
        name: 'AccountTrigger',
        sobject: 'Account',
        triggerHandlerClasses: ['AccountsDomain'],
        active: true,
        source: testOrg.username,
      },
    ]);
  });

  it('marks a Status: Inactive trigger as active: false', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(connection, 'autoFetchQuery').resolves(
      queryResult([
        {
          Name: 'AccountTrigger',
          Body: 'trigger AccountTrigger on Account (before insert) {\n  fflib_SObjectDomain.triggerHandler(AccountsDomain.class);\n}\n',
          Status: 'Inactive',
        },
      ]),
    );

    const records = await scanOrgApexTriggers(connection);

    expect(records[0].active).toBe(false);
  });

  it('skips a record whose Body does not parse as a trigger header', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(connection, 'autoFetchQuery').resolves(
      queryResult([{ Name: 'Corrupt', Body: 'not a trigger', Status: 'Active' }]),
    );

    const records = await scanOrgApexTriggers(connection);

    expect(records).toEqual([]);
  });

  it('returns an empty array when the org has no triggers', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(connection, 'autoFetchQuery').resolves(queryResult([]));

    expect(await scanOrgApexTriggers(connection)).toEqual([]);
  });
});
