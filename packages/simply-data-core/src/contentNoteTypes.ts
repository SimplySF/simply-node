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

/** One `ContentNote` to create and link to a parent record. */
export type ContentNoteInput = {
  /** Plain body text. Base64-encoded internally before the `ContentNote` create call. */
  content: string;
  /** The `ContentNote`'s `Title`. */
  title: string;
  /**
   * ISO-8601 `CreatedDate` to backdate the note to. Omitted from the create call entirely when not
   * given, rather than sent as something the API would reject or silently ignore.
   */
  createdDate?: string;
  /**
   * A user's `FederationIdentifier`, used to attribute the note's `CreatedBy` to them. Requires the
   * org to have "Create Audit Fields" enabled; omitted from the create call entirely when not given.
   */
  createdByFederationId?: string;
  /**
   * The external ID value identifying which record to link this note to, resolved against a
   * caller-supplied lookup map (see {@link uploadContentNotes}) rather than a Salesforce record ID
   * directly.
   */
  linkedRecordExternalId: string;
};

/** A `ContentNote` successfully created and linked. */
export type ContentNoteSuccessResult = {
  status: 'success';
  input: ContentNoteInput;
  contentNoteId: string;
  contentDocumentLinkId: string;
};

/**
 * A `ContentNote` that could not be created or linked.
 *
 * `stage` identifies what failed: `'lookup'` — `input.linkedRecordExternalId` had no match in the
 * lookup map ({@link uploadContentNotes} only; `ContentNote.create()` was never called).
 * `'note'` — the `ContentNote.create()` call itself failed. `'link'` — the `ContentNote` was created
 * (its id is in `contentNoteId`) but the following `ContentDocumentLink.create()` call failed,
 * leaving it orphaned in the org; `contentNoteId` is included so a caller can find and clean up (or
 * manually re-link) it instead of losing track of it.
 */
export type ContentNoteErrorResult = {
  status: 'error';
  input: ContentNoteInput;
  stage: 'lookup' | 'note' | 'link';
  contentNoteId?: string;
  message: string;
};

export type ContentNoteResult = ContentNoteSuccessResult | ContentNoteErrorResult;
