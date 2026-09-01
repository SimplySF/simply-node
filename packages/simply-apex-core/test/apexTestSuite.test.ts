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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ApexTestSuiteError,
  buildApexTestSuiteXml,
  generateApexTestSuite,
  isTestClassSource,
  scanTestClasses,
} from '../src/apexTestSuite.js';

const CLASS_META_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>60.0</apiVersion>
    <status>Active</status>
</ApexClass>
`;

describe('isTestClassSource', () => {
  it('recognizes a bare @IsTest annotation', () => {
    expect(isTestClassSource('@IsTest\nprivate class Foo {}')).toBe(true);
  });

  it('recognizes @isTest with different casing', () => {
    expect(isTestClassSource('@istest\nprivate class Foo {}')).toBe(true);
  });

  it('recognizes @IsTest with arguments', () => {
    expect(isTestClassSource('@IsTest(SeeAllData=true)\nprivate class Foo {}')).toBe(true);
  });

  it('recognizes @IsTest and a class declaration on the same line', () => {
    expect(isTestClassSource('@IsTest private class Foo {}')).toBe(true);
  });

  it('skips leading blank lines', () => {
    expect(isTestClassSource('\n\n  \n@IsTest\nprivate class Foo {}')).toBe(true);
  });

  it('skips a leading line-comment license header', () => {
    expect(isTestClassSource('// Copyright 2026\n// All rights reserved.\n@IsTest\nprivate class Foo {}')).toBe(true);
  });

  it('skips a leading multi-line block-comment license header', () => {
    expect(
      isTestClassSource('/*\n * Copyright 2026\n * All rights reserved.\n */\n@IsTest\nprivate class Foo {}'),
    ).toBe(true);
  });

  it('skips a mix of blank lines and comments before @IsTest', () => {
    expect(isTestClassSource('\n/* header */\n\n// note\n\n@IsTest\nprivate class Foo {}')).toBe(true);
  });

  it('returns false for a non-test class', () => {
    expect(isTestClassSource('public class Foo {}')).toBe(false);
  });

  it('returns false when @IsTest is not the first meaningful line', () => {
    expect(isTestClassSource("@SuppressWarnings('PMD')\n@IsTest\nprivate class Foo {}")).toBe(false);
  });

  it('returns false for an empty file', () => {
    expect(isTestClassSource('')).toBe(false);
  });

  it('returns false for a file that is only comments', () => {
    expect(isTestClassSource('// just a comment\n/* and a block */')).toBe(false);
  });
});

describe('buildApexTestSuiteXml', () => {
  it('builds a document with one testClassName per entry, sorted as given', () => {
    const xml = buildApexTestSuiteXml(['ClassA', 'ClassB']);

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<ApexTestSuite xmlns="http://soap.sforce.com/2006/04/metadata">\n' +
        '    <testClassName>ClassA</testClassName>\n' +
        '    <testClassName>ClassB</testClassName>\n' +
        '</ApexTestSuite>\n',
    );
  });

  it('builds an empty document body for no entries', () => {
    const xml = buildApexTestSuiteXml([]);
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<ApexTestSuite xmlns="http://soap.sforce.com/2006/04/metadata">\n\n</ApexTestSuite>\n',
    );
  });
});

describe('scanTestClasses / generateApexTestSuite', () => {
  let tmpDir: string;
  let classesDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-apex-test-suite-'));
    classesDir = path.join(tmpDir, 'classes');
    fs.mkdirSync(classesDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  function writeClass(name: string, body: string): void {
    fs.writeFileSync(path.join(classesDir, `${name}.cls`), body, 'utf-8');
    fs.writeFileSync(path.join(classesDir, `${name}.cls-meta.xml`), CLASS_META_XML, 'utf-8');
  }

  it('scans and returns only @IsTest classes, sorted', () => {
    writeClass('ZTest', '@IsTest\nprivate class ZTest {}');
    writeClass('ATest', '@IsTest\nprivate class ATest {}');
    writeClass('NotATest', 'public class NotATest {}');

    const testClassNames = scanTestClasses([classesDir]);

    expect(testClassNames).toEqual(['ATest', 'ZTest']);
  });

  it('recurses into nested subdirectories', () => {
    const nestedDir = path.join(classesDir, 'nested');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(nestedDir, 'NestedTest.cls'), '@IsTest\nprivate class NestedTest {}', 'utf-8');
    fs.writeFileSync(path.join(nestedDir, 'NestedTest.cls-meta.xml'), CLASS_META_XML, 'utf-8');

    const testClassNames = scanTestClasses([classesDir]);

    expect(testClassNames).toEqual(['NestedTest']);
  });

  it('combines results across multiple source directories', () => {
    const otherDir = path.join(tmpDir, 'other');
    fs.mkdirSync(otherDir, { recursive: true });
    fs.writeFileSync(path.join(otherDir, 'OtherTest.cls'), '@IsTest\nprivate class OtherTest {}', 'utf-8');
    fs.writeFileSync(path.join(otherDir, 'OtherTest.cls-meta.xml'), CLASS_META_XML, 'utf-8');
    writeClass('MainTest', '@IsTest\nprivate class MainTest {}');

    const testClassNames = scanTestClasses([classesDir, otherDir]);

    expect(testClassNames).toEqual(['MainTest', 'OtherTest']);
  });

  it('generateApexTestSuite writes the file and overwrites an existing one', async () => {
    writeClass('FirstTest', '@IsTest\nprivate class FirstTest {}');
    const outputDir = path.join(tmpDir, 'testSuites');

    const first = await generateApexTestSuite([classesDir], outputDir, 'My_Suite');
    expect(first.testClassNames).toEqual(['FirstTest']);
    expect(fs.readFileSync(first.filePath, 'utf-8')).toContain('<testClassName>FirstTest</testClassName>');

    writeClass('SecondTest', '@IsTest\nprivate class SecondTest {}');
    const second = await generateApexTestSuite([classesDir], outputDir, 'My_Suite');

    expect(second.filePath).toBe(first.filePath);
    expect(second.testClassNames).toEqual(['FirstTest', 'SecondTest']);
  });

  it('throws ApexTestSuiteError with code no-test-classes-found when nothing matches', async () => {
    writeClass('NotATest', 'public class NotATest {}');
    const outputDir = path.join(tmpDir, 'testSuites');

    await expect(generateApexTestSuite([classesDir], outputDir, 'Empty_Suite')).rejects.toMatchObject({
      code: 'no-test-classes-found',
    });
  });

  it('ApexTestSuiteError is thrown, not a generic Error, for the empty-scan case', async () => {
    const outputDir = path.join(tmpDir, 'testSuites');

    await expect(generateApexTestSuite([classesDir], outputDir, 'Empty_Suite')).rejects.toBeInstanceOf(
      ApexTestSuiteError,
    );
  });
});
