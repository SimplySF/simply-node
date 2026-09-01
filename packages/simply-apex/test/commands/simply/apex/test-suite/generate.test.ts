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
import { SfError } from '@salesforce/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ApexTestSuiteGenerate from '../../../../../src/commands/simply/apex/test-suite/generate.js';

const CLASS_META_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>60.0</apiVersion>
    <status>Active</status>
</ApexClass>
`;

describe('simply apex test-suite generate', () => {
  let tmpDir: string;
  let classesDir: string;
  let outputDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-apex-test-suite-generate-'));
    classesDir = path.join(tmpDir, 'classes');
    outputDir = path.join(tmpDir, 'testSuites');
    fs.mkdirSync(classesDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  function writeClass(name: string, body: string): void {
    fs.writeFileSync(path.join(classesDir, `${name}.cls`), body, 'utf-8');
    fs.writeFileSync(path.join(classesDir, `${name}.cls-meta.xml`), CLASS_META_XML, 'utf-8');
  }

  it('should error without required flags', async () => {
    try {
      await ApexTestSuiteGenerate.run([]);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include('Missing required flag');
    }
  });

  it('generates a test suite from the scanned @IsTest classes', async () => {
    writeClass('MyTest', '@IsTest\nprivate class MyTest {}');
    writeClass('NotATest', 'public class NotATest {}');

    const result = await ApexTestSuiteGenerate.run([
      '--source-dir',
      classesDir,
      '--name',
      'My_Suite',
      '--output-dir',
      outputDir,
    ]);

    expect(result.testClassNames).to.deep.equal(['MyTest']);
    expect(result.filePath).to.equal(path.join(outputDir, 'My_Suite.testSuite-meta.xml'));
    expect(fs.readFileSync(result.filePath, 'utf-8')).to.include('<testClassName>MyTest</testClassName>');
  });

  it('errors when no @IsTest classes are found', async () => {
    writeClass('NotATest', 'public class NotATest {}');

    try {
      await ApexTestSuiteGenerate.run(['--source-dir', classesDir, '--name', 'Empty_Suite', '--output-dir', outputDir]);
      expect.fail('should have thrown Error');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include('No @IsTest-annotated classes were found');
    }
  });
});
