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

import path from 'node:path';
import { Messages } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { chunkedInQuery } from '@simplysf/simply-core';
import { requireConnection, targetOrgFlags } from '@simplysf/simply-plugin-kit';
import { glob } from 'glob';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-flow', 'simply.flow.version.prune');

/** How many `Definition.DeveloperName` values to put in each Tooling API `IN (...)` clause. */
const QUERY_CHUNK_SIZE = 200;

type ObsoleteFlowVersionRecord = { Id: string; Definition: { DeveloperName: string } };

export type FlowVersionPruneCandidate = { id: string; developerName: string };
export type FlowVersionPruneFailure = { developerName: string; message: string };

export type FlowVersionPruneResult = {
  dryRun: boolean;
  candidates: FlowVersionPruneCandidate[];
  deleted: string[];
  failures: FlowVersionPruneFailure[];
};

const CANDIDATE_TABLE_COLUMNS = [
  { key: 'developerName' as const, name: 'FLOW' },
  { key: 'id' as const, name: 'VERSION ID' },
];

const FAILURE_TABLE_COLUMNS = [
  { key: 'developerName' as const, name: 'FLOW' },
  { key: 'message' as const, name: 'MESSAGE' },
];

/** @returns The Flow DeveloperName encoded in a `<DeveloperName>.flow-meta.xml` file's basename. */
function developerNameFromFlowFile(flowFile: string): string {
  return path.parse(flowFile).name.replace('.flow-meta', '');
}

/**
 * Deletes obsolete Flow versions (`Status = 'Obsolete'`) for the Flows found under `--source-dir`,
 * or for explicitly named Flows via `--flow-name`. Unlike `flow delete`, this never removes an
 * active Flow — only versions the org itself already marked obsolete.
 */
export default class FlowVersionPrune extends SfCommand<FlowVersionPruneResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    ...targetOrgFlags,
    'source-dir': Flags.directory({
      summary: messages.getMessage('flags.source-dir.summary'),
      char: 'd',
      exists: true,
      multiple: true,
    }),
    'flow-name': Flags.string({
      summary: messages.getMessage('flags.flow-name.summary'),
      char: 'n',
      multiple: true,
    }),
    'dry-run': Flags.boolean({ summary: messages.getMessage('flags.dry-run.summary'), default: false }),
  };

  /** @returns The obsolete versions found (and deleted, unless `--dry-run`), plus any per-version failures. Sets `process.exitCode = 1` if any failure occurred. */
  public async run(): Promise<FlowVersionPruneResult> {
    const { flags } = await this.parse(FlowVersionPrune);

    const hasSourceDir = Boolean(flags['source-dir']?.length);
    const hasFlowNames = Boolean(flags['flow-name']?.length);
    if ((hasSourceDir && hasFlowNames) || (!hasSourceDir && !hasFlowNames)) {
      throw messages.createError('error.sourceDirOrFlowNameRequired');
    }

    let flowNames: string[];
    if (hasSourceDir) {
      this.spinner.start(messages.getMessage('info.scanningLocalSource'));
      const sourceDirs = flags['source-dir'] as string[];
      const flowFiles = (
        await Promise.all(sourceDirs.map((sourceDir) => glob(`${sourceDir.replaceAll('\\', '/')}/**/*.flow-meta.xml`)))
      ).flat();
      flowNames = [...new Set(flowFiles.map(developerNameFromFlowFile))];
      this.spinner.stop();
    } else {
      flowNames = flags['flow-name'] as string[];
    }

    const connection = requireConnection(flags);

    this.spinner.start(messages.getMessage('info.queryingObsoleteVersions'));
    const obsoleteRecords = await chunkedInQuery<ObsoleteFlowVersionRecord>(
      connection,
      flowNames,
      (inClause) =>
        `SELECT Id, Definition.DeveloperName FROM Flow WHERE Status = 'Obsolete' AND Definition.DeveloperName IN (${inClause})`,
      { chunkSize: QUERY_CHUNK_SIZE, tooling: true },
    );
    this.spinner.stop();

    const candidates: FlowVersionPruneCandidate[] = obsoleteRecords.map((record) => ({
      id: record.Id,
      developerName: record.Definition.DeveloperName,
    }));

    if (flags['dry-run']) {
      if (candidates.length > 0) {
        this.table({ data: candidates, columns: CANDIDATE_TABLE_COLUMNS });
      }
      this.info(messages.getMessage('info.dryRunSummary', [candidates.length]));
      return { dryRun: true, candidates, deleted: [], failures: [] };
    }

    const failures: FlowVersionPruneFailure[] = [];
    const deleted: string[] = [];

    this.spinner.start(messages.getMessage('info.deleting'));
    for (const candidate of candidates) {
      try {
        // eslint-disable-next-line no-await-in-loop -- deleting one Flow version per iteration; the Tooling API has no bulk destroy for this object
        const result = await connection.tooling.sobject('Flow').destroy(candidate.id);
        if (result.success) {
          deleted.push(candidate.developerName);
        } else {
          failures.push({
            developerName: candidate.developerName,
            message: result.errors.map((e) => e.message).join(', '),
          });
        }
      } catch (error) {
        failures.push({ developerName: candidate.developerName, message: (error as Error).message });
      }
    }
    this.spinner.stop();

    if (failures.length > 0) {
      this.table({ data: failures, columns: FAILURE_TABLE_COLUMNS });
      process.exitCode = 1;
    }
    this.info(messages.getMessage('info.summary', [deleted.length, failures.length]));

    return { dryRun: false, candidates, deleted, failures };
  }
}
