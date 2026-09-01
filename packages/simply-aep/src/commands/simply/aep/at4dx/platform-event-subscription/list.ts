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
import {
  scanLocalPlatformEventSubscriptions,
  scanOrgPlatformEventSubscriptions,
  type At4dxPlatformEventSubscriptionListResult,
  type RawPlatformEventSubscriptionRecord,
} from '@simplysf/simply-aep-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-aep', 'simply.aep.at4dx.platform-event-subscription.list');

/** The table's presentational shape — `--json` keeps the full `RawPlatformEventSubscriptionRecord` shape; this is display-only. */
type DisplayRow = {
  eventBus: string;
  eventCategory: string;
  developerName: string;
  consumer: string;
  matcherRule: string;
  active: string;
  source: string;
};

function toDisplayRow(record: RawPlatformEventSubscriptionRecord): DisplayRow {
  return {
    eventBus: record.eventBus,
    eventCategory: record.eventCategory ?? '(no category)',
    developerName: record.developerName,
    consumer: record.consumer,
    matcherRule: record.matcherRule,
    active: String(record.isActive),
    source: record.source,
  };
}

/**
 * Lists the AT4DX Platform Event Distributor subscriptions (`PlatformEvents_Subscription__mdt`)
 * configured in a target org or local DX source, grouped by event bus then category to match how
 * `PlatformEventDistributor` itself scopes a subscription. Unlike `binding list`, there's no
 * priority/winner concept — every active subscription for a matching event is invoked.
 */
export default class At4dxPlatformEventSubscriptionList extends SfCommand<At4dxPlatformEventSubscriptionListResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    'target-org': Flags.optionalOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 'o',
    }),
    'api-version': Flags.orgApiVersion(),
    'source-dir': Flags.directory({
      summary: messages.getMessage('flags.source-dir.summary'),
      char: 'd',
      exists: true,
      multiple: true,
    }),
  };

  /** @returns The platform event subscription records found for the requested source, grouped by event bus then category. */
  public async run(): Promise<At4dxPlatformEventSubscriptionListResult> {
    const { flags } = await this.parse(At4dxPlatformEventSubscriptionList);

    const targetOrg = flags['target-org'];
    const sourceDirs = flags['source-dir'] ?? [];

    if ((targetOrg && sourceDirs.length > 0) || (!targetOrg && sourceDirs.length === 0)) {
      throw messages.createError('error.targetOrgOrSourceDirRequired');
    }

    let source: string;
    let records: RawPlatformEventSubscriptionRecord[];

    if (targetOrg) {
      const connection = targetOrg.getConnection(flags['api-version']);
      source = targetOrg.getUsername() ?? 'org';

      this.spinner.start(messages.getMessage('info.queryingOrg', [source]));
      let scanResult: Awaited<ReturnType<typeof scanOrgPlatformEventSubscriptions>>;
      try {
        scanResult = await scanOrgPlatformEventSubscriptions(connection);
      } catch (error) {
        this.spinner.stop();
        throw messages.createError('error.orgQueryFailed', [(error as Error).message]);
      }
      this.spinner.stop();

      if (scanResult.missing) {
        throw messages.createError('error.at4dxNotDetected');
      }

      records = scanResult.records;
    } else {
      source = 'local';

      this.spinner.start(messages.getMessage('info.scanningLocalSource'));
      let scanResult: ReturnType<typeof scanLocalPlatformEventSubscriptions>;
      try {
        scanResult = scanLocalPlatformEventSubscriptions(sourceDirs);
      } catch (error) {
        this.spinner.stop();
        throw messages.createError('error.localScanFailed', [(error as Error).message]);
      }
      this.spinner.stop();

      if (scanResult.records.length === 0 && scanResult.malformed.length === 0) {
        throw messages.createError('error.at4dxNotDetected');
      }

      records = scanResult.records;
    }

    const sorted = [...records].sort(
      (a, b) =>
        a.eventBus.localeCompare(b.eventBus) ||
        (a.eventCategory ?? '').localeCompare(b.eventCategory ?? '') ||
        a.developerName.localeCompare(b.developerName),
    );

    this.table({
      data: sorted.map(toDisplayRow),
      columns: [
        { key: 'eventBus', name: 'EVENT BUS' },
        { key: 'eventCategory', name: 'CATEGORY' },
        { key: 'developerName', name: 'DEVELOPER NAME' },
        { key: 'consumer', name: 'CONSUMER' },
        { key: 'matcherRule', name: 'MATCHER RULE' },
        { key: 'active', name: 'ACTIVE' },
        { key: 'source', name: 'SOURCE' },
      ],
    });

    this.info(messages.getMessage('info.complete', [records.length, source]));

    return { source, records };
  }
}
