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

import { Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import sinon from 'sinon';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chunkedInQuery } from '../../src/query/chunkedInQuery.js';

describe('chunkedInQuery', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  it('issues one query per chunk and concatenates every record', async () => {
    const connection = await testOrg.getConnection();
    const stub = $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery');
    stub.onCall(0).resolves({ totalSize: 1, done: true, records: [{ Id: 'a' }] } as never);
    stub.onCall(1).resolves({ totalSize: 1, done: true, records: [{ Id: 'b' }] } as never);

    const records = await chunkedInQuery<{ Id: string }>(
      connection,
      ['1', '2', '3'],
      (inClause) => `SELECT Id FROM Account WHERE Name IN (${inClause})`,
      { chunkSize: 2 },
    );

    expect(stub.callCount).to.equal(2);
    expect(records).to.deep.equal([{ Id: 'a' }, { Id: 'b' }]);
  });

  it('quotes and comma-joins each chunk into the IN clause', async () => {
    const connection = await testOrg.getConnection();
    const stub = $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      totalSize: 0,
      done: true,
      records: [],
    });

    await chunkedInQuery(connection, ['Account', 'Contact'], (inClause) => `SELECT Id WHERE X IN (${inClause})`, {
      chunkSize: 10,
    });

    expect(stub.firstCall.args[0]).to.equal("SELECT Id WHERE X IN ('Account','Contact')");
  });

  it('escapes quotes and backslashes so a value cannot break out of the literal', async () => {
    const connection = await testOrg.getConnection();
    const stub = $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      totalSize: 0,
      done: true,
      records: [],
    });

    await chunkedInQuery(connection, ["O'Brien"], (inClause) => `SELECT Id WHERE X IN (${inClause})`, {
      chunkSize: 10,
    });

    expect(stub.firstCall.args[0]).to.equal("SELECT Id WHERE X IN ('O\\'Brien')");
  });

  it('passes the tooling flag through to the query', async () => {
    const connection = await testOrg.getConnection();
    const stub = $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      totalSize: 0,
      done: true,
      records: [],
    });

    await chunkedInQuery(connection, ['a'], (inClause) => `SELECT Id WHERE X IN (${inClause})`, {
      chunkSize: 10,
      tooling: true,
    });

    expect(stub.firstCall.args[1]).to.deep.equal({ tooling: true });
  });

  it('issues no query at all for an empty value list', async () => {
    const connection = await testOrg.getConnection();
    const stub = $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery');

    expect(await chunkedInQuery(connection, [], () => 'SELECT Id', { chunkSize: 10 })).to.deep.equal([]);
    expect(stub.callCount).to.equal(0);
  });

  it('rejects on query failure by default', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').rejects(new Error('sObject type Package2Member'));

    await expect(
      chunkedInQuery(connection, ['a'], (inClause) => `SELECT Id WHERE X IN (${inClause})`, { chunkSize: 10 }),
    ).rejects.toThrow('sObject type Package2Member');
  });

  it('skips a failed chunk and keeps the rest when told to tolerate failure', async () => {
    const connection = await testOrg.getConnection();
    const stub = $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery');
    stub.onCall(0).rejects(new Error('not available in this org'));
    stub.onCall(1).resolves({ totalSize: 1, done: true, records: [{ Id: 'b' }] } as never);

    const records = await chunkedInQuery<{ Id: string }>(
      connection,
      ['1', '2'],
      (inClause) => `SELECT Id WHERE X IN (${inClause})`,
      { chunkSize: 1, tolerateFailure: true },
    );

    expect(records).to.deep.equal([{ Id: 'b' }]);
  });
});
