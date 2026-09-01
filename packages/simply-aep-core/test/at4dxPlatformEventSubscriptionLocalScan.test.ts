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
import { scanLocalPlatformEventSubscriptions } from '../src/at4dxPlatformEventSubscriptionLocalScan.js';

function writeCustomMetadata(projectDir: string, fileName: string, xml: string): void {
  const dir = path.join(projectDir, 'customMetadata');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), xml);
}

const XML_HEADER =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">';

function values(entries: Array<{ field: string; value?: string; type?: string }>): string {
  return entries
    .map(({ field, value, type }) =>
      value === undefined
        ? `  <values><field>${field}</field><value xsi:nil="true"/></values>`
        : `  <values><field>${field}</field><value xsi:type="xsd:${type ?? 'string'}">${value}</value></values>`,
    )
    .join('\n');
}

describe('scanLocalPlatformEventSubscriptions', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-platform-event-subscription-local-scan-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it('parses a full PlatformEvents_Subscription record with every field set', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'PlatformEvents_Subscription.Account_Change_Subscriber.md-meta.xml',
      `${XML_HEADER}\n  <label>Account Change Subscriber</label>\n  <protected>false</protected>\n${values([
        { field: 'EventBus__c', value: 'Account_Change__e' },
        { field: 'Consumer__c', value: 'AccountChangeConsumer' },
        { field: 'EventCategory__c', value: 'Finance' },
        { field: 'Event__c', value: 'Updated' },
        { field: 'MatcherRule__c', value: 'MatchCategoryAndEvent' },
        { field: 'IsActive__c', value: 'true', type: 'boolean' },
        { field: 'Execute_Synchronous__c', value: 'true', type: 'boolean' },
      ])}\n</CustomMetadata>\n`,
    );

    const { records } = scanLocalPlatformEventSubscriptions([tmpDir]);

    expect(records).toEqual([
      {
        developerName: 'Account_Change_Subscriber',
        label: 'Account Change Subscriber',
        eventBus: 'Account_Change__e',
        consumer: 'AccountChangeConsumer',
        eventCategory: 'Finance',
        event: 'Updated',
        matcherRule: 'MatchCategoryAndEvent',
        isActive: true,
        executeSynchronous: true,
        source: 'my-project',
        filePath: expect.stringContaining(
          'PlatformEvents_Subscription.Account_Change_Subscriber.md-meta.xml',
        ) as string,
      },
    ]);
  });

  it('defaults isActive to true and executeSynchronous to false when absent', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'PlatformEvents_Subscription.Minimal.md-meta.xml',
      `${XML_HEADER}\n  <label>Minimal</label>\n  <protected>false</protected>\n${values([
        { field: 'EventBus__c', value: 'Account_Change__e' },
        { field: 'Consumer__c', value: 'MinimalConsumer' },
        { field: 'MatcherRule__c', value: 'MatchEventBus' },
      ])}\n</CustomMetadata>\n`,
    );

    const { records } = scanLocalPlatformEventSubscriptions([tmpDir]);

    expect(records[0].isActive).toBe(true);
    expect(records[0].executeSynchronous).toBe(false);
    expect(records[0].eventCategory).toBeUndefined();
    expect(records[0].event).toBeUndefined();
  });

  it.each(['MatchEventBus', 'MatchCategory', 'MatchEvent', 'MatchCategoryAndEvent'])(
    'round-trips MatcherRule__c value %s',
    (matcherRule) => {
      const projectDir = path.join(tmpDir, 'my-project');
      writeCustomMetadata(
        projectDir,
        'PlatformEvents_Subscription.RuleTest.md-meta.xml',
        `${XML_HEADER}\n  <label>RuleTest</label>\n  <protected>false</protected>\n${values([
          { field: 'EventBus__c', value: 'Account_Change__e' },
          { field: 'Consumer__c', value: 'RuleTestConsumer' },
          { field: 'MatcherRule__c', value: matcherRule },
        ])}\n</CustomMetadata>\n`,
      );

      const { records } = scanLocalPlatformEventSubscriptions([tmpDir]);

      expect(records[0].matcherRule).toBe(matcherRule);
    },
  );

  it('ignores CustomMetadata components for other object types', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'SelectorConfig_FieldSetInclusion.Account_Contact_Fields.md-meta.xml',
      `${XML_HEADER}\n  <label>Account Contact Fields</label>\n  <protected>false</protected>\n${values([
        { field: 'BindingSObject__c', value: 'Account' },
        { field: 'FieldsetName__c', value: 'ContactRelatedFields' },
      ])}\n</CustomMetadata>\n`,
    );

    const { records } = scanLocalPlatformEventSubscriptions([tmpDir]);

    expect(records).toEqual([]);
  });

  it('reports a record with a blank EventBus__c as malformed, excluded from records', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'PlatformEvents_Subscription.NoBus.md-meta.xml',
      `${XML_HEADER}\n  <label>NoBus</label>\n  <protected>false</protected>\n${values([
        { field: 'EventBus__c' },
        { field: 'Consumer__c', value: 'SomeConsumer' },
        { field: 'MatcherRule__c', value: 'MatchEventBus' },
      ])}\n</CustomMetadata>\n`,
    );

    const { records, malformed } = scanLocalPlatformEventSubscriptions([tmpDir]);

    expect(records).toEqual([]);
    expect(malformed).toEqual([
      {
        developerName: 'NoBus',
        source: 'my-project',
        filePath: expect.stringContaining('PlatformEvents_Subscription.NoBus.md-meta.xml') as string,
      },
    ]);
  });

  it('reports a record with a blank Consumer__c as malformed', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'PlatformEvents_Subscription.NoConsumer.md-meta.xml',
      `${XML_HEADER}\n  <label>NoConsumer</label>\n  <protected>false</protected>\n${values([
        { field: 'EventBus__c', value: 'Account_Change__e' },
        { field: 'Consumer__c' },
        { field: 'MatcherRule__c', value: 'MatchEventBus' },
      ])}\n</CustomMetadata>\n`,
    );

    const { records, malformed } = scanLocalPlatformEventSubscriptions([tmpDir]);

    expect(records).toEqual([]);
    expect(malformed).toHaveLength(1);
  });

  it('reports a record with an unrecognized MatcherRule__c as malformed', () => {
    const projectDir = path.join(tmpDir, 'my-project');
    writeCustomMetadata(
      projectDir,
      'PlatformEvents_Subscription.BadRule.md-meta.xml',
      `${XML_HEADER}\n  <label>BadRule</label>\n  <protected>false</protected>\n${values([
        { field: 'EventBus__c', value: 'Account_Change__e' },
        { field: 'Consumer__c', value: 'SomeConsumer' },
        { field: 'MatcherRule__c', value: 'NotARealRule' },
      ])}\n</CustomMetadata>\n`,
    );

    const { records, malformed } = scanLocalPlatformEventSubscriptions([tmpDir]);

    expect(records).toEqual([]);
    expect(malformed).toHaveLength(1);
  });

  it('returns an empty result when no matching CustomMetadata components are found', () => {
    expect(scanLocalPlatformEventSubscriptions([tmpDir])).toEqual({ records: [], malformed: [] });
  });
});
