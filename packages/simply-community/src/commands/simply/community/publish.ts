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
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { requireConnection, targetOrgFlags } from '@simplysf/simply-plugin-kit';
import { escapeSoqlLiteral } from '@simplysf/simply-core';
import { publishCommunity } from '../../../common/publishCommunity.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-community', 'simply.community.publish');

/** The fields this needs from the `Network` record identified by `--name`. */
type NetworkRecord = { Id: string; Name: string };

export type CommunityPublishResult = {
  success: boolean;
  name: string;
  id?: string;
  url?: string;
  error?: string;
};

/** Publishes a Salesforce Community (Experience Cloud site), waiting until the publish completes. */
export default class CommunityPublish extends SfCommand<CommunityPublishResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    ...targetOrgFlags,
    name: Flags.string({ summary: messages.getMessage('flags.name.summary'), required: true }),
    wait: Flags.string({ summary: messages.getMessage('flags.wait.summary'), default: '15' }),
    'retry-attempts': Flags.integer({
      summary: messages.getMessage('flags.retry-attempts.summary'),
      default: 0,
      min: 0,
    }),
    'retry-backoff': Flags.integer({
      summary: messages.getMessage('flags.retry-backoff.summary'),
      default: 2,
      min: 1,
    }),
    'ignore-errors': Flags.boolean({
      summary: messages.getMessage('flags.ignore-errors.summary'),
      default: false,
    }),
  };

  public async run(): Promise<CommunityPublishResult> {
    const { flags } = await this.parse(CommunityPublish);
    const connection = requireConnection(flags);

    try {
      const network = await connection.singleRecordQuery<NetworkRecord>(
        `SELECT Id, Name FROM Network WHERE Name = '${escapeSoqlLiteral(flags.name)}'`,
      );

      this.spinner.start(messages.getMessage('info.publishing', [network.Name]));
      const publishResponse = await publishCommunity({
        connection,
        networkId: network.Id,
        wait: Number(flags.wait),
        retryAttempts: flags['retry-attempts'],
        retryBackoff: flags['retry-backoff'],
      });
      this.spinner.stop();

      this.info(messages.getMessage('info.published', [network.Name]));

      return { success: true, id: publishResponse.id, name: publishResponse.name, url: publishResponse.url };
    } catch (err) {
      this.spinner.stop();

      if (!flags['ignore-errors']) {
        throw err;
      }

      const error = err as Error;
      this.warn(messages.getMessage('warning.publishFailed', [flags.name, error.message]));

      return { success: false, name: flags.name, error: error.message };
    }
  }
}
