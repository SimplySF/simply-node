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

import { describe, expect, it } from 'vitest';
import {
  resolvePlatformEventDistribution,
  validatePlatformEventSubscriptions,
  type EventBusFields,
} from '../src/at4dxPlatformEventSubscriptionResolve.js';
import {
  PLATFORM_EVENT_SUBSCRIPTION_RULES,
  type MalformedPlatformEventSubscriptionRecord,
  type PlatformEventSubscriptionIssueRule,
  type RawPlatformEventSubscriptionRecord,
} from '../src/at4dxPlatformEventSubscriptionTypes.js';

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

const noMalformed: MalformedPlatformEventSubscriptionRecord[] = [];

describe('PLATFORM_EVENT_SUBSCRIPTION_RULES', () => {
  it('has a table entry, keyed to itself, for every PlatformEventSubscriptionIssueRule', () => {
    const rules: PlatformEventSubscriptionIssueRule[] = [
      'missing-event-bus-or-consumer',
      'matcher-rule-missing-field',
      'unreachable-subscription',
      'non-conforming-event-bus',
      'duplicate-consumer',
      'duplicate-developer-name',
    ];

    for (const rule of rules) {
      expect(PLATFORM_EVENT_SUBSCRIPTION_RULES[rule].rule).toBe(rule);
    }
    expect(Object.keys(PLATFORM_EVENT_SUBSCRIPTION_RULES).sort()).toEqual([...rules].sort());
  });
});

describe('validatePlatformEventSubscriptions', () => {
  it('returns an empty array for a well-formed MatchEventBus record', () => {
    expect(validatePlatformEventSubscriptions({ records: [record()], malformed: noMalformed })).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(validatePlatformEventSubscriptions({ records: [], malformed: noMalformed })).toEqual([]);
  });

  describe('missing-event-bus-or-consumer', () => {
    it('flags one issue per malformed record', () => {
      const malformed: MalformedPlatformEventSubscriptionRecord[] = [{ developerName: 'Broken', source: 'core' }];

      const issues = validatePlatformEventSubscriptions({ records: [], malformed });

      expect(issues).toEqual([
        expect.objectContaining({
          severity: 'error',
          rule: 'missing-event-bus-or-consumer',
          scope: 'record',
          developerName: 'Broken',
        }),
      ]);
    });
  });

  describe('matcher-rule-missing-field', () => {
    it('does not flag MatchEventBus regardless of category/event', () => {
      const issues = validatePlatformEventSubscriptions({
        records: [record({ matcherRule: 'MatchEventBus', eventCategory: undefined, event: undefined })],
        malformed: noMalformed,
      });
      expect(issues.filter((i) => i.rule === 'matcher-rule-missing-field')).toEqual([]);
    });

    it('flags MatchEventBusAndCategory when eventCategory is blank', () => {
      const issues = validatePlatformEventSubscriptions({
        records: [record({ matcherRule: 'MatchEventBusAndCategory', eventCategory: undefined })],
        malformed: noMalformed,
      });
      expect(issues).toEqual([expect.objectContaining({ rule: 'matcher-rule-missing-field', severity: 'error' })]);
    });

    it('does not flag MatchEventBusAndCategory when eventCategory is set', () => {
      const issues = validatePlatformEventSubscriptions({
        records: [record({ matcherRule: 'MatchEventBusAndCategory', eventCategory: 'Finance' })],
        malformed: noMalformed,
      });
      expect(issues.filter((i) => i.rule === 'matcher-rule-missing-field')).toEqual([]);
    });

    it('flags MatchEventBusAndEventName when event is blank', () => {
      const issues = validatePlatformEventSubscriptions({
        records: [record({ matcherRule: 'MatchEventBusAndEventName', event: undefined })],
        malformed: noMalformed,
      });
      expect(issues).toEqual([expect.objectContaining({ rule: 'matcher-rule-missing-field', severity: 'error' })]);
    });

    it('flags MatchEventBusAndCategoryAndEventName when either field is blank', () => {
      const onlyCategory = validatePlatformEventSubscriptions({
        records: [
          record({ matcherRule: 'MatchEventBusAndCategoryAndEventName', eventCategory: 'Finance', event: undefined }),
        ],
        malformed: noMalformed,
      });
      expect(onlyCategory).toEqual([expect.objectContaining({ rule: 'matcher-rule-missing-field' })]);

      const onlyEvent = validatePlatformEventSubscriptions({
        records: [
          record({ matcherRule: 'MatchEventBusAndCategoryAndEventName', eventCategory: undefined, event: 'Updated' }),
        ],
        malformed: noMalformed,
      });
      expect(onlyEvent).toEqual([expect.objectContaining({ rule: 'matcher-rule-missing-field' })]);
    });

    it('does not flag MatchEventBusAndCategoryAndEventName when both fields are set', () => {
      const issues = validatePlatformEventSubscriptions({
        records: [
          record({ matcherRule: 'MatchEventBusAndCategoryAndEventName', eventCategory: 'Finance', event: 'Updated' }),
        ],
        malformed: noMalformed,
      });
      expect(issues.filter((i) => i.rule === 'matcher-rule-missing-field')).toEqual([]);
    });
  });

  describe('unreachable-subscription', () => {
    it('flags a MatchEventBus record with both match fields blank', () => {
      const issues = validatePlatformEventSubscriptions({
        records: [record({ matcherRule: 'MatchEventBus', eventCategory: undefined, event: undefined })],
        malformed: noMalformed,
      });
      expect(issues).toEqual([expect.objectContaining({ rule: 'unreachable-subscription', severity: 'warning' })]);
    });

    it('does not flag a MatchEventBus record with a category set', () => {
      const issues = validatePlatformEventSubscriptions({
        records: [record({ matcherRule: 'MatchEventBus', eventCategory: 'Finance', event: undefined })],
        malformed: noMalformed,
      });
      expect(issues.filter((i) => i.rule === 'unreachable-subscription')).toEqual([]);
    });

    it('does not flag a non-MatchEventBus record with both match fields blank (matcher-rule-missing-field covers it instead)', () => {
      const issues = validatePlatformEventSubscriptions({
        records: [
          record({ matcherRule: 'MatchEventBusAndCategoryAndEventName', eventCategory: undefined, event: undefined }),
        ],
        malformed: noMalformed,
      });
      expect(issues.filter((i) => i.rule === 'unreachable-subscription')).toEqual([]);
      expect(issues).toEqual([expect.objectContaining({ rule: 'matcher-rule-missing-field' })]);
    });
  });

  describe('non-conforming-event-bus', () => {
    it('is silent when eventBusFields is not provided', () => {
      const issues = validatePlatformEventSubscriptions({ records: [record()], malformed: noMalformed });
      expect(issues.filter((i) => i.rule === 'non-conforming-event-bus')).toEqual([]);
    });

    it('is silent when the bus is absent from eventBusFields', () => {
      const eventBusFields: EventBusFields = new Map([['Other_Bus__e', new Set(['Category__c', 'EventName__c'])]]);
      const issues = validatePlatformEventSubscriptions(
        { records: [record()], malformed: noMalformed },
        eventBusFields,
      );
      expect(issues.filter((i) => i.rule === 'non-conforming-event-bus')).toEqual([]);
    });

    it('flags a bus missing Category__c and/or EventName__c', () => {
      const eventBusFields: EventBusFields = new Map([['Account_Change__e', new Set(['SomeOtherField__c'])]]);
      const issues = validatePlatformEventSubscriptions(
        { records: [record()], malformed: noMalformed },
        eventBusFields,
      );
      expect(issues).toEqual([expect.objectContaining({ rule: 'non-conforming-event-bus', severity: 'error' })]);
    });

    it('does not flag a bus that has both required fields', () => {
      const eventBusFields: EventBusFields = new Map([
        ['Account_Change__e', new Set(['Category__c', 'EventName__c', 'Other__c'])],
      ]);
      const issues = validatePlatformEventSubscriptions(
        { records: [record()], malformed: noMalformed },
        eventBusFields,
      );
      expect(issues.filter((i) => i.rule === 'non-conforming-event-bus')).toEqual([]);
    });
  });

  describe('duplicate-consumer', () => {
    it('flags every record sharing a Consumer__c value', () => {
      const records = [
        record({ developerName: 'First', consumer: 'SharedConsumer' }),
        record({ developerName: 'Second', consumer: 'SharedConsumer' }),
      ];

      const issues = validatePlatformEventSubscriptions({ records, malformed: noMalformed });

      const duplicateIssues = issues.filter((i) => i.rule === 'duplicate-consumer');
      expect(duplicateIssues).toHaveLength(2);
      expect(duplicateIssues.map((i) => i.developerName).sort()).toEqual(['First', 'Second']);
    });

    it('does not flag records with distinct consumers', () => {
      const records = [
        record({ developerName: 'First', consumer: 'ConsumerA' }),
        record({ developerName: 'Second', consumer: 'ConsumerB' }),
      ];
      const issues = validatePlatformEventSubscriptions({ records, malformed: noMalformed });
      expect(issues.filter((i) => i.rule === 'duplicate-consumer')).toEqual([]);
    });
  });

  describe('duplicate-developer-name', () => {
    it('flags the same DeveloperName defined more than once across records and malformed', () => {
      const records = [record({ developerName: 'Dup', consumer: 'ConsumerA' })];
      const malformed: MalformedPlatformEventSubscriptionRecord[] = [{ developerName: 'Dup', source: 'other' }];

      const issues = validatePlatformEventSubscriptions({ records, malformed });

      const dupIssues = issues.filter((i) => i.rule === 'duplicate-developer-name');
      expect(dupIssues).toHaveLength(2);
    });
  });
});

describe('resolvePlatformEventDistribution', () => {
  const input = { eventBus: 'Account_Change__e', category: 'Finance', eventName: 'AccountUpdated' };

  it('excludes records on a different event bus entirely — not even as a miss', () => {
    const result = resolvePlatformEventDistribution(input, [record({ eventBus: 'Other_Bus__e' })]);
    expect(result.matches).toEqual([]);
    expect(result.misses).toEqual([]);
  });

  it('misses an inactive record with reason "inactive", ahead of every other check', () => {
    const result = resolvePlatformEventDistribution(input, [
      record({ isActive: false, matcherRule: 'MatchEventBus', eventCategory: 'Finance' }),
    ]);
    expect(result.matches).toEqual([]);
    expect(result.misses).toEqual([expect.objectContaining({ reason: 'inactive' })]);
  });

  it('misses a record the pre-filter rejects before any matcher rule runs, with reason "prefiltered"', () => {
    const result = resolvePlatformEventDistribution(input, [
      record({ matcherRule: 'MatchEventBus', eventCategory: 'Unrelated', event: undefined }),
    ]);
    expect(result.matches).toEqual([]);
    expect(result.misses).toEqual([expect.objectContaining({ reason: 'prefiltered' })]);
  });

  it('passes the pre-filter via Event__c while MatcherRule__c needs the blank EventCategory__c — "matcher-rule-missing-field", not "prefiltered"', () => {
    const result = resolvePlatformEventDistribution(input, [
      record({ matcherRule: 'MatchEventBusAndCategory', eventCategory: undefined, event: 'AccountUpdated' }),
    ]);
    expect(result.matches).toEqual([]);
    expect(result.misses).toEqual([expect.objectContaining({ reason: 'matcher-rule-missing-field' })]);
  });

  it('misses a record whose matcher rule fields are present but don\'t match the event, with reason "no-match"', () => {
    const result = resolvePlatformEventDistribution(input, [
      record({ matcherRule: 'MatchEventBusAndCategory', eventCategory: 'Finance', event: 'AccountUpdated' }),
    ]);
    // eventCategory matches the pre-filter and MatchEventBusAndCategory's own field, but flip it to a mismatch:
    const mismatch = resolvePlatformEventDistribution(input, [
      record({ matcherRule: 'MatchEventBusAndCategory', eventCategory: 'Other', event: 'AccountUpdated' }),
    ]);
    expect(result.matches).toHaveLength(1);
    expect(mismatch.matches).toEqual([]);
    expect(mismatch.misses).toEqual([expect.objectContaining({ reason: 'no-match' })]);
  });

  describe('the four matcher rules', () => {
    it("MatchEventBus matches once it passes the pre-filter, regardless of the event's own values", () => {
      const result = resolvePlatformEventDistribution(input, [
        record({ matcherRule: 'MatchEventBus', eventCategory: 'Finance', event: undefined }),
      ]);
      expect(result.matches).toHaveLength(1);
    });

    it('MatchEventBusAndCategory matches on EventCategory__c, case-insensitively', () => {
      const result = resolvePlatformEventDistribution(input, [
        record({ matcherRule: 'MatchEventBusAndCategory', eventCategory: 'FINANCE', event: undefined }),
      ]);
      expect(result.matches).toHaveLength(1);
    });

    it('MatchEventBusAndEventName matches on Event__c, case-insensitively', () => {
      const result = resolvePlatformEventDistribution(input, [
        record({ matcherRule: 'MatchEventBusAndEventName', eventCategory: undefined, event: 'accountupdated' }),
      ]);
      expect(result.matches).toHaveLength(1);
    });

    it('MatchEventBusAndCategoryAndEventName requires both to match', () => {
      const both = resolvePlatformEventDistribution(input, [
        record({
          matcherRule: 'MatchEventBusAndCategoryAndEventName',
          eventCategory: 'Finance',
          event: 'AccountUpdated',
        }),
      ]);
      const onlyOne = resolvePlatformEventDistribution(input, [
        record({ matcherRule: 'MatchEventBusAndCategoryAndEventName', eventCategory: 'Finance', event: 'Other' }),
      ]);
      expect(both.matches).toHaveLength(1);
      expect(onlyOne.matches).toEqual([]);
      expect(onlyOne.misses).toEqual([expect.objectContaining({ reason: 'no-match' })]);
    });
  });

  it('reads sync/async from Execute_Synchronous__c on a match', () => {
    const result = resolvePlatformEventDistribution(input, [
      record({ matcherRule: 'MatchEventBus', eventCategory: 'Finance', executeSynchronous: true }),
    ]);
    expect(result.matches).toEqual([expect.objectContaining({ executeSynchronous: true })]);
  });

  it('returns matches in scan order — no priority/winner concept for this family', () => {
    const result = resolvePlatformEventDistribution(input, [
      record({ developerName: 'Second', matcherRule: 'MatchEventBus', eventCategory: 'Finance' }),
      record({ developerName: 'First', matcherRule: 'MatchEventBus', eventCategory: 'Finance' }),
    ]);
    expect(result.matches.map((m) => m.developerName)).toEqual(['Second', 'First']);
  });

  it('echoes the input back on the result envelope', () => {
    const result = resolvePlatformEventDistribution(input, []);
    expect(result.input).toEqual(input);
  });
});
