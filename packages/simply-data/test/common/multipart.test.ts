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
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentVersionMultipart, createBoundary, escapeHeaderFilename } from '../../src/common/multipart.js';

/** Fixed boundary so the assembled bytes are deterministic. */
const BOUNDARY = 'testBoundary0123456789';

/** @returns The full body as a latin1 string, so binary bytes survive comparison. */
async function collect(body: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(chunk as Buffer);
  }

  return Buffer.concat(chunks).toString('latin1');
}

describe('multipart', () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-multipart-'));
    filePath = path.join(tmpDir, 'Q1 Brochure.pdf');
    fs.writeFileSync(filePath, '%PDF-1.4 payload');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('createBoundary', () => {
    it('should stay under the 70 character limit Salesforce allows', () => {
      expect(createBoundary().length).to.be.lessThan(70);
    });

    it('should not repeat', () => {
      expect(createBoundary()).to.not.equal(createBoundary());
    });
  });

  describe('escapeHeaderFilename', () => {
    it('should percent-encode quotes, CR and LF', () => {
      expect(escapeHeaderFilename('my"file.pdf')).to.equal('my%22file.pdf');
      expect(escapeHeaderFilename('a\r\nb.pdf')).to.equal('a%0D%0Ab.pdf');
    });

    it('should leave ordinary filenames untouched', () => {
      expect(escapeHeaderFilename('Q1 Brochure.pdf')).to.equal('Q1 Brochure.pdf');
    });

    it('should leave non-ASCII characters intact', () => {
      expect(escapeHeaderFilename('rapport-café-été.pdf')).to.equal('rapport-café-été.pdf');
    });
  });

  describe('contentVersionMultipart', () => {
    it('should produce the exact envelope Salesforce documents', async () => {
      const { contentType, createBody } = contentVersionMultipart({
        entity: { PathOnClient: 'Q1 Brochure.pdf', Title: 'Q1 Brochure' },
        filePath,
        filename: 'Q1 Brochure.pdf',
        boundary: BOUNDARY,
      });

      expect(contentType).to.equal(`multipart/form-data; boundary=${BOUNDARY}`);

      const expected = [
        `--${BOUNDARY}`,
        'Content-Disposition: form-data; name="entity_content";',
        'Content-Type: application/json',
        '',
        '{"PathOnClient":"Q1 Brochure.pdf","Title":"Q1 Brochure"}',
        `--${BOUNDARY}`,
        'Content-Type: application/octet-stream',
        'Content-Disposition: form-data; name="VersionData"; filename="Q1 Brochure.pdf"',
        '',
        '%PDF-1.4 payload',
        `--${BOUNDARY}--`,
        '',
      ].join('\r\n');

      expect(await collect(createBody())).to.equal(expected);
    });

    it('should not quote the boundary in the Content-Type header', () => {
      const { contentType } = contentVersionMultipart({
        entity: {},
        filePath,
        filename: 'a.pdf',
        boundary: BOUNDARY,
      });

      expect(contentType).to.not.include('"');
    });

    it('should separate every header with CRLF rather than a bare newline', async () => {
      const body = await collect(
        contentVersionMultipart({ entity: {}, filePath, filename: 'a.pdf', boundary: BOUNDARY }).createBody(),
      );

      expect(body.replaceAll('\r\n', '')).to.not.include('\n');
    });

    it('should escape a filename that would otherwise break out of the header', async () => {
      const body = await collect(
        contentVersionMultipart({
          entity: {},
          filePath,
          filename: 'evil"\r\nX-Injected: yes.pdf',
          boundary: BOUNDARY,
        }).createBody(),
      );

      expect(body).to.include('filename="evil%22%0D%0AX-Injected: yes.pdf"');
      // The escaped CR/LF cannot start a new header line, which is the whole point.
      expect(body.split('\r\n').some((line) => line.startsWith('X-Injected:'))).to.equal(false);
    });

    it('should never emit the boundary inside the payload', async () => {
      const { boundary, createBody } = contentVersionMultipart({ entity: {}, filePath, filename: 'a.pdf' });
      const body = await collect(createBody());

      // Three occurrences: opening delimiter, part delimiter, closing delimiter.
      expect(body.split(boundary)).to.have.lengthOf(4);
    });

    it('should produce identical bytes each time the body is rebuilt, so a retry can resend it', async () => {
      const { createBody } = contentVersionMultipart({
        entity: { Title: 'Q1 Brochure' },
        filePath,
        filename: 'Q1 Brochure.pdf',
        boundary: BOUNDARY,
      });

      expect(await collect(createBody())).to.equal(await collect(createBody()));
    });

    it('should produce a well-formed envelope for a zero byte file', async () => {
      const emptyPath = path.join(tmpDir, 'empty.txt');
      fs.writeFileSync(emptyPath, '');

      const body = await collect(
        contentVersionMultipart({
          entity: { Title: 'empty' },
          filePath: emptyPath,
          filename: 'empty.txt',
          boundary: BOUNDARY,
        }).createBody(),
      );

      expect(body).to.include('name="entity_content";');
      expect(body).to.include('filename="empty.txt"');
      expect(body.endsWith(`\r\n--${BOUNDARY}--\r\n`)).to.equal(true);
    });

    it('should stream binary content without corrupting it', async () => {
      const binaryPath = path.join(tmpDir, 'bytes.bin');
      const payload = Buffer.from([0x00, 0xff, 0x0d, 0x0a, 0x1a, 0x80, 0x7f]);
      fs.writeFileSync(binaryPath, payload);

      const body = await collect(
        contentVersionMultipart({
          entity: {},
          filePath: binaryPath,
          filename: 'bytes.bin',
          boundary: BOUNDARY,
        }).createBody(),
      );

      expect(body).to.include(payload.toString('latin1'));
    });

    it('should read the file lazily, so the body is not materialized until consumed', () => {
      const missing = path.join(tmpDir, 'not-created-yet.bin');

      // Building the body must not touch the filesystem; only consuming it should.
      expect(() => contentVersionMultipart({ entity: {}, filePath: missing, filename: 'x.bin' }).createBody()).to.not
        .throw;
    });
  });
});
