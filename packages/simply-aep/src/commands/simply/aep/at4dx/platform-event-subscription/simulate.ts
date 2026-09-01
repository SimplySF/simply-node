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
  resolvePlatformEventDistribution,
  scanLocalPlatformEventSubscriptions,
  scanOrgPlatformEventSubscriptions,
  type PlatformEventDistributionMatch,
  type PlatformEventDistributionMiss,
  type PlatformEventDistributionResult,
  type RawPlatformEventSubscriptionRecord,
} from '@simplysf/simply-aep-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-aep', 'simply.aep.at4dx.platform-event-subscription.simulate');

type MatchDisplayRow = {
  developerName: string;
  consumer: string;
  executeSynchronous: string;
  source: string;
};

function toMatchDisplayRow(match: PlatformEventDistributionMatch): MatchDisplayRow {
  return {
    developerName: match.developerName,
    consumer: match.consumer,
    executeSynchronous: String(match.executeSynchronous),
    source: match.source,
  };
}

type MissDisplayRow = {
  developerName: string;
  consumer: string;
  reason: string;
  source: string;
};

function toMissDisplayRow(miss: PlatformEventDistributionMiss): MissDisplayRow {
  return {
    developerName: miss.developerName,
    consumer: miss.consumer,
    reason: miss.reason,
    source: miss.source,
  };
}

/**
 * Simulates `PlatformEventDistributor`'s consumer resolution for a hypothetical event — a bus plus
 * optional category/event-name values — and prints the exact consumer set it would build, in order,
 * plus every subscription on that bus that would *not* receive the event and the structured reason why
 * (`inactive`, `prefiltered`, `matcher-rule-missing-field`, or `no-match`). Reimplements the
 * distributor's own decision sequence rather than asserting it, per docs/design/0025 — the same
 * evaluation code that surfaces `matcher-rule-missing-field`/`unreachable-subscription` from
 * `platform-event-subscription validate`.
 */
export default class At4dxPlatformEventSubscriptionSimulate extends SfCommand<PlatformEventDistributionResult> {
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
    'event-bus': Flags.string({
      summary: messages.getMessage('flags.event-bus.summary'),
      required: true,
    }),
    category: Flags.string({
      summary: messages.getMessage('flags.category.summary'),
    }),
    'event-name': Flags.string({
      summary: messages.getMessage('flags.event-name.summary'),
    }),
  };

  /** @returns The simulated event's matched consumer set and non-matches, for the requested source. */
  public async run(): Promise<PlatformEventDistributionResult> {
    const { flags } = await this.parse(At4dxPlatformEventSubscriptionSimulate);

    const targetOrg = flags['target-org'];
    const sourceDirs = flags['source-dir'] ?? [];

    if ((targetOrg && sourceDirs.length > 0) || (!targetOrg && sourceDirs.length === 0)) {
      throw messages.createError('error.targetOrgOrSourceDirRequired');
    }

    let records: RawPlatformEventSubscriptionRecord[];

    if (targetOrg) {
      const connection = targetOrg.getConnection(flags['api-version']);
      const source = targetOrg.getUsername() ?? 'org';

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

    const result = resolvePlatformEventDistribution(
      { eventBus: flags['event-bus'], category: flags.category, eventName: flags['event-name'] },
      records,
    );

    if (result.matches.length > 0) {
      this.styledHeader(messages.getMessage('header.matches'));
      this.table({
        data: result.matches.map(toMatchDisplayRow),
        columns: [
          { key: 'developerName', name: 'DEVELOPER NAME' },
          { key: 'consumer', name: 'CONSUMER' },
          { key: 'executeSynchronous', name: 'SYNCHRONOUS' },
          { key: 'source', name: 'SOURCE' },
        ],
      });
    } else {
      this.info(messages.getMessage('info.noMatches'));
    }

    if (result.misses.length > 0) {
      this.styledHeader(messages.getMessage('header.misses'));
      this.table({
        data: result.misses.map(toMissDisplayRow),
        columns: [
          { key: 'developerName', name: 'DEVELOPER NAME' },
          { key: 'consumer', name: 'CONSUMER' },
          { key: 'reason', name: 'REASON' },
          { key: 'source', name: 'SOURCE' },
        ],
      });
    }

    return result;
  }
}
