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

import fs from 'node:fs';
import PQueue from 'p-queue';
import { Messages } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { requireConnection, targetOrgFlags } from '@simplysf/simply-plugin-kit';
import { createCsvFileWriter } from '@simplysf/simply-core';
import { downloadContentVersion } from '../../../../common/contentVersionUtils.js';
import { apiBudgetFlags, assertApiBudget } from '../../../../common/apiBudgetFlag.js';
import { REQUESTS_PER_DOWNLOAD, requestsForQuery } from '../../../../common/apiCost.js';
import { ContentVersionDownload } from '../../../../common/contentVersionTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-data', 'simply.data.files.download');

/**
 * Downloads files specified by a where clause for a `ContentVersion` query from a Salesforce
 * org. By default, the plugin uses the REST API for the download to allow for the streaming of
 * large files without issue. This means that each file uses one REST API request.
 *
 * Successes and failures are written to `download/success.csv` and `download/error.csv`
 * respectively as downloads complete, rather than accumulated in memory.
 */
export default class DataFilesDownload extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    ...targetOrgFlags,
    ...apiBudgetFlags,
    'max-parallel-jobs': Flags.integer({
      summary: messages.getMessage('flags.max-parallel-jobs.summary'),
      description: messages.getMessage('flags.max-parallel-jobs.description'),
      default: 1,
    }),
    'where-content-version': Flags.string({
      summary: messages.getMessage('flags.where-content-version.summary'),
      description: messages.getMessage('flags.where-content-version.description'),
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(DataFilesDownload);

    // Authorize to the target org
    const targetOrgConnection = requireConnection(flags);

    this.spinner.start('Querying for files', '\n', { stdout: true });

    const result = await targetOrgConnection.query<ContentVersionDownload>(
      `SELECT ContentDocumentId, ContentSize, Description, FileExtension, FileType, FirstPublishLocationId, Id, IsLatest, PathOnClient, Title FROM ContentVersion WHERE ${flags['where-content-version']}`,
      {
        autoFetch: true,
        maxFetch: (this.configAggregator.getInfo('org-max-query-limit').value as number) ?? 50_000,
        scanAll: false,
      },
    );

    const contentVersionDownloads = result.records;

    // The query above already ran through jsforce, so `connection.limitInfo` is populated and the
    // budget check gets the free header path rather than spending a request on the limits API.
    await assertApiBudget(
      targetOrgConnection,
      contentVersionDownloads.length * REQUESTS_PER_DOWNLOAD + requestsForQuery(contentVersionDownloads.length),
      flags['max-api-usage'],
      (message) => this.warn(message),
    );

    this.spinner.start('Initializing file download', '\n', { stdout: true });

    if (!fs.existsSync('download')) {
      fs.mkdirSync('download');
    }

    const successWriter = createCsvFileWriter('download/success.csv', [
      'Id',
      'ContentDocumentId',
      'ContentSize',
      'Description',
      'FileExtension',
      'FileType',
      'FirstPublishLocationId',
      'IsLatest',
      'PathOnClient',
      'Title',
      'FilePath',
    ]);

    const errorWriter = createCsvFileWriter('download/error.csv', [
      'Id',
      'ContentDocumentId',
      'ContentSize',
      'Description',
      'FileExtension',
      'FileType',
      'FirstPublishLocationId',
      'IsLatest',
      'PathOnClient',
      'Title',
      'Error',
    ]);

    this.spinner.start('Downloading files', '\n', { stdout: true });

    const downloadQueue = new PQueue({ concurrency: flags['max-parallel-jobs'] });

    let count = 0;
    downloadQueue.on('add', () => {
      this.spinner.status = `Completed: ${count}. Size: ${downloadQueue.size}  Pending: ${downloadQueue.pending}\n`;
    });

    downloadQueue.on('completed', () => {
      count++;
      this.spinner.status = `Completed: ${count}. Size: ${downloadQueue.size}  Pending: ${downloadQueue.pending}\n`;
    });

    for (const contentVersionDownload of contentVersionDownloads) {
      void downloadQueue.add(async () => {
        try {
          contentVersionDownload.FilePath = await downloadContentVersion(
            targetOrgConnection,
            contentVersionDownload,
            'download',
          );
          await successWriter.write(contentVersionDownload);
        } catch (error) {
          contentVersionDownload.Error = String(error);
          await errorWriter.write(contentVersionDownload);
        }
      });
    }

    await downloadQueue.onIdle();
    await Promise.all([successWriter.end(), errorWriter.end()]);

    this.spinner.stop();
  }
}
