/*
 * Copyright (c) 2026, SimplySF.
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

import { QueryJobV2 } from '@jsforce/jsforce-node/lib/api/bulk2.js';
import type { Schema } from '@jsforce/jsforce-node';
import { Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import sinon from 'sinon';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Response } from 'undici';
import { queryRecords } from '../../src/query/queryRecords.js';

vi.mock('undici', async () => {
  const actual = await vi.importActual<typeof import('undici')>('undici');
  return { ...actual, fetch: vi.fn() };
});

const { fetch: mockFetch } = await import('undici');

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of gen) {
    items.push(item);
  }
  return items;
}

describe('queryRecords', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
    vi.mocked(mockFetch).mockReset();
  });

  it('uses the REST API and flattens relationship fields when the count is at or under the threshold', async () => {
    const connection = await testOrg.getConnection();

    const queryStub = $$.SANDBOX.stub(Connection.prototype, 'query').resolves({
      totalSize: 2000,
      done: true,
      records: [],
    });
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      totalSize: 1,
      done: true,
      records: [
        {
          attributes: { type: 'Contact', url: '/services/data/v62.0/sobjects/Contact/003xx' },
          Id: '003xx0000000001',
          Name: 'Jane Doe',
          Account: { Name: 'Acme' },
        },
      ],
    } as never);

    const records = await collect(queryRecords(connection, 'SELECT Id, Name, Account.Name FROM Contact ORDER BY Name'));

    expect(records).to.deep.equal([{ Id: '003xx0000000001', Name: 'Jane Doe', 'Account.Name': 'Acme' }]);
    expect(queryStub.firstCall.args[0]).to.equal('SELECT COUNT() FROM Contact');
  });

  it('uses Bulk API v2 when the count exceeds the threshold', async () => {
    const connection = await testOrg.getConnection();

    $$.SANDBOX.stub(Connection.prototype, 'query').resolves({ totalSize: 2001, done: true, records: [] });
    $$.SANDBOX.stub(Connection.prototype, 'refreshAuth').resolves();
    $$.SANDBOX.stub(QueryJobV2.prototype, 'open').resolves({ id: '750xx', numberRecordsProcessed: 2001 } as never);
    $$.SANDBOX.stub(QueryJobV2.prototype, 'poll').callsFake(async function (this: QueryJobV2<Schema>) {
      this.emit('jobComplete', { id: '750xx', numberRecordsProcessed: 2001 });
    });

    vi.mocked(mockFetch).mockResolvedValueOnce(
      new Response('Id,Name\n001,Foo\n002,Bar\n', { status: 200, headers: { 'sforce-locator': 'null' } }),
    );

    const records = await collect(queryRecords(connection, 'SELECT Id, Name FROM Contact'));

    expect(records).to.deep.equal([
      { Id: '001', Name: 'Foo' },
      { Id: '002', Name: 'Bar' },
    ]);
  });

  it('respects a custom bulkThreshold', async () => {
    const connection = await testOrg.getConnection();

    $$.SANDBOX.stub(Connection.prototype, 'query').resolves({ totalSize: 5, done: true, records: [] });
    $$.SANDBOX.stub(Connection.prototype, 'refreshAuth').resolves();
    $$.SANDBOX.stub(QueryJobV2.prototype, 'open').resolves({ id: '750xx', numberRecordsProcessed: 5 } as never);
    $$.SANDBOX.stub(QueryJobV2.prototype, 'poll').callsFake(async function (this: QueryJobV2<Schema>) {
      this.emit('jobComplete', { id: '750xx', numberRecordsProcessed: 5 });
    });

    vi.mocked(mockFetch).mockResolvedValueOnce(
      new Response('Id\n001\n', { status: 200, headers: { 'sforce-locator': 'null' } }),
    );

    const records = await collect(queryRecords(connection, 'SELECT Id FROM Contact', { bulkThreshold: 1 }));

    expect(records).to.deep.equal([{ Id: '001' }]);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('strips ORDER BY, LIMIT, and OFFSET when deriving the COUNT() query', async () => {
    const connection = await testOrg.getConnection();

    const queryStub = $$.SANDBOX.stub(Connection.prototype, 'query').resolves({
      totalSize: 0,
      done: true,
      records: [],
    });
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      totalSize: 0,
      done: true,
      records: [],
    });

    await collect(
      queryRecords(connection, "SELECT Id FROM Contact WHERE Name = 'Foo' ORDER BY Name ASC LIMIT 10 OFFSET 5"),
    );

    expect(queryStub.firstCall.args[0]).to.equal("SELECT COUNT() FROM Contact WHERE Name = 'Foo'");
  });
});
