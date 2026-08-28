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

import fs from 'node:fs/promises';
import { Messages } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { chunkedInQuery, readPackageManifestMembers } from '@simplysf/simply-core';
import { requireConnection, targetOrgFlags } from '@simplysf/simply-plugin-kit';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-flow', 'simply.flow.delete');

/** How many `Definition.DeveloperName` values to put in each Tooling API `IN (...)` clause. */
const QUERY_CHUNK_SIZE = 200;

type FlowDefinitionRecord = { Definition: { Id: string; DeveloperName: string } };
type FlowVersionRecord = { Id: string; Definition: { DeveloperName: string } };

export type FlowDeleteFailure = {
  developerName: string;
  stage: 'deactivate' | 'delete';
  message: string;
};

export type FlowDeleteResult = {
  deactivated: string[];
  deleted: string[];
  failures: FlowDeleteFailure[];
};

const FAILURE_TABLE_COLUMNS = [
  { key: 'developerName' as const, name: 'FLOW' },
  { key: 'stage' as const, name: 'STAGE' },
  { key: 'message' as const, name: 'MESSAGE' },
];

/**
 * Deactivates and hard-deletes every version of the named Flows — the pre-step a destructive
 * metadata deploy needs, since Salesforce won't remove a Flow that still has an active version.
 */
export default class FlowDelete extends SfCommand<FlowDeleteResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    ...targetOrgFlags,
    manifest: Flags.string({ summary: messages.getMessage('flags.manifest.summary'), char: 'x' }),
    'flow-name': Flags.string({
      summary: messages.getMessage('flags.flow-name.summary'),
      char: 'n',
      multiple: true,
    }),
  };

  /** @returns Which flows were deactivated/deleted, and any per-flow failures. Sets `process.exitCode = 1` if any failure occurred. */
  public async run(): Promise<FlowDeleteResult> {
    const { flags } = await this.parse(FlowDelete);

    const hasFlowNames = Boolean(flags['flow-name']?.length);
    if ((flags.manifest && hasFlowNames) || (!flags.manifest && !hasFlowNames)) {
      throw messages.createError('error.manifestOrFlowNameRequired');
    }

    const flowNames = flags.manifest
      ? readPackageManifestMembers(await fs.readFile(flags.manifest, 'utf-8'), 'Flow')
      : (flags['flow-name'] as string[]);

    if (flowNames.length === 0) {
      this.info(messages.getMessage('info.nothingToDelete'));
      return { deactivated: [], deleted: [], failures: [] };
    }

    const connection = requireConnection(flags);
    const failures: FlowDeleteFailure[] = [];

    this.spinner.start(messages.getMessage('info.deactivating'));
    const definitionRecords = await chunkedInQuery<FlowDefinitionRecord>(
      connection,
      flowNames,
      (inClause) =>
        `SELECT Definition.Id, Definition.DeveloperName FROM Flow WHERE Definition.DeveloperName IN (${inClause})`,
      { chunkSize: QUERY_CHUNK_SIZE, tooling: true },
    );

    const distinctDefinitions = new Map<string, string>();
    for (const record of definitionRecords) {
      distinctDefinitions.set(record.Definition.Id, record.Definition.DeveloperName);
    }

    const deactivated: string[] = [];
    for (const [definitionId, developerName] of distinctDefinitions) {
      try {
        // eslint-disable-next-line no-await-in-loop -- deactivating one FlowDefinition per iteration; failures must attribute to the right flow
        const result = await connection.tooling.sobject('FlowDefinition').update({
          Id: definitionId,
          Metadata: { activeVersionNumber: 0 },
        });
        if (result.success) {
          deactivated.push(developerName);
        } else {
          failures.push({
            developerName,
            stage: 'deactivate',
            message: result.errors.map((e) => e.message).join(', '),
          });
        }
      } catch (error) {
        failures.push({ developerName, stage: 'deactivate', message: (error as Error).message });
      }
    }
    this.spinner.stop();

    this.spinner.start(messages.getMessage('info.deleting'));
    const versionRecords = await chunkedInQuery<FlowVersionRecord>(
      connection,
      flowNames,
      (inClause) => `SELECT Id, Definition.DeveloperName FROM Flow WHERE Definition.DeveloperName IN (${inClause})`,
      { chunkSize: QUERY_CHUNK_SIZE, tooling: true },
    );

    const deleted: string[] = [];
    for (const version of versionRecords) {
      const developerName = version.Definition.DeveloperName;
      try {
        // eslint-disable-next-line no-await-in-loop -- deleting one Flow version per iteration; the Tooling API has no bulk destroy for this object
        const result = await connection.tooling.sobject('Flow').destroy(version.Id);
        if (result.success) {
          deleted.push(developerName);
        } else {
          failures.push({ developerName, stage: 'delete', message: result.errors.map((e) => e.message).join(', ') });
        }
      } catch (error) {
        failures.push({ developerName, stage: 'delete', message: (error as Error).message });
      }
    }
    this.spinner.stop();

    if (failures.length > 0) {
      this.table({ data: failures, columns: FAILURE_TABLE_COLUMNS });
      process.exitCode = 1;
    }
    this.info(messages.getMessage('info.summary', [deactivated.length, deleted.length, failures.length]));

    return { deactivated, deleted, failures };
  }
}
