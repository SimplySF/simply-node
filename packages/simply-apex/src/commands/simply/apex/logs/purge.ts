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

import { Messages } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { requireConnection, targetOrgFlags } from '@simplysf/simply-plugin-kit';
import {
  deleteApexLogsViaBulkApi,
  deleteApexLogsViaCollections,
  queryApexLogIdsViaBulkApi,
  queryApexLogIdsViaRest,
  type ApexLogsPurgeResult,
} from '../../../../common/apexLogsPurge.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-apex', 'simply.apex.logs.purge');

export type { ApexLogsPurgeResult } from '../../../../common/apexLogsPurge.js';

/**
 * Deletes `ApexLog` records from the target org. By default all logs are purged; use `--where`
 * to scope the deletion to a subset of logs.
 */
export default class ApexLogsPurge extends SfCommand<ApexLogsPurgeResult[]> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    ...targetOrgFlags,
    where: Flags.string({
      summary: messages.getMessage('flags.where.summary'),
      description: messages.getMessage('flags.where.description'),
      char: 'w',
    }),
    'use-bulk-api': Flags.boolean({
      summary: messages.getMessage('flags.use-bulk-api.summary'),
      description: messages.getMessage('flags.use-bulk-api.description'),
      char: 'b',
      default: false,
    }),
    wait: Flags.duration({
      unit: 'minutes',
      summary: messages.getMessage('flags.wait.summary'),
      description: messages.getMessage('flags.wait.description'),
      // jsforce defaults bulk polling to 30 seconds, which no real purge finishes within.
      default: Duration.minutes(30),
    }),
  };

  /**
   * @returns The delete outcome for every `ApexLog` record matched by the (optional) `--where`
   * filter.
   */
  public async run(): Promise<ApexLogsPurgeResult[]> {
    const { flags } = await this.parse(ApexLogsPurge);

    const targetOrgConnection = requireConnection(flags);
    const useBulkApi = flags['use-bulk-api'];
    const pollTimeout = flags.wait.milliseconds;

    let query = 'SELECT Id FROM ApexLog';
    if (flags.where) {
      query += ` WHERE ${flags.where}`;
    }

    this.spinner.start(messages.getMessage('info.queryingLogs'));
    const logIds = useBulkApi
      ? await queryApexLogIdsViaBulkApi(targetOrgConnection, query, pollTimeout)
      : await queryApexLogIdsViaRest(targetOrgConnection, query);
    this.spinner.stop();

    if (logIds.length === 0) {
      this.info(messages.getMessage('info.noLogsToPurge'));
      return [];
    }

    this.spinner.start(messages.getMessage('info.purgingLogs', [logIds.length]));

    const results = useBulkApi
      ? await deleteApexLogsViaBulkApi(targetOrgConnection, logIds, pollTimeout)
      : await deleteApexLogsViaCollections(targetOrgConnection, logIds, (purged, total) => {
          this.spinner.status = `${purged}/${total}`;
        });

    this.spinner.stop();

    const successCount = results.filter((result) => result.Success).length;
    const failureCount = results.length - successCount;

    if (failureCount > 0) {
      this.warn(messages.getMessage('warning.someFailed', [successCount, failureCount]));
    } else {
      this.info(messages.getMessage('info.allPurged', [successCount]));
    }

    this.table({
      data: results,
      columns: [
        { key: 'Id', name: 'ID' },
        { key: 'Success', name: 'SUCCESS' },
        { key: 'Error', name: 'ERROR' },
      ],
    });

    return results;
  }
}
