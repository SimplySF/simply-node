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

import fs from 'node:fs';
import path from 'node:path';
import stream, { Readable } from 'node:stream';
import { Connection, SfError } from '@salesforce/core';
import { contentVersionMultipart } from './multipart.js';
import {
  ContentVersion,
  ContentVersionDownload,
  ContentVersionCreateRequest,
  ContentVersionCreateResult,
} from './contentVersionTypes.js';

/** How much of an error response body to include in a thrown error before truncating. */
const MAX_ERROR_BODY_LENGTH = 2000;

/**
 * Turn a non-2xx response into an `SfError`.
 *
 * `fetch` — unlike the `got` client this replaced — resolves successfully for 4xx and 5xx, so every
 * call site has to check `response.ok` itself. Missing one is how an HTML error page ends up
 * written to disk with a `.pdf` extension.
 *
 * @param response - The failed response. Its body is consumed.
 * @param context - What was being attempted, used as the error message prefix.
 * @returns An `SfError` carrying the status and as much of the body as is useful.
 */
async function responseError(response: Response, context: string): Promise<SfError> {
  let body = '';
  try {
    body = (await response.text()).slice(0, MAX_ERROR_BODY_LENGTH);
  } catch {
    // A body we can't read is not worth failing differently over; the status still tells the story.
  }

  return new SfError(
    `${context} failed with HTTP ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`,
    'ContentVersionRequestError',
  );
}

/**
 * Download a `ContentVersion`'s file data to a local directory.
 *
 * @param targetOrgConnection - The org connection to download from.
 * @param contentVersionDownload - The `ContentVersion` to download; its `Id`, `Title`,
 * `ContentDocumentId`, and `FileExtension` are used to build the output file path.
 * @param downloadDirectory - The local directory to write the file into.
 * @returns The local path the file was written to.
 * @throws {SfError} If the org returns a non-2xx response, before any file is created.
 */
export async function downloadContentVersion(
  targetOrgConnection: Connection,
  contentVersionDownload: ContentVersionDownload,
  downloadDirectory: string,
): Promise<string> {
  const filePath = `${downloadDirectory}/${
    contentVersionDownload.ContentDocumentId
  }_${contentVersionDownload.Title.replaceAll(' ', '_')}.${contentVersionDownload.FileExtension}`;

  const response = await fetch(
    `${targetOrgConnection.baseUrl()}/sobjects/ContentVersion/${contentVersionDownload.Id}/VersionData`,
    {
      headers: {
        Authorization: `Bearer ${targetOrgConnection.accessToken as string}`,
      },
    },
  );

  // Checked before the write stream is opened, so a failed download leaves nothing behind.
  if (!response.ok) {
    throw await responseError(response, `Download of ContentVersion ${contentVersionDownload.Id}`);
  }

  if (!response.body) {
    throw new SfError(
      `Download of ContentVersion ${contentVersionDownload.Id} returned an empty response body.`,
      'ContentVersionRequestError',
    );
  }

  await stream.promises.pipeline(Readable.fromWeb(response.body), fs.createWriteStream(filePath));

  return filePath;
}

/**
 * Upload a local file as a new `ContentVersion`.
 *
 * @param targetOrgConnection - The org connection to upload to.
 * @param pathOnClient - The local filesystem path of the file to upload.
 * @param title - The `ContentVersion` title. Defaults to the file's basename.
 * @param firstPublishLocationId - The ID of the record/library to attach the resulting
 * `ContentDocument` to, if any.
 * @returns The created `ContentVersion`, re-queried to include `ContentDocumentId`.
 * @throws {SfError} If the org returns a non-2xx response.
 */
export async function uploadContentVersion(
  targetOrgConnection: Connection,
  pathOnClient: string,
  title?: string,
  firstPublishLocationId?: string,
): Promise<ContentVersion> {
  // Check that we have access to the file
  await fs.promises.access(pathOnClient, fs.constants.F_OK);

  const contentVersionCreateRequest: ContentVersionCreateRequest = {
    FirstPublishLocationId: firstPublishLocationId,
    PathOnClient: pathOnClient,
    Title: title ?? path.basename(pathOnClient),
  };

  const { contentType, createBody } = contentVersionMultipart({
    entity: contentVersionCreateRequest,
    filePath: pathOnClient,
    filename: path.basename(pathOnClient),
  });

  const response = await fetch(`${targetOrgConnection.baseUrl()}/sobjects/ContentVersion`, {
    method: 'POST',
    // `duplex: 'half'` is required by undici whenever the body is a stream.
    body: Readable.toWeb(createBody()) as ReadableStream<Uint8Array>,
    duplex: 'half',
    headers: {
      Authorization: `Bearer ${targetOrgConnection.accessToken as string}`,
      'Content-Type': contentType,
    },
  });

  if (!response.ok) {
    throw await responseError(response, `Upload of "${pathOnClient}"`);
  }

  const data = (await response.json()) as ContentVersionCreateResult;

  const queryResult = await targetOrgConnection.singleRecordQuery(
    `SELECT ContentDocumentId, FileExtension, Id, Title FROM ContentVersion WHERE Id='${data.id}'`,
  );

  return queryResult as ContentVersion;
}
