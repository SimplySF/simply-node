/*
 * Copyright (c) 2026, SimplySF.
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
import { afterEach, describe, expect, it } from 'vitest';
import { ensureDirectory, timestampForFileName } from '../../src/fs/paths.js';

describe('ensureDirectory', () => {
  let createdRoot: string | undefined;

  afterEach(() => {
    if (createdRoot && fs.existsSync(createdRoot)) {
      fs.rmSync(createdRoot, { recursive: true, force: true });
    }
    createdRoot = undefined;
  });

  it('creates the directory when it does not exist', () => {
    createdRoot = path.join(os.tmpdir(), `simply-core-ensure-dir-${process.pid}-${Date.now()}`);

    expect(fs.existsSync(createdRoot)).to.equal(false);
    ensureDirectory(createdRoot);
    expect(fs.statSync(createdRoot).isDirectory()).to.equal(true);
  });

  it('creates missing parent directories', () => {
    createdRoot = path.join(os.tmpdir(), `simply-core-ensure-dir-${process.pid}-${Date.now()}`);
    const nested = path.join(createdRoot, 'a', 'b', 'c');

    ensureDirectory(nested);

    expect(fs.statSync(nested).isDirectory()).to.equal(true);
  });

  it('leaves an existing directory and its contents alone', () => {
    createdRoot = path.join(os.tmpdir(), `simply-core-ensure-dir-${process.pid}-${Date.now()}`);
    fs.mkdirSync(createdRoot, { recursive: true });
    const existingFile = path.join(createdRoot, 'keep.txt');
    fs.writeFileSync(existingFile, 'keep me');

    ensureDirectory(createdRoot);

    expect(fs.readFileSync(existingFile, 'utf-8')).to.equal('keep me');
  });

  it('returns the path it was given, so it can wrap a flag default inline', () => {
    createdRoot = path.join(os.tmpdir(), `simply-core-ensure-dir-${process.pid}-${Date.now()}`);

    expect(ensureDirectory(createdRoot)).to.equal(createdRoot);
  });
});

describe('timestampForFileName', () => {
  it('formats a date as YYYYMMDD_HHMMSS in local time', () => {
    expect(timestampForFileName(new Date(2026, 7, 17, 14, 25, 30))).to.equal('20260817_142530');
  });

  it('zero-pads every single-digit component', () => {
    expect(timestampForFileName(new Date(2026, 0, 2, 3, 4, 5))).to.equal('20260102_030405');
  });

  it('produces a filename-safe string with no separators beyond the underscore', () => {
    expect(timestampForFileName(new Date(2026, 11, 31, 23, 59, 59))).to.match(/^\d{8}_\d{6}$/);
  });

  it('defaults to the current time', () => {
    const before = timestampForFileName(new Date());
    const generated = timestampForFileName();
    const after = timestampForFileName(new Date());

    expect(generated >= before && generated <= after).to.equal(true);
  });
});
