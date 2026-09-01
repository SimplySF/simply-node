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

import { Duration } from '@salesforce/kit';
import { Messages } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import {
  ALL_MATCHER_RULES,
  createPlatformEventSubscription,
  type At4dxPlatformEventSubscriptionCreateResult,
  type MatcherRule,
  type PlatformEventSubscriptionIssue,
} from '@simplysf/simply-aep-core';
import { toPlatformEventSubscriptionCliError } from '../../../../../common/platformEventSubscriptionWriteError.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-aep', 'simply.aep.at4dx.platform-event-subscription.create');

type IssueDisplayRow = { severity: string; rule: string; message: string };

const ISSUE_TABLE_COLUMNS: Array<{ key: keyof IssueDisplayRow; name: string }> = [
  { key: 'severity', name: 'SEVERITY' },
  { key: 'rule', name: 'RULE' },
  { key: 'message', name: 'MESSAGE' },
];

function toIssueDisplayRow(issue: PlatformEventSubscriptionIssue): IssueDisplayRow {
  return { severity: issue.severity, rule: issue.rule, message: issue.message };
}

/**
 * Creates a new AT4DX Platform Event Distributor subscription (`PlatformEvents_Subscription__mdt`) in
 * local DX source and/or a connected org, validating it against everything already scanned before
 * writing.
 */
export default class At4dxPlatformEventSubscriptionCreate extends SfCommand<At4dxPlatformEventSubscriptionCreateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    'source-dir': Flags.directory({
      summary: messages.getMessage('flags.source-dir.summary'),
      char: 'd',
    }),
    'target-org': Flags.optionalOrg({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 'o',
    }),
    'api-version': Flags.orgApiVersion(),
    wait: Flags.string({ summary: messages.getMessage('flags.wait.summary'), default: '33' }),
    'developer-name': Flags.string({
      summary: messages.getMessage('flags.developer-name.summary'),
      char: 'n',
      required: true,
    }),
    label: Flags.string({ summary: messages.getMessage('flags.label.summary') }),
    'event-bus': Flags.string({
      summary: messages.getMessage('flags.event-bus.summary'),
      required: true,
    }),
    consumer: Flags.string({
      summary: messages.getMessage('flags.consumer.summary'),
      required: true,
    }),
    'matcher-rule': Flags.custom<MatcherRule>({ options: ALL_MATCHER_RULES })({
      summary: messages.getMessage('flags.matcher-rule.summary'),
      required: true,
    }),
    'event-category': Flags.string({ summary: messages.getMessage('flags.event-category.summary') }),
    'event-name': Flags.string({ summary: messages.getMessage('flags.event-name.summary') }),
    active: Flags.boolean({
      summary: messages.getMessage('flags.active.summary'),
      allowNo: true,
      default: true,
    }),
    synchronous: Flags.boolean({
      summary: messages.getMessage('flags.synchronous.summary'),
      allowNo: true,
      default: false,
    }),
    force: Flags.boolean({ summary: messages.getMessage('flags.force.summary'), default: false }),
  };

  public async run(): Promise<At4dxPlatformEventSubscriptionCreateResult> {
    const { flags } = await this.parse(At4dxPlatformEventSubscriptionCreate);

    const sourceDir = flags['source-dir'];
    const targetOrg = flags['target-org'];
    if (!sourceDir && !targetOrg) {
      throw messages.createError('error.sourceDirOrTargetOrgRequired');
    }

    const connection = targetOrg?.getConnection(flags['api-version']);

    try {
      const result = await createPlatformEventSubscription(
        {
          developerName: flags['developer-name'],
          label: flags.label,
          eventBus: flags['event-bus'],
          consumer: flags.consumer,
          matcherRule: flags['matcher-rule'],
          eventCategory: flags['event-category'],
          event: flags['event-name'],
          isActive: flags.active,
          executeSynchronous: flags.synchronous,
          force: flags.force,
        },
        { sourceDir, connection, wait: Duration.minutes(Number(flags.wait)) },
      );

      if (result.issues.length > 0) {
        this.table({ data: result.issues.map(toIssueDisplayRow), columns: ISSUE_TABLE_COLUMNS });
      }
      this.info(messages.getMessage(result.filePath ? 'info.created' : 'info.createdInOrg', [result.developerName]));
      if (result.deploy) {
        this.info(messages.getMessage('info.deployed', [result.deploy.id]));
      }

      return result;
    } catch (error) {
      throw toPlatformEventSubscriptionCliError(error, messages, (issues) => {
        this.table({ data: issues.map(toIssueDisplayRow), columns: ISSUE_TABLE_COLUMNS });
      });
    }
  }
}
