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
  updateFieldSetInclusion,
  type At4dxFieldSetInclusionUpdateResult,
  type FieldSetInclusionIssue,
} from '@simplysf/simply-aep-core';
import { toFieldSetInclusionCliError } from '../../../../../common/fieldSetInclusionWriteError.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-aep', 'simply.aep.at4dx.field-set-inclusion.update');

type IssueDisplayRow = { severity: string; rule: string; message: string };

const ISSUE_TABLE_COLUMNS: Array<{ key: keyof IssueDisplayRow; name: string }> = [
  { key: 'severity', name: 'SEVERITY' },
  { key: 'rule', name: 'RULE' },
  { key: 'message', name: 'MESSAGE' },
];

function toIssueDisplayRow(issue: FieldSetInclusionIssue): IssueDisplayRow {
  return { severity: issue.severity, rule: issue.rule, message: issue.message };
}

/**
 * Updates an existing AT4DX Selector field set inclusion (`SelectorConfig_FieldSetInclusion__mdt`) in
 * local DX source and/or a connected org — only the fields given change; everything else, including
 * which SObject reference field it uses, is preserved from the found record.
 */
export default class At4dxFieldSetInclusionUpdate extends SfCommand<At4dxFieldSetInclusionUpdateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    'source-dir': Flags.directory({
      summary: messages.getMessage('flags.source-dir.summary'),
      char: 'd',
      exists: true,
      multiple: true,
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
    sobject: Flags.string({ summary: messages.getMessage('flags.sobject.summary'), char: 's' }),
    'sobject-alternate': Flags.boolean({
      summary: messages.getMessage('flags.sobject-alternate.summary'),
      allowNo: true,
    }),
    'fieldset-name': Flags.string({
      summary: messages.getMessage('flags.fieldset-name.summary'),
      char: 'f',
    }),
    active: Flags.boolean({
      summary: messages.getMessage('flags.active.summary'),
      allowNo: true,
    }),
    force: Flags.boolean({ summary: messages.getMessage('flags.force.summary'), default: false }),
  };

  public async run(): Promise<At4dxFieldSetInclusionUpdateResult> {
    const { flags } = await this.parse(At4dxFieldSetInclusionUpdate);

    const sourceDirs = flags['source-dir'] ?? [];
    const targetOrg = flags['target-org'];
    if (sourceDirs.length === 0 && !targetOrg) {
      throw messages.createError('error.sourceDirOrTargetOrgRequired');
    }

    const connection = targetOrg?.getConnection(flags['api-version']);

    try {
      const result = await updateFieldSetInclusion(
        {
          developerName: flags['developer-name'],
          label: flags.label,
          sobject: flags.sobject,
          sobjectAlternate: flags['sobject-alternate'],
          fieldsetName: flags['fieldset-name'],
          isActive: flags.active,
          force: flags.force,
        },
        { sourceDirs, connection, wait: Duration.minutes(Number(flags.wait)) },
      );

      if (result.issues.length > 0) {
        this.table({ data: result.issues.map(toIssueDisplayRow), columns: ISSUE_TABLE_COLUMNS });
      }
      this.info(messages.getMessage(result.filePath ? 'info.updated' : 'info.updatedInOrg', [result.developerName]));
      if (result.deploy) {
        this.info(messages.getMessage('info.deployed', [result.deploy.id]));
      }

      return result;
    } catch (error) {
      throw toFieldSetInclusionCliError(error, messages, (issues) => {
        this.table({ data: issues.map(toIssueDisplayRow), columns: ISSUE_TABLE_COLUMNS });
      });
    }
  }
}
