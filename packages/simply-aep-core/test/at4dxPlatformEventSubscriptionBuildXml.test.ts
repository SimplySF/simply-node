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
import { buildPlatformEventSubscriptionXml } from '../src/at4dxPlatformEventSubscriptionBuildXml.js';
import type { RawPlatformEventSubscriptionRecord } from '../src/at4dxPlatformEventSubscriptionTypes.js';
import { scanLocalPlatformEventSubscriptions } from '../src/at4dxPlatformEventSubscriptionLocalScan.js';

function record(overrides: Partial<RawPlatformEventSubscriptionRecord> = {}): RawPlatformEventSubscriptionRecord {
  return {
    developerName: 'Account_Change_Subscriber',
    label: 'Account Change Subscriber',
    eventBus: 'Account_Change__e',
    consumer: 'AccountChangeConsumer',
    eventCategory: 'Finance',
    matcherRule: 'MatchEventBus',
    isActive: true,
    executeSynchronous: false,
    source: 'test',
    ...overrides,
  };
}

describe('buildPlatformEventSubscriptionXml', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simply-aep-platform-event-subscription-build-xml-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  function writeAndScan(input: RawPlatformEventSubscriptionRecord): RawPlatformEventSubscriptionRecord {
    const xml = buildPlatformEventSubscriptionXml(input, { label: input.label });
    const dir = path.join(tmpDir, input.source, 'customMetadata');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `PlatformEvents_Subscription.${input.developerName}.md-meta.xml`), xml);

    const { records } = scanLocalPlatformEventSubscriptions([tmpDir]);
    expect(records).toHaveLength(1);
    return records[0];
  }

  it('produces the exact XML shape scanLocalPlatformEventSubscriptions' + "'s fixtures expect", () => {
    const xml = buildPlatformEventSubscriptionXml(record(), { label: 'Account Change Subscriber' });

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n' +
        '  <label>Account Change Subscriber</label>\n' +
        '  <protected>false</protected>\n' +
        '  <values><field>EventBus__c</field><value xsi:type="xsd:string">Account_Change__e</value></values>\n' +
        '  <values><field>Consumer__c</field><value xsi:type="xsd:string">AccountChangeConsumer</value></values>\n' +
        '  <values><field>EventCategory__c</field><value xsi:type="xsd:string">Finance</value></values>\n' +
        '  <values><field>Event__c</field><value xsi:nil="true"/></values>\n' +
        '  <values><field>MatcherRule__c</field><value xsi:type="xsd:string">MatchEventBus</value></values>\n' +
        '  <values><field>IsActive__c</field><value xsi:type="xsd:boolean">true</value></values>\n' +
        '  <values><field>Execute_Synchronous__c</field><value xsi:type="xsd:boolean">false</value></values>\n' +
        '</CustomMetadata>\n',
    );
  });

  it('round-trips a MatchEventBus record', () => {
    const input = record();
    expect(writeAndScan(input)).toEqual({ ...input, filePath: expect.stringContaining(input.developerName) as string });
  });

  it('round-trips a record using both EventCategory__c and Event__c', () => {
    const input = record({
      developerName: 'Account_Category_And_Event',
      matcherRule: 'MatchEventBusAndCategoryAndEventName',
      eventCategory: 'Finance',
      event: 'AccountUpdated',
      executeSynchronous: true,
    });

    expect(writeAndScan(input)).toEqual({ ...input, filePath: expect.stringContaining(input.developerName) as string });
  });

  it('round-trips an inactive record', () => {
    const input = record({ developerName: 'Inactive_Subscriber', isActive: false });

    expect(writeAndScan(input)).toEqual({ ...input, filePath: expect.stringContaining(input.developerName) as string });
  });
});
