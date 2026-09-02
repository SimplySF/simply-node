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
import { Connection } from '@salesforce/core';
import sinon from 'sinon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { uploadContentVersion } from '../src/contentVersionUtils.js';
import { ContentVersionCreateRequest } from '../src/contentVersionTypes.js';

/**
 * Pull the JSON `entity_content` part back out of a captured multipart body.
 *
 * Asserting on what actually reached the wire — rather than on the object handed to the helper —
 * is the point: `PathOnClient` is only wrong once it has been serialized and sent.
 *
 * @param body - The raw multipart request body.
 * @returns The parsed entity metadata.
 */
function parseEntityPart(body: string): ContentVersionCreateRequest {
  const match = /Content-Type: application\/json\r\n\r\n(?<json>\{.*?\})\r\n--/s.exec(body);
  if (!match?.groups?.json) {
    throw new Error(`No entity_content part found in body:\n${body}`);
  }

  return JSON.parse(match.groups.json) as ContentVersionCreateRequest;
}

describe('uploadContentVersion', () => {
  const sandbox = sinon.createSandbox();
  let tmpDir: string;
  let bodies: string[];

  /** @returns The connection stub handed to `uploadContentVersion`. */
  function stubConnection(): Connection {
    return {
      baseUrl: () => 'https://example.my.salesforce.com/services/data/v62.0',
      accessToken: 'TOKEN',
      singleRecordQuery: () =>
        Promise.resolve({
          Id: '068000000000001AAA',
          ContentDocumentId: '069000000000001AAA',
          FileExtension: 'pdf',
          Title: 'Q1 Brochure',
        }),
    } as unknown as Connection;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-cvu-'));
    bodies = [];

    sandbox.stub(globalThis, 'fetch').callsFake(async (_url, init) => {
      bodies.push(await new Response(init?.body).text());

      return new Response(JSON.stringify({ id: '068000000000001AAA', success: true }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    });
  });

  afterEach(() => {
    sandbox.restore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should send only the file name as PathOnClient, not the local path it was read from', async () => {
    const nested = path.join(tmpDir, 'invoices', '2026');
    fs.mkdirSync(nested, { recursive: true });
    const filePath = path.join(nested, 'Q1 Brochure.pdf');
    fs.writeFileSync(filePath, '%PDF-1.4');

    await uploadContentVersion(stubConnection(), filePath);

    const entity = parseEntityPart(bodies[0]);
    expect(entity.PathOnClient).to.equal('Q1 Brochure.pdf');
    expect(bodies[0]).to.not.include(tmpDir);
    expect(bodies[0]).to.not.include('invoices');
  });

  it('should keep the extension, which is what Salesforce derives FileExtension from', async () => {
    const filePath = path.join(tmpDir, 'watchDoge.jpg');
    fs.writeFileSync(filePath, 'bytes');

    await uploadContentVersion(stubConnection(), filePath);

    expect(parseEntityPart(bodies[0]).PathOnClient).to.equal('watchDoge.jpg');
  });

  it('should default Title to the file name when no title is given', async () => {
    const filePath = path.join(tmpDir, 'report.csv');
    fs.writeFileSync(filePath, 'a,b');

    await uploadContentVersion(stubConnection(), filePath);

    expect(parseEntityPart(bodies[0]).Title).to.equal('report.csv');
  });

  it('should keep an explicit title', async () => {
    const filePath = path.join(tmpDir, 'report.csv');
    fs.writeFileSync(filePath, 'a,b');

    await uploadContentVersion(stubConnection(), filePath, 'Quarterly Report');

    const entity = parseEntityPart(bodies[0]);
    expect(entity.Title).to.equal('Quarterly Report');
    expect(entity.PathOnClient).to.equal('report.csv');
  });

  it('should handle a relative path without leaking its directories', async () => {
    const nested = path.join(tmpDir, 'sub');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, 'notes.txt'), 'hi');

    const cwd = process.cwd();
    try {
      process.chdir(tmpDir);
      await uploadContentVersion(stubConnection(), path.join('sub', 'notes.txt'));
    } finally {
      process.chdir(cwd);
    }

    const entity = parseEntityPart(bodies[0]);
    expect(entity.PathOnClient).to.equal('notes.txt');
    expect(bodies[0]).to.not.include('sub');
  });
});
