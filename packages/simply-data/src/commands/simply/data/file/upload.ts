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
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { requireConnection, targetOrgFlags } from '@simplysf/simply-plugin-kit';
import { uploadContentVersion } from '../../../../common/contentVersionUtils.js';
import { apiBudgetFlags, assertApiBudget } from '../../../../common/apiBudgetFlag.js';
import { REQUESTS_PER_UPLOAD } from '../../../../common/apiCost.js';
import { ContentVersion } from '../../../../common/contentVersionTypes.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-data', 'simply.data.file.upload');

/** Uploads a single local file to a Salesforce org as a `ContentVersion`. */
export default class DataFileUpload extends SfCommand<ContentVersion> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    ...targetOrgFlags,
    ...apiBudgetFlags,
    'file-path': Flags.directory({
      summary: messages.getMessage('flags.file-path.summary'),
      required: true,
    }),
    'first-publish-location-id': Flags.string({
      summary: messages.getMessage('flags.first-publish-location-id.summary'),
    }),
    title: Flags.string({
      summary: messages.getMessage('flags.title.summary'),
    }),
  };

  /** @returns The created `ContentVersion`. */
  public async run(): Promise<ContentVersion> {
    const { flags } = await this.parse(DataFileUpload);

    // Authorize to the target org
    const targetOrgConnection = requireConnection(flags);

    await assertApiBudget(targetOrgConnection, REQUESTS_PER_UPLOAD, flags['max-api-usage'], (message) =>
      this.warn(message),
    );

    this.spinner.start('Uploading file', '', { stdout: true });

    const contentVersion = await uploadContentVersion(
      targetOrgConnection,
      flags['file-path'],
      flags['title'],
      flags['first-publish-location-id'],
    );

    this.spinner.stop();

    return contentVersion;
  }
}
