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
  validatePlatformEventSubscriptions,
  type At4dxPlatformEventSubscriptionValidateResult,
  type PlatformEventSubscriptionIssue,
} from '@simplysf/simply-aep-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-aep', 'simply.aep.at4dx.platform-event-subscription.validate');

/** The table's presentational shape for one issue — `--json` keeps the full `PlatformEventSubscriptionIssue` shape; this is display-only. */
type DisplayRow = {
  severity: string;
  rule: string;
  eventBus: string;
  developerName: string;
  source: string;
  message: string;
};

function toDisplayRow(issue: PlatformEventSubscriptionIssue): DisplayRow {
  return {
    severity: issue.severity,
    rule: issue.rule,
    eventBus: issue.eventBus ?? '',
    developerName: issue.developerName ?? '',
    source: issue.source,
    message: issue.message,
  };
}

const ISSUE_TABLE_COLUMNS: Array<{ key: keyof DisplayRow; name: string }> = [
  { key: 'severity', name: 'SEVERITY' },
  { key: 'rule', name: 'RULE' },
  { key: 'eventBus', name: 'EVENT BUS' },
  { key: 'developerName', name: 'DEVELOPER NAME' },
  { key: 'source', name: 'SOURCE' },
  { key: 'message', name: 'MESSAGE' },
];

/**
 * Validates the AT4DX Platform Event Distributor subscriptions (`PlatformEvents_Subscription__mdt`)
 * configured in a target org or local DX source — wiring problems that are invisible to
 * `platform-event-subscription list`, several of which fail silently at runtime by design (see
 * docs/design/0025's Problem section) — and fails (non-zero exit) when any of them is a real bug, for
 * use as a CI gate.
 *
 * `non-conforming-event-bus` only fires for an event bus this command can actually see the field list
 * of (a `<Bus>__e` object in the same `--source-dir` scope, for a local run) — a bus it can't see is
 * treated as "not looked at", not "broken".
 */
export default class At4dxPlatformEventSubscriptionValidate extends SfCommand<At4dxPlatformEventSubscriptionValidateResult> {
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

  /** @returns The validation issues found for the requested source. Sets `process.exitCode = 1` when any issue is severity `error`. */
  public async run(): Promise<At4dxPlatformEventSubscriptionValidateResult> {
    const { flags } = await this.parse(At4dxPlatformEventSubscriptionValidate);

    const targetOrg = flags['target-org'];
    const sourceDirs = flags['source-dir'] ?? [];

    if ((targetOrg && sourceDirs.length > 0) || (!targetOrg && sourceDirs.length === 0)) {
      throw messages.createError('error.targetOrgOrSourceDirRequired');
    }

    let source: string;
    let recordCount: number;
    let issues: PlatformEventSubscriptionIssue[];

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

      recordCount = scanResult.records.length;
      // Org-side event-bus-field discovery (describe) isn't wired up in this stage — non-conforming-event-bus
      // is silent for every bus on an org-connected run until that lands. See docs/design/0025.
      issues = validatePlatformEventSubscriptions(scanResult);
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

      recordCount = scanResult.records.length;
      // Local event-bus-field discovery (reading objects/<Bus>__e/fields/) isn't wired up in this
      // stage either — same caveat as the org path above.
      issues = validatePlatformEventSubscriptions(scanResult);
    }

    if (issues.length > 0) {
      this.table({ data: issues.map(toDisplayRow), columns: ISSUE_TABLE_COLUMNS });
    } else {
      this.info(messages.getMessage('info.valid', [recordCount, source]));
    }

    if (issues.some((issue) => issue.severity === 'error')) {
      process.exitCode = 1;
    }

    return { source, recordCount, issues };
  }
}
