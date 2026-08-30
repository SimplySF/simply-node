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
  ALL_BINDING_TYPES,
  BINDING_TYPE_BY_FLAG,
  scanLocalBindings,
  scanOrgBindings,
  validateBindings,
  type At4dxBindingValidateResult,
  type BindingIssue,
  type BindingType,
  type BindingTypeFlag,
} from '@simplysf/simply-aep-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-aep', 'simply.aep.at4dx.binding.validate');

const BINDING_TYPE_FLAG_OPTIONS: BindingTypeFlag[] = ['service', 'selector', 'domain', 'unit-of-work'];

/** The table's presentational shape for one issue — `--json` keeps the full `BindingIssue` shape; this is display-only. */
type DisplayRow = {
  bindingType: BindingType;
  severity: string;
  rule: string;
  key: string;
  developerName: string;
  source: string;
  message: string;
};

function toDisplayRow(issue: BindingIssue): DisplayRow {
  return {
    bindingType: issue.bindingType,
    severity: issue.severity,
    rule: issue.rule,
    key: issue.key ?? '',
    developerName: issue.developerName ?? '',
    source: issue.source,
    message: issue.message,
  };
}

const ISSUE_TABLE_COLUMNS: Array<{ key: keyof DisplayRow; name: string }> = [
  { key: 'bindingType', name: 'TYPE' },
  { key: 'severity', name: 'SEVERITY' },
  { key: 'rule', name: 'RULE' },
  { key: 'key', name: 'KEY' },
  { key: 'developerName', name: 'DEVELOPER NAME' },
  { key: 'source', name: 'SOURCE' },
  { key: 'message', name: 'MESSAGE' },
];

/**
 * Validates the AT4DX Application Factory bindings (Service/Selector/Domain/UnitOfWork) configured in a
 * target org or local DX source — wiring problems that are invisible to `binding list` — and fails
 * (non-zero exit) when any of them is a real bug, for use as a CI gate. `UnitOfWork` bindings are
 * validated identically to Selector/Domain except for `duplicate-to` (they have no `To__c` field at
 * all) — see docs/design/0017-at4dx-binding-unit-of-work-write-support.md.
 */
export default class At4dxBindingValidate extends SfCommand<At4dxBindingValidateResult> {
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
    type: Flags.custom<BindingTypeFlag>({ options: BINDING_TYPE_FLAG_OPTIONS })({
      summary: messages.getMessage('flags.type.summary'),
      description: messages.getMessage('flags.type.description'),
      char: 't',
      multiple: true,
      delimiter: ',',
    }),
  };

  /** @returns The validation issues found for the requested source and type(s). Sets `process.exitCode = 1` when any issue is severity `error`. */
  public async run(): Promise<At4dxBindingValidateResult> {
    const { flags } = await this.parse(At4dxBindingValidate);

    const targetOrg = flags['target-org'];
    const sourceDirs = flags['source-dir'] ?? [];

    if ((targetOrg && sourceDirs.length > 0) || (!targetOrg && sourceDirs.length === 0)) {
      throw messages.createError('error.targetOrgOrSourceDirRequired');
    }

    const requestedTypes: BindingType[] = flags.type?.length
      ? [...new Set(flags.type.map((flag) => BINDING_TYPE_BY_FLAG[flag]))]
      : ALL_BINDING_TYPES;

    let source: string;
    let issues: BindingIssue[];
    let bindingCount: number;

    if (targetOrg) {
      const connection = targetOrg.getConnection(flags['api-version']);
      source = targetOrg.getUsername() ?? 'org';

      this.spinner.start(messages.getMessage('info.queryingOrg', [source]));
      let scanResult: Awaited<ReturnType<typeof scanOrgBindings>>;
      try {
        scanResult = await scanOrgBindings(connection, requestedTypes);
      } catch (error) {
        this.spinner.stop();
        throw messages.createError('error.orgQueryFailed', [(error as Error).message]);
      }
      this.spinner.stop();

      if (scanResult.missingTypes.length === requestedTypes.length) {
        throw messages.createError('error.at4dxNotDetected');
      }

      bindingCount = scanResult.records.length;
      issues = validateBindings(scanResult.records, {
        malformed: scanResult.malformed,
        ambiguous: scanResult.ambiguous,
      });
    } else {
      source = 'local';

      this.spinner.start(messages.getMessage('info.scanningLocalSource'));
      let scanResult: ReturnType<typeof scanLocalBindings>;
      try {
        scanResult = scanLocalBindings(sourceDirs, requestedTypes);
      } catch (error) {
        this.spinner.stop();
        throw messages.createError('error.localScanFailed', [(error as Error).message]);
      }
      this.spinner.stop();

      if (scanResult.records.length === 0 && scanResult.malformed.length === 0) {
        throw messages.createError('error.at4dxNotDetected');
      }

      bindingCount = scanResult.records.length;
      issues = validateBindings(scanResult.records, {
        malformed: scanResult.malformed,
        ambiguous: scanResult.ambiguous,
      });
    }

    if (issues.length > 0) {
      this.table({ data: issues.map(toDisplayRow), columns: ISSUE_TABLE_COLUMNS });
    } else {
      this.info(messages.getMessage('info.valid', [bindingCount, source]));
    }

    if (issues.some((issue) => issue.severity === 'error')) {
      process.exitCode = 1;
    }

    return { source, bindingCount, issues };
  }
}
