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

import crypto from 'node:crypto';
import fs from 'node:fs';
import { Readable } from 'node:stream';

/**
 * Prefix for generated boundaries. Salesforce caps a boundary at 70 characters, so this plus the
 * 32 hex characters appended to it has to stay under that.
 */
const BOUNDARY_PREFIX = 'simplyBoundary';

/** CRLF, which is what RFC 2046 requires between multipart headers and parts — not a bare `\n`. */
const CRLF = '\r\n';

/**
 * Generate a multipart boundary.
 *
 * The boundary must not appear anywhere in the encoded body. Rather than scanning the file to
 * prove that, we use 128 bits of randomness, which makes an accidental collision less likely than
 * a disk error corrupting the upload anyway.
 *
 * @returns A boundary string, comfortably under the 70-character limit.
 */
export function createBoundary(): string {
  return `${BOUNDARY_PREFIX}${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Escape a filename for inclusion in a `Content-Disposition` header.
 *
 * Applies the same normalization the WHATWG `FormData` serializer does. Without it, a file named
 * `my"file.pdf` would close the quoted string early, and one containing a newline could inject a
 * header. The `form-data` package this replaced did neither.
 *
 * @param filename - The raw filename.
 * @returns The filename with `"`, CR, and LF percent-encoded.
 */
export function escapeHeaderFilename(filename: string): string {
  return filename.replaceAll('\r', '%0D').replaceAll('\n', '%0A').replaceAll('"', '%22');
}

/** A multipart request body, plus the `Content-Type` header value that describes it. */
export type ContentVersionMultipart = {
  /** The generated (or supplied) boundary. */
  boundary: string;
  /** The value for the request's `Content-Type` header, including the boundary. */
  contentType: string;
  /**
   * Build the request body.
   *
   * This is a factory rather than a stream because a stream can only be consumed once, and a
   * retried upload needs a fresh body. Each call re-opens the file.
   */
  createBody: () => Readable;
};

/**
 * Build the `multipart/form-data` body for a `ContentVersion` create request.
 *
 * The shape here matches Salesforce's documented example exactly, including the trailing semicolon
 * after `name="entity_content"` and the absence of a `filename` on that part. That absence is the
 * reason this is hand-built rather than delegated to the platform's `FormData`: a `FormData` part
 * carrying `Content-Type: application/json` is necessarily a `Blob`, and a `Blob` part always
 * serializes with a filename.
 *
 * @param options - The entity metadata, the file to attach, and an optional fixed boundary.
 * @param options.entity - Serialized as the JSON `entity_content` part.
 * @param options.filePath - Path of the file streamed as the `VersionData` part.
 * @param options.filename - Filename advertised for the `VersionData` part.
 * @param options.boundary - Boundary to use. Defaults to a random one; pass a fixed value in tests.
 * @returns The boundary, the `Content-Type` header value, and a body factory.
 */
export function contentVersionMultipart(options: {
  entity: unknown;
  filePath: string;
  filename: string;
  boundary?: string;
}): ContentVersionMultipart {
  const boundary = options.boundary ?? createBoundary();
  const entityJson = JSON.stringify(options.entity);
  const filename = escapeHeaderFilename(options.filename);

  const header = Buffer.from(
    `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="entity_content";${CRLF}` +
      `Content-Type: application/json${CRLF}${CRLF}` +
      `${entityJson}${CRLF}` +
      `--${boundary}${CRLF}` +
      `Content-Type: application/octet-stream${CRLF}` +
      `Content-Disposition: form-data; name="VersionData"; filename="${filename}"${CRLF}${CRLF}`,
    'utf8',
  );
  const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');

  const createBody = (): Readable =>
    Readable.from(
      (async function* body(): AsyncGenerator<Buffer> {
        yield header;
        yield* fs.createReadStream(options.filePath);
        yield footer;
      })(),
    );

  return {
    boundary,
    // Unquoted, matching what `form-data` and jsforce emit. RFC 2046 permits quoting, but the
    // unquoted form is the one known to work against this endpoint.
    contentType: `multipart/form-data; boundary=${boundary}`,
    createBody,
  };
}
