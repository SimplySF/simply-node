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
  type At4dxDomainProcessBindingListResult,
  type DomainProcessBindingRow,
  type RawDomainProcessBindingRecord,
} from '../../../../../common/at4dxDomainProcessBindingTypes.js';
import { scanLocalDomainProcessBindings } from '../../../../../common/at4dxDomainProcessLocalScan.js';
import { scanOrgDomainProcessBindings } from '../../../../../common/at4dxDomainProcessOrgScan.js';
import { resolveDomainProcessBindings } from '../../../../../common/at4dxDomainProcessResolve.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-aep', 'simply.aep.at4dx.domain-process-binding.list');

/** The table's presentational shape — `triggerOperation`/`domainMethodToken` collapse into one `context` column, and `orderCollision` folds into the `order` column's display text. The `--json` result keeps the full `DomainProcessBindingRow` shape; this is display-only. */
type DisplayRow = {
  sobject: string;
  context: string;
  type: string;
  order: string;
  class: string;
  active: string;
  async: string;
  source: string;
};

function toDisplayRow(row: DomainProcessBindingRow): DisplayRow {
  return {
    sobject: row.sobject,
    context: row.triggerOperation?.replace(/_/g, ' ') ?? row.domainMethodToken ?? '',
    type: row.type,
    order: row.orderCollision ? `${row.order} (collision)` : String(row.order),
    class: row.classToInject,
    active: String(row.isActive),
    async: String(row.executeAsynchronous),
    source: row.source,
  };
}

/**
 * Lists the AT4DX Trigger Action Framework bindings (`DomainProcessBinding__mdt`) configured in a
 * target org or local DX source — the criteria/action classes bound to each SObject's trigger events
 * (or domain method tokens), in execution order.
 */
export default class At4dxDomainProcessBindingList extends SfCommand<At4dxDomainProcessBindingListResult> {
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
    'active-only': Flags.boolean({
      summary: messages.getMessage('flags.active-only.summary'),
      default: false,
    }),
  };

  /** @returns The resolved Trigger Action Framework bindings for the requested source, optionally filtered to specific SObjects. */
  public async run(): Promise<At4dxDomainProcessBindingListResult> {
    const { flags } = await this.parse(At4dxDomainProcessBindingList);

    const targetOrg = flags['target-org'];
    const sourceDirs = flags['source-dir'] ?? [];

    if ((targetOrg && sourceDirs.length > 0) || (!targetOrg && sourceDirs.length === 0)) {
      throw messages.createError('error.targetOrgOrSourceDirRequired');
    }

    const sobjectFilter = flags.sobject?.length ? new Set(flags.sobject) : undefined;

    let source: string;
    let records: RawDomainProcessBindingRecord[];

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

      records = scanResult.records;
    } else {
      source = 'local';

      this.spinner.start(messages.getMessage('info.scanningLocalSource'));
      try {
        records = scanLocalDomainProcessBindings(sourceDirs);
      } catch (error) {
        this.spinner.stop();
        throw messages.createError('error.localScanFailed', [(error as Error).message]);
      }
      this.spinner.stop();

      if (records.length === 0) {
        throw messages.createError('error.at4dxNotDetected');
      }
    }

    const filteredRecords = sobjectFilter ? records.filter((record) => sobjectFilter.has(record.sobject)) : records;
    const resolvedRows = resolveDomainProcessBindings(filteredRecords);
    const bindings = flags['active-only'] ? resolvedRows.filter((row) => row.isActive) : resolvedRows;

    this.table({
      data: bindings.map(toDisplayRow),
      columns: [
        { key: 'sobject', name: 'SOBJECT' },
        { key: 'context', name: 'CONTEXT' },
        { key: 'type', name: 'TYPE' },
        { key: 'order', name: 'ORDER' },
        { key: 'class', name: 'CLASS' },
        { key: 'active', name: 'ACTIVE' },
        { key: 'async', name: 'ASYNC' },
        { key: 'source', name: 'SOURCE' },
      ],
    });

    this.info(messages.getMessage('info.complete', [bindings.length, source]));

    return { source, bindings };
  }
}
