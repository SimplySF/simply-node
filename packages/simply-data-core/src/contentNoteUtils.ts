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

import { mapConcurrent } from '@simplysf/simply-core';
import { Connection } from '@salesforce/core';
import { ContentNoteInput, ContentNoteResult } from './contentNoteTypes.js';

/** Matches the script this was converted from: internal share, visible to internal users only. */
const CONTENT_DOCUMENT_LINK_DEFAULTS = { ShareType: 'I', Visibility: 'InternalUsers' } as const;

/** How many notes to create concurrently when a caller doesn't specify. */
const DEFAULT_CONCURRENCY = 10;

export type UploadContentNotesOptions = {
  /** Maximum number of notes created concurrently. Defaults to 10. */
  concurrency?: number;
};

/**
 * Turn a failed create call's errors into one readable message.
 *
 * @param errors - The `SaveError`s returned by a failed `sobject().create()` call.
 * @returns The joined error messages, or a fallback if the org returned none.
 */
function formatSaveErrors(errors: ReadonlyArray<{ message: string }>): string {
  return errors.length > 0 ? errors.map((error) => error.message).join('; ') : 'The org did not report a reason.';
}

/**
 * Create one `ContentNote` and link it to `linkedEntityId` via `ContentDocumentLink`.
 *
 * `input.content` is base64-encoded here, matching what the `ContentNote.Content` field expects.
 * `input.createdDate` and `input.createdByFederationId` are only included in the create call when
 * present — `CreatedDate` must be an ISO-8601 string (not a numeric timestamp) for the org to accept
 * it, and `CreatedBy.FederationIdentifier` attribution requires "Create Audit Fields" to be enabled.
 *
 * A `ContentDocumentLink` failure after a successful `ContentNote` create still reports the created
 * `contentNoteId` in its error result (`stage: 'link'`), so the orphaned note isn't lost track of.
 *
 * @param connection - The org connection to create records on.
 * @param input - The note to create.
 * @param linkedEntityId - The Salesforce record ID to link the note to.
 * @returns The outcome — success with both created IDs, or an error identifying which stage failed.
 */
export async function createContentNote(
  connection: Connection,
  input: ContentNoteInput,
  linkedEntityId: string,
): Promise<ContentNoteResult> {
  const contentNoteFields: Record<string, unknown> = {
    Content: Buffer.from(input.content).toString('base64'),
    Title: input.title,
  };

  if (input.createdDate) {
    contentNoteFields.CreatedDate = input.createdDate;
  }

  if (input.createdByFederationId) {
    contentNoteFields.CreatedBy = { FederationIdentifier: input.createdByFederationId };
  }

  const contentNoteResult = await connection.sobject('ContentNote').create(contentNoteFields);

  if (!contentNoteResult.success) {
    return { status: 'error', input, stage: 'note', message: formatSaveErrors(contentNoteResult.errors) };
  }

  const contentDocumentLinkResult = await connection.sobject('ContentDocumentLink').create({
    ContentDocumentId: contentNoteResult.id,
    LinkedEntityId: linkedEntityId,
    ...CONTENT_DOCUMENT_LINK_DEFAULTS,
  });

  if (!contentDocumentLinkResult.success) {
    return {
      status: 'error',
      input,
      stage: 'link',
      contentNoteId: contentNoteResult.id,
      message: formatSaveErrors(contentDocumentLinkResult.errors),
    };
  }

  return {
    status: 'success',
    input,
    contentNoteId: contentNoteResult.id,
    contentDocumentLinkId: contentDocumentLinkResult.id,
  };
}

/**
 * Create a stream of `ContentNote`s, linking each one to a parent record resolved from
 * `linkedEntityIdsByExternalId`.
 *
 * `inputs` is consumed lazily and notes are created with bounded concurrency (see
 * {@link mapConcurrent} from `@simplysf/simply-core`), so a large input (e.g. rows streamed from a
 * CSV via `csv-parse`) never has to be fully buffered in memory. Results are yielded in completion
 * order, not input order — write them straight to a report as they arrive (e.g. with
 * `createCsvFileWriter`/`writeRecordsToCsvFile` from `@simplysf/simply-core`) rather than collecting
 * them into an array first.
 *
 * `linkedEntityIdsByExternalId` is a plain `Map`, built however the caller likes — a fresh query
 * (e.g. `queryRecords()` from `@simplysf/simply-core`, reduced into a `Map`) or a previously cached
 * one re-read from disk. An input whose `linkedRecordExternalId` has no entry in the map produces a
 * `stage: 'lookup'` error result without attempting any DML.
 *
 * @param connection - The org connection to create records on.
 * @param inputs - The notes to create.
 * @param linkedEntityIdsByExternalId - Maps each `linkedRecordExternalId` to the Salesforce record
 * ID it should be linked to.
 * @param options - Concurrency configuration.
 * @yields Each note's outcome, in completion order.
 */
export function uploadContentNotes(
  connection: Connection,
  inputs: AsyncIterable<ContentNoteInput> | Iterable<ContentNoteInput>,
  linkedEntityIdsByExternalId: ReadonlyMap<string, string>,
  options: UploadContentNotesOptions = {},
): AsyncGenerator<ContentNoteResult> {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  return mapConcurrent(inputs, concurrency, async (input) => {
    const linkedEntityId = linkedEntityIdsByExternalId.get(input.linkedRecordExternalId);

    if (!linkedEntityId) {
      return {
        status: 'error',
        input,
        stage: 'lookup',
        message: `No linked record found for external ID "${input.linkedRecordExternalId}".`,
      } satisfies ContentNoteResult;
    }

    return createContentNote(connection, input, linkedEntityId);
  });
}
