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
import { scanLocalApexTriggers } from '../src/at4dxApexTriggerLocalScan.js';

function writeTrigger(projectDir: string, name: string, body: string, status: 'Active' | 'Inactive' = 'Active'): void {
  const dir = path.join(projectDir, 'triggers');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.trigger`), body);
  fs.writeFileSync(
    path.join(dir, `${name}.trigger-meta.xml`),
    `<?xml version="1.0" encoding="UTF-8"?>\n<ApexTrigger xmlns="http://soap.sforce.com/2006/04/metadata">\n  <apiVersion>62.0</apiVersion>\n  <status>${status}</status>\n</ApexTrigger>\n`,
  );
}

describe('scanLocalApexTriggers', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-apex-trigger-local-scan-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('parses a trigger calling fflib_SObjectDomain.triggerHandler', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeTrigger(
      projectDir,
      'AccountTrigger',
      'trigger AccountTrigger on Account (before insert, before update) {\n' +
        '  fflib_SObjectDomain.triggerHandler(AccountsDomain.class);\n' +
        '}\n',
    );

    const records = scanLocalApexTriggers([tmpDir]);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      name: 'AccountTrigger',
      sobject: 'Account',
      triggerHandlerClasses: ['AccountsDomain'],
      active: true,
      source: 'my-project',
    });
  });

  it('finds every triggerHandler call, and tolerates a leading namespace/alias segment', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeTrigger(
      projectDir,
      'AccountTrigger',
      'trigger AccountTrigger on Account (before insert) {\n' +
        '  ns.fflib_SObjectDomain.triggerHandler(AccountsDomain.class);\n' +
        '  fflib_SObjectDomain.triggerHandler(SomeOtherClass.class);\n' +
        '}\n',
    );

    const records = scanLocalApexTriggers([tmpDir]);

    expect(records[0].triggerHandlerClasses).toEqual(['AccountsDomain', 'SomeOtherClass']);
  });

  it('records a trigger with no triggerHandler call as having an empty triggerHandlerClasses list', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeTrigger(projectDir, 'AccountTrigger', 'trigger AccountTrigger on Account (before insert) {\n}\n');

    const records = scanLocalApexTriggers([tmpDir]);

    expect(records[0].triggerHandlerClasses).toEqual([]);
  });

  it('flags Status Inactive as active: false', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeTrigger(
      projectDir,
      'AccountTrigger',
      'trigger AccountTrigger on Account (before insert) {\n  fflib_SObjectDomain.triggerHandler(AccountsDomain.class);\n}\n',
      'Inactive',
    );

    const records = scanLocalApexTriggers([tmpDir]);

    expect(records[0].active).toBe(false);
  });

  it('returns an empty array when no triggers exist', () => {
    expect(scanLocalApexTriggers([tmpDir])).toEqual([]);
  });
});
