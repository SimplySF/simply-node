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
  scanLocalFieldSetInclusions,
  scanOrgFieldSetInclusions,
  validateFieldSetInclusions,
  type At4dxFieldSetInclusionValidateResult,
  type FieldSetInclusionIssue,
} from '@simplysf/simply-aep-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-aep', 'simply.aep.at4dx.field-set-inclusion.validate');

/** The table's presentational shape for one issue — `--json` keeps the full `FieldSetInclusionIssue` shape; this is display-only. */
type DisplayRow = {
  severity: string;
  rule: string;
  sobject: string;
  developerName: string;
  source: string;
  message: string;
};

function toDisplayRow(issue: FieldSetInclusionIssue): DisplayRow {
  return {
    severity: issue.severity,
    rule: issue.rule,
    sobject: issue.sobject ?? '',
    developerName: issue.developerName ?? '',
    source: issue.source,
    message: issue.message,
  };
}

const ISSUE_TABLE_COLUMNS: Array<{ key: keyof DisplayRow; name: string }> = [
  { key: 'severity', name: 'SEVERITY' },
  { key: 'rule', name: 'RULE' },
  { key: 'sobject', name: 'SOBJECT' },
  { key: 'developerName', name: 'DEVELOPER NAME' },
  { key: 'source', name: 'SOURCE' },
  { key: 'message', name: 'MESSAGE' },
];

/**
 * Validates the AT4DX Selector field set inclusions (`SelectorConfig_FieldSetInclusion__mdt`)
 * configured in a target org or local DX source — wiring problems that are invisible to
 * `field-set-inclusion list` — and fails (non-zero exit) when any of them is a real bug, for use as a
 * CI gate.
 */
export default class At4dxFieldSetInclusionValidate extends SfCommand<At4dxFieldSetInclusionValidateResult> {
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
  public async run(): Promise<At4dxFieldSetInclusionValidateResult> {
    const { flags } = await this.parse(At4dxFieldSetInclusionValidate);

    const targetOrg = flags['target-org'];
    const sourceDirs = flags['source-dir'] ?? [];

    if ((targetOrg && sourceDirs.length > 0) || (!targetOrg && sourceDirs.length === 0)) {
      throw messages.createError('error.targetOrgOrSourceDirRequired');
    }

    let source: string;
    let recordCount: number;
    let issues: FieldSetInclusionIssue[];

    if (targetOrg) {
      const connection = targetOrg.getConnection(flags['api-version']);
      source = targetOrg.getUsername() ?? 'org';

      this.spinner.start(messages.getMessage('info.queryingOrg', [source]));
      let scanResult: Awaited<ReturnType<typeof scanOrgFieldSetInclusions>>;
      try {
        scanResult = await scanOrgFieldSetInclusions(connection);
      } catch (error) {
        this.spinner.stop();
        throw messages.createError('error.orgQueryFailed', [(error as Error).message]);
      }
      this.spinner.stop();

      if (scanResult.missing) {
        throw messages.createError('error.at4dxNotDetected');
      }

      recordCount = scanResult.records.length;
      issues = validateFieldSetInclusions(scanResult.records, {
        malformed: scanResult.malformed,
        ambiguous: scanResult.ambiguous,
      });
    } else {
      source = 'local';

      this.spinner.start(messages.getMessage('info.scanningLocalSource'));
      let scanResult: ReturnType<typeof scanLocalFieldSetInclusions>;
      try {
        scanResult = scanLocalFieldSetInclusions(sourceDirs);
      } catch (error) {
        this.spinner.stop();
        throw messages.createError('error.localScanFailed', [(error as Error).message]);
      }
      this.spinner.stop();

      if (scanResult.records.length === 0 && scanResult.malformed.length === 0) {
        throw messages.createError('error.at4dxNotDetected');
      }

      recordCount = scanResult.records.length;
      issues = validateFieldSetInclusions(scanResult.records, {
        malformed: scanResult.malformed,
        ambiguous: scanResult.ambiguous,
      });
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
