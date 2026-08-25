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
  resolveBindings,
  scanLocalBindings,
  scanOrgBindings,
  type At4dxBindingListResult,
  type At4dxBindingRow,
  type BindingType,
  type BindingTypeFlag,
} from '@simplysf/simply-aep-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-aep', 'simply.aep.at4dx.binding.list');

const BINDING_TYPE_FLAG_OPTIONS: BindingTypeFlag[] = ['service', 'selector', 'domain', 'unit-of-work'];

/** The table's presentational shape — `priority`/`sequence` collapse into one `order` column, and `ambiguous` folds into `effective`'s display text. The `--json` result keeps the full `At4dxBindingRow` shape; this is display-only. */
type DisplayRow = {
  bindingType: BindingType;
  key: string;
  to: string;
  order: string;
  effective: string;
  source: string;
};

function toDisplayRow(row: At4dxBindingRow): DisplayRow {
  const order = row.priority ?? row.sequence;

  return {
    bindingType: row.bindingType,
    key: row.key,
    to: row.to ?? '',
    order: order === undefined ? '' : String(order),
    effective: row.ambiguous ? 'ambiguous' : String(row.effective),
    source: row.source,
  };
}

/**
 * Lists the AT4DX Application Factory bindings (`ApplicationFactory_ServiceBinding__mdt`,
 * `ApplicationFactory_SelectorBinding__mdt`, `ApplicationFactory_DomainBinding__mdt`,
 * `ApplicationFactory_UnitOfWorkBinding__mdt`) configured in a target org or local DX source,
 * resolved down to which record wins for each binding key.
 */
export default class At4dxBindingList extends SfCommand<At4dxBindingListResult> {
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
    'effective-only': Flags.boolean({
      summary: messages.getMessage('flags.effective-only.summary'),
      default: false,
    }),
  };

  /** @returns The resolved bindings for the requested source and type(s). */
  public async run(): Promise<At4dxBindingListResult> {
    const { flags } = await this.parse(At4dxBindingList);

    const targetOrg = flags['target-org'];
    const sourceDirs = flags['source-dir'] ?? [];

    if ((targetOrg && sourceDirs.length > 0) || (!targetOrg && sourceDirs.length === 0)) {
      throw messages.createError('error.targetOrgOrSourceDirRequired');
    }

    const requestedTypes: BindingType[] = flags.type?.length
      ? [...new Set(flags.type.map((flag) => BINDING_TYPE_BY_FLAG[flag]))]
      : ALL_BINDING_TYPES;

    let source: string;
    let resolvedRows: At4dxBindingRow[];

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

      resolvedRows = resolveBindings(scanResult.records);
    } else {
      source = 'local';

      this.spinner.start(messages.getMessage('info.scanningLocalSource'));
      let records: ReturnType<typeof scanLocalBindings>;
      try {
        records = scanLocalBindings(sourceDirs, requestedTypes);
      } catch (error) {
        this.spinner.stop();
        throw messages.createError('error.localScanFailed', [(error as Error).message]);
      }
      this.spinner.stop();

      if (records.length === 0) {
        throw messages.createError('error.at4dxNotDetected');
      }

      resolvedRows = resolveBindings(records);
    }

    const bindings = flags['effective-only'] ? resolvedRows.filter((row) => row.effective) : resolvedRows;

    this.table({
      data: bindings.map(toDisplayRow),
      columns: [
        { key: 'bindingType', name: 'TYPE' },
        { key: 'key', name: 'KEY' },
        { key: 'to', name: 'TO' },
        { key: 'order', name: 'ORDER' },
        { key: 'effective', name: 'EFFECTIVE' },
        { key: 'source', name: 'SOURCE' },
      ],
    });

    this.info(messages.getMessage('info.complete', [bindings.length, source]));

    return { source, bindings };
  }
}
