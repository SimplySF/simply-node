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
import { chunk, chunkedInQuery, readPackageManifestMembers } from '@simplysf/simply-core';
import { requireConnection, targetOrgFlags } from '@simplysf/simply-plugin-kit';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-permissions', 'simply.permissions.assignment.delete');

/** How many names to put in each `IN (...)` clause, and how many Ids per DML delete chunk. */
const CHUNK_SIZE = 200;

type PermissionSetAssignmentRecord = { Id: string };

export type PermissionAssignmentDeleteFailure = { id: string; message: string };

export type PermissionAssignmentDeleteResult = {
  deleted: string[];
  failures: PermissionAssignmentDeleteFailure[];
};

const FAILURE_TABLE_COLUMNS = [
  { key: 'id' as const, name: 'ASSIGNMENT ID' },
  { key: 'message' as const, name: 'MESSAGE' },
];

/**
 * Deletes every `PermissionSetAssignment` against the named `PermissionSet`s/`PermissionSetGroup`s
 * — the pre-step a destructive metadata deploy of the permission set/group itself needs, so it
 * doesn't fail or orphan assignments.
 */
export default class PermissionsAssignmentDelete extends SfCommand<PermissionAssignmentDeleteResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    ...targetOrgFlags,
    file: Flags.string({ summary: messages.getMessage('flags.file.summary'), char: 'f' }),
    'permission-set-name': Flags.string({
      summary: messages.getMessage('flags.permission-set-name.summary'),
      multiple: true,
    }),
    'permission-set-group-name': Flags.string({
      summary: messages.getMessage('flags.permission-set-group-name.summary'),
      multiple: true,
    }),
  };

  /** @returns The deleted assignment Ids and any per-chunk failures. Sets `process.exitCode = 1` if any failure occurred. */
  public async run(): Promise<PermissionAssignmentDeleteResult> {
    const { flags } = await this.parse(PermissionsAssignmentDelete);

    const hasExplicitNames = Boolean(
      flags['permission-set-name']?.length ?? flags['permission-set-group-name']?.length,
    );
    if ((flags.file && hasExplicitNames) || (!flags.file && !hasExplicitNames)) {
      throw messages.createError('error.fileOrNameFlagsRequired');
    }

    let permissionSetNames: string[];
    let permissionSetGroupNames: string[];
    if (flags.file) {
      const xmlContent = await fs.readFile(flags.file, 'utf-8');
      permissionSetNames = readPackageManifestMembers(xmlContent, 'PermissionSet');
      permissionSetGroupNames = readPackageManifestMembers(xmlContent, 'PermissionSetGroup');
    } else {
      permissionSetNames = flags['permission-set-name'] ?? [];
      permissionSetGroupNames = flags['permission-set-group-name'] ?? [];
    }

    if (permissionSetNames.length === 0 && permissionSetGroupNames.length === 0) {
      this.info(messages.getMessage('info.nothingToDelete'));
      return { deleted: [], failures: [] };
    }

    const connection = requireConnection(flags);

    this.spinner.start(messages.getMessage('info.queryingAssignments'));
    const [byPermissionSet, byPermissionSetGroup] = await Promise.all([
      permissionSetNames.length > 0
        ? chunkedInQuery<PermissionSetAssignmentRecord>(
            connection,
            permissionSetNames,
            (inClause) => `SELECT Id FROM PermissionSetAssignment WHERE PermissionSet.Name IN (${inClause})`,
            { chunkSize: CHUNK_SIZE },
          )
        : [],
      permissionSetGroupNames.length > 0
        ? chunkedInQuery<PermissionSetAssignmentRecord>(
            connection,
            permissionSetGroupNames,
            (inClause) =>
              `SELECT Id FROM PermissionSetAssignment WHERE PermissionSetGroup.DeveloperName IN (${inClause})`,
            { chunkSize: CHUNK_SIZE },
          )
        : [],
    ]);
    this.spinner.stop();

    const assignmentIds = [...new Set([...byPermissionSet, ...byPermissionSetGroup].map((r) => r.Id))];

    if (assignmentIds.length === 0) {
      this.info(messages.getMessage('info.nothingToDelete'));
      return { deleted: [], failures: [] };
    }

    this.spinner.start(messages.getMessage('info.deleting'));
    const deleted: string[] = [];
    const failures: PermissionAssignmentDeleteFailure[] = [];

    for (const idChunk of chunk(assignmentIds, CHUNK_SIZE)) {
      // eslint-disable-next-line no-await-in-loop -- each chunk's DML delete must complete before the next chunk is sent
      const results = await connection.sobject('PermissionSetAssignment').delete(idChunk);
      // A failed SaveResult carries `id: undefined`, not the id that failed — the response array is
      // positional against the request array, so the input chunk is the only reliable source of it.
      results.forEach((result, index) => {
        const id = idChunk[index];
        if (result.success) {
          deleted.push(id);
        } else {
          failures.push({ id, message: result.errors.map((e) => e.message).join(', ') });
        }
      });
    }
    this.spinner.stop();

    if (failures.length > 0) {
      this.table({ data: failures, columns: FAILURE_TABLE_COLUMNS });
      process.exitCode = 1;
    }
    this.info(messages.getMessage('info.summary', [deleted.length, failures.length]));

    return { deleted, failures };
  }
}
