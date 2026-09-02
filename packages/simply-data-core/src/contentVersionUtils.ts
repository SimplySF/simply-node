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

/** Matches the `api-usage=used/limit` portion of a `Sforce-Limit-Info` response header. */
const API_USAGE_PATTERN = /api-usage=(?<used>\d+)\/(?<limit>\d+)/;

/**
 * Feed a raw `fetch` response's `Sforce-Limit-Info` header back into the connection.
 *
 * Salesforce reports API consumption on every REST response, and jsforce normally parses it into
 * `connection.limitInfo`. These two functions call `fetch` directly, so jsforce never sees their
 * responses and the readings would otherwise be lost — leaving `limitInfo` stale at whatever the
 * last jsforce-issued request reported, which for an upload run is "nothing at all".
 *
 * Keeping it current costs one header parse and makes the reading available to the API budget
 * check and to any later running check.
 *
 * @param connection - The connection whose `limitInfo` should be updated.
 * @param response - The response to read the header from.
 */
function recordApiUsage(connection: Connection, response: Response): void {
  const match = API_USAGE_PATTERN.exec(response.headers.get('sforce-limit-info') ?? '');

  if (match?.groups) {
    connection.limitInfo = {
      apiUsage: {
        used: Number.parseInt(match.groups.used, 10),
        limit: Number.parseInt(match.groups.limit, 10),
      },
    };
  }
}

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

  recordApiUsage(targetOrgConnection, response);

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
 * Only the file's name is sent to the org as `PathOnClient`, not the local path it was read from.
 * Salesforce derives `FileExtension` and `FileType` from that value, so the name is all it needs —
 * and sending the rest would publish the uploader's local directory layout into the org, where it
 * is visible to anyone who can query `ContentVersion`.
 *
 * @param targetOrgConnection - The org connection to upload to.
 * @param filePath - The local filesystem path of the file to upload. Stays local.
 * @param title - The `ContentVersion` title. Defaults to the file's name.
 * @param firstPublishLocationId - The ID of the record/library to attach the resulting
 * `ContentDocument` to, if any.
 * @returns The created `ContentVersion`, re-queried to include `ContentDocumentId`.
 * @throws {SfError} If the org returns a non-2xx response.
 */
export async function uploadContentVersion(
  targetOrgConnection: Connection,
  filePath: string,
  title?: string,
  firstPublishLocationId?: string,
): Promise<ContentVersion> {
  // Check that we have access to the file
  await fs.promises.access(filePath, fs.constants.F_OK);

  const fileName = path.basename(filePath);

  const contentVersionCreateRequest: ContentVersionCreateRequest = {
    FirstPublishLocationId: firstPublishLocationId,
    PathOnClient: fileName,
    Title: title ?? fileName,
  };

  const { contentType, createBody } = contentVersionMultipart({
    entity: contentVersionCreateRequest,
    filePath,
    filename: fileName,
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

  recordApiUsage(targetOrgConnection, response);

  if (!response.ok) {
    throw await responseError(response, `Upload of "${filePath}"`);
  }

  const data = (await response.json()) as ContentVersionCreateResult;

  const queryResult = await targetOrgConnection.singleRecordQuery(
    `SELECT ContentDocumentId, FileExtension, Id, Title FROM ContentVersion WHERE Id='${data.id}'`,
  );

  return queryResult as ContentVersion;
}
