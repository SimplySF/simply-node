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
import sinon from 'sinon';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteApexLogsViaBulkApi,
  deleteApexLogsViaCollections,
  queryApexLogIdsViaBulkApi,
  queryApexLogIdsViaRest,
} from '../src/apexLogsPurge.js';

/* eslint-disable camelcase -- Bulk API v2 result field names (sf__Id, sf__Error) */

describe('apexLogsPurge', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  describe('queryApexLogIdsViaRest', () => {
    it('returns the Ids from a single Tooling API response', async () => {
      const connection = await testOrg.getConnection();
      $$.SANDBOX.stub(connection.tooling, 'query').resolves({
        records: [{ Id: '07L000000000001AAA' }, { Id: '07L000000000002AAA' }],
        done: true,
        totalSize: 2,
      });

      const ids = await queryApexLogIdsViaRest(connection, 'SELECT Id FROM ApexLog');

      expect(ids).toEqual(['07L000000000001AAA', '07L000000000002AAA']);
    });
  });

  describe('queryApexLogIdsViaBulkApi', () => {
    it('collects Ids from the streamed query results', async () => {
      const connection = await testOrg.getConnection();
      $$.SANDBOX.stub(connection.bulk2, 'query').resolves([
        { Id: '07L000000000001AAA' },
        { Id: '07L000000000002AAA' },
      ] as never);

      const ids = await queryApexLogIdsViaBulkApi(connection, 'SELECT Id FROM ApexLog', 30_000);

      expect(ids).toEqual(['07L000000000001AAA', '07L000000000002AAA']);
    });
  });

  describe('deleteApexLogsViaCollections', () => {
    it('deletes in a single chunk and reports success/failure per record', async () => {
      const connection = await testOrg.getConnection();
      $$.SANDBOX.stub(connection, 'delete').resolves([
        { id: '07L000000000001AAA', success: true, errors: [] },
        { id: '07L000000000002AAA', success: false, errors: [{ message: 'INSUFFICIENT_ACCESS' }] },
      ] as never);

      const results = await deleteApexLogsViaCollections(connection, ['07L000000000001AAA', '07L000000000002AAA']);

      expect(results).toEqual([
        { Id: '07L000000000001AAA', Success: true, Error: undefined },
        { Id: '07L000000000002AAA', Success: false, Error: 'INSUFFICIENT_ACCESS' },
      ]);
    });

    it('deletes in 200-record chunks and reports running totals via onChunkComplete', async () => {
      const connection = await testOrg.getConnection();
      const deleteStub = $$.SANDBOX.stub(connection, 'delete').callsFake(async (_type, ids) =>
        (ids as string[]).map((id) => ({ id, success: true, errors: [] })),
      );
      const logIds = Array.from({ length: 250 }, (_, i) => `07L${String(i).padStart(15, '0')}AAA`);
      const progress: Array<[number, number]> = [];

      const results = await deleteApexLogsViaCollections(connection, logIds, (purged, total) => {
        progress.push([purged, total]);
      });

      expect(results).toHaveLength(250);
      expect(deleteStub.callCount).toBe(2);
      expect(progress).toEqual([
        [200, 250],
        [250, 250],
      ]);
    });
  });

  describe('deleteApexLogsViaBulkApi', () => {
    it('maps successful and failed rows, falling back to the submitted Id for a failure with no sf__Id', async () => {
      const connection = await testOrg.getConnection();
      $$.SANDBOX.stub(connection.bulk2, 'loadAndWaitForResults').resolves({
        successfulResults: [{ sf__Id: '07L000000000001AAA' }],
        failedResults: [{ sf__Id: '', sf__Error: 'ENTITY_IS_DELETED', Id: '07L000000000002AAA' }],
      } as never);

      const results = await deleteApexLogsViaBulkApi(connection, ['07L000000000001AAA', '07L000000000002AAA'], 30_000);

      expect(results).toEqual([
        { Id: '07L000000000001AAA', Success: true },
        { Id: '07L000000000002AAA', Success: false, Error: 'ENTITY_IS_DELETED' },
      ]);
    });
  });
});
