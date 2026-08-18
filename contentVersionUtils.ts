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
import stream from 'node:stream';
import FormData from 'form-data';
import got from 'got';
import { Connection } from '@salesforce/core';
import {
  ContentVersion,
  ContentVersionDownload,
  ContentVersionCreateRequest,
  ContentVersionCreateResult,
} from './contentVersionTypes.js';

/**
 * Download a `ContentVersion`'s file data to a local directory.
 *
 * @param targetOrgConnection - The org connection to download from.
 * @param contentVersionDownload - The `ContentVersion` to download; its `Id`, `Title`,
 * `ContentDocumentId`, and `FileExtension` are used to build the output file path.
 * @param downloadDirectory - The local directory to write the file into.
 * @returns The local path the file was written to.
 */
export async function downloadContentVersion(
  targetOrgConnection: Connection,
  contentVersionDownload: ContentVersionDownload,
  downloadDirectory: string,
): Promise<string> {
  const filePath = `${downloadDirectory}/${
    contentVersionDownload.ContentDocumentId
  }_${contentVersionDownload.Title.replaceAll(' ', '_')}.${contentVersionDownload.FileExtension}`;

  await stream.promises.pipeline(
    got.stream(`${targetOrgConnection.baseUrl()}/sobjects/ContentVersion/${contentVersionDownload.Id}/VersionData`, {
      headers: {
        Authorization: `Bearer ${targetOrgConnection.accessToken as string}`,
      },
    }),
    fs.createWriteStream(filePath),
  );

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

  const form = new FormData();
  form.append('entity_content', JSON.stringify(contentVersionCreateRequest), { contentType: 'application/json' });
  form.append('VersionData', fs.createReadStream(pathOnClient), { filename: path.basename(pathOnClient) });

  const data: ContentVersionCreateResult = await got.post(`${targetOrgConnection.baseUrl()}/sobjects/ContentVersion`, {
    body: form,
    headers: {
      Authorization: `Bearer ${targetOrgConnection.accessToken as string}`,
      'Content-Type': `multipart/form-data; boundary="${form.getBoundary()}"`,
    },
    resolveBodyOnly: true,
    responseType: 'json',
  });

  const queryResult = await targetOrgConnection.singleRecordQuery(
    `SELECT ContentDocumentId, FileExtension, Id, Title FROM ContentVersion WHERE Id='${data.id}'`,
  );

  return queryResult as ContentVersion;
}
