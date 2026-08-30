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
  createBinding,
  WRITABLE_BINDING_TYPE_BY_FLAG,
  type At4dxBindingCreateResult,
  type BindingIssue,
  type WritableBindingTypeFlag,
} from '@simplysf/simply-aep-core';
import { toBindingCliError } from '../../../../../common/bindingWriteError.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-aep', 'simply.aep.at4dx.binding.create');

const WRITABLE_TYPE_OPTIONS: WritableBindingTypeFlag[] = ['service', 'selector', 'domain', 'unit-of-work'];

type IssueDisplayRow = { severity: string; rule: string; message: string };

const ISSUE_TABLE_COLUMNS: Array<{ key: keyof IssueDisplayRow; name: string }> = [
  { key: 'severity', name: 'SEVERITY' },
  { key: 'rule', name: 'RULE' },
  { key: 'message', name: 'MESSAGE' },
];

function toIssueDisplayRow(issue: BindingIssue): IssueDisplayRow {
  return { severity: issue.severity, rule: issue.rule, message: issue.message };
}

/**
 * Creates a new AT4DX Application Factory binding (Service/Selector/Domain/UnitOfWork) in local DX
 * source and/or a connected org, validating it against everything already scanned of the same type
 * before writing.
 */
export default class At4dxBindingCreate extends SfCommand<At4dxBindingCreateResult> {
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
    type: Flags.custom<WritableBindingTypeFlag>({ options: WRITABLE_TYPE_OPTIONS })({
      summary: messages.getMessage('flags.type.summary'),
      char: 't',
      required: true,
    }),
    'developer-name': Flags.string({
      summary: messages.getMessage('flags.developer-name.summary'),
      char: 'n',
      required: true,
    }),
    label: Flags.string({ summary: messages.getMessage('flags.label.summary') }),
    to: Flags.string({ summary: messages.getMessage('flags.to.summary'), char: 'c' }),
    'binding-interface': Flags.string({ summary: messages.getMessage('flags.binding-interface.summary') }),
    sobject: Flags.string({ summary: messages.getMessage('flags.sobject.summary'), char: 's' }),
    'sobject-alternate': Flags.boolean({
      summary: messages.getMessage('flags.sobject-alternate.summary'),
      allowNo: true,
    }),
    priority: Flags.string({ summary: messages.getMessage('flags.priority.summary') }),
    sequence: Flags.string({ summary: messages.getMessage('flags.sequence.summary') }),
    force: Flags.boolean({ summary: messages.getMessage('flags.force.summary'), default: false }),
  };

  public async run(): Promise<At4dxBindingCreateResult> {
    const { flags } = await this.parse(At4dxBindingCreate);

    const sourceDir = flags['source-dir'];
    const targetOrg = flags['target-org'];
    if (!sourceDir && !targetOrg) {
      throw messages.createError('error.sourceDirOrTargetOrgRequired');
    }

    let priority: number | undefined;
    if (flags.priority !== undefined) {
      priority = Number(flags.priority);
      if (Number.isNaN(priority)) {
        throw messages.createError('error.invalidPriority', [flags.priority]);
      }
    }

    let sequence: number | undefined;
    if (flags.sequence !== undefined) {
      sequence = Number(flags.sequence);
      if (Number.isNaN(sequence)) {
        throw messages.createError('error.invalidSequence', [flags.sequence]);
      }
    }

    const connection = targetOrg?.getConnection(flags['api-version']);

    try {
      const result = await createBinding(
        {
          bindingType: WRITABLE_BINDING_TYPE_BY_FLAG[flags.type],
          developerName: flags['developer-name'],
          label: flags.label,
          to: flags.to,
          bindingInterface: flags['binding-interface'],
          sobject: flags.sobject,
          sobjectAlternate: flags['sobject-alternate'],
          priority,
          sequence,
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
      throw toBindingCliError(error, messages, (issues) => {
        this.table({ data: issues.map(toIssueDisplayRow), columns: ISSUE_TABLE_COLUMNS });
      });
    }
  }
}
