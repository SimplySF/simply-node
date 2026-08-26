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
  validateDomainProcessBindings,
  scanLocalDomainProcessBindings,
  scanOrgDomainProcessBindings,
  type AmbiguousDomainProcessBindingRecord,
  type At4dxDomainProcessBindingValidateResult,
  type DomainProcessBindingIssue,
  type MalformedDomainProcessBindingRecord,
  type RawDomainProcessBindingRecord,
} from '@simplysf/simply-aep-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-aep', 'simply.aep.at4dx.domain-process-binding.validate');

/** The table's presentational shape for one issue — `--json` keeps the full `DomainProcessBindingIssue` shape; this is display-only. */
type DisplayRow = {
  severity: string;
  rule: string;
  sobject: string;
  developerName: string;
  source: string;
  message: string;
};

function toDisplayRow(issue: DomainProcessBindingIssue): DisplayRow {
  return {
    severity: issue.severity,
    rule: issue.rule,
    sobject: issue.sobject ?? '',
    developerName: issue.developerName ?? '',
    source: issue.source,
    message: issue.message,
  };
}

/**
 * Validates the AT4DX Trigger Action Framework bindings (`DomainProcessBinding__mdt`) configured in a
 * target org or local DX source — order collisions, dead bindings, and other wiring problems that are
 * invisible to `domain-process-binding list` — and fails (non-zero exit) when any of them is a real
 * bug, for use as a CI gate.
 */
export default class At4dxDomainProcessBindingValidate extends SfCommand<At4dxDomainProcessBindingValidateResult> {
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
    sobject: Flags.string({
      summary: messages.getMessage('flags.sobject.summary'),
      char: 's',
      multiple: true,
    }),
  };

  /** @returns The validation issues found for the requested source, optionally filtered to specific SObjects. Sets `process.exitCode = 1` when any issue is severity `error`. */
  public async run(): Promise<At4dxDomainProcessBindingValidateResult> {
    const { flags } = await this.parse(At4dxDomainProcessBindingValidate);

    const targetOrg = flags['target-org'];
    const sourceDirs = flags['source-dir'] ?? [];

    if ((targetOrg && sourceDirs.length > 0) || (!targetOrg && sourceDirs.length === 0)) {
      throw messages.createError('error.targetOrgOrSourceDirRequired');
    }

    const sobjectFilter = flags.sobject?.length ? new Set(flags.sobject) : undefined;

    let source: string;
    let records: RawDomainProcessBindingRecord[];
    let malformed: MalformedDomainProcessBindingRecord[];
    let ambiguous: AmbiguousDomainProcessBindingRecord[];

    if (targetOrg) {
      const connection = targetOrg.getConnection(flags['api-version']);
      source = targetOrg.getUsername() ?? 'org';

      this.spinner.start(messages.getMessage('info.queryingOrg', [source]));
      let scanResult: Awaited<ReturnType<typeof scanOrgDomainProcessBindings>>;
      try {
        scanResult = await scanOrgDomainProcessBindings(connection);
      } catch (error) {
        this.spinner.stop();
        throw messages.createError('error.orgQueryFailed', [(error as Error).message]);
      }
      this.spinner.stop();

      if (scanResult.missing) {
        throw messages.createError('error.at4dxNotDetected');
      }

      ({ records, malformed, ambiguous } = scanResult);
    } else {
      source = 'local';

      this.spinner.start(messages.getMessage('info.scanningLocalSource'));
      try {
        ({ records, malformed, ambiguous } = scanLocalDomainProcessBindings(sourceDirs));
      } catch (error) {
        this.spinner.stop();
        throw messages.createError('error.localScanFailed', [(error as Error).message]);
      }
      this.spinner.stop();

      if (records.length === 0 && malformed.length === 0) {
        throw messages.createError('error.at4dxNotDetected');
      }
    }

    const filteredRecords = sobjectFilter ? records.filter((record) => sobjectFilter.has(record.sobject)) : records;
    const filteredAmbiguous = sobjectFilter
      ? ambiguous.filter((record) => sobjectFilter.has(record.sobject))
      : ambiguous;

    const issues = validateDomainProcessBindings(filteredRecords, { malformed, ambiguous: filteredAmbiguous });

    if (issues.length > 0) {
      this.table({
        data: issues.map(toDisplayRow),
        columns: [
          { key: 'severity', name: 'SEVERITY' },
          { key: 'rule', name: 'RULE' },
          { key: 'sobject', name: 'SOBJECT' },
          { key: 'developerName', name: 'DEVELOPER NAME' },
          { key: 'source', name: 'SOURCE' },
          { key: 'message', name: 'MESSAGE' },
        ],
      });
    } else {
      this.info(messages.getMessage('info.valid', [filteredRecords.length, source]));
    }

    if (issues.some((issue) => issue.severity === 'error')) {
      process.exitCode = 1;
    }

    return { source, bindingCount: filteredRecords.length, issues };
  }
}
