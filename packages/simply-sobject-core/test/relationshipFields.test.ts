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

import type { Connection } from '@salesforce/core';
import { describe, expect, it } from 'vitest';
import { discoverRelationshipFields } from '../src/relationshipFields.js';

type FakeField = {
  name: string;
  type: string;
  nameField?: boolean;
  relationshipName?: string | null;
  referenceTo?: string[];
};

function fakeConnection(describesByObject: Record<string, FakeField[]>): {
  connection: Connection;
  describeCalls: string[];
} {
  const describeCalls: string[] = [];

  const connection = {
    describe: async (objectName: string) => {
      describeCalls.push(objectName);
      return { fields: describesByObject[objectName] ?? [] };
    },
  } as unknown as Connection;

  return { connection, describeCalls };
}

describe('discoverRelationshipFields', () => {
  it('discovers the name field and DeveloperName of a single-target lookup', async () => {
    const { connection } = fakeConnection({
      RecordType: [
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string', nameField: true },
        { name: 'DeveloperName', type: 'string', nameField: false },
      ],
    });

    const fields: FakeField[] = [
      { name: 'RecordTypeId', type: 'reference', relationshipName: 'RecordType', referenceTo: ['RecordType'] },
    ];

    const result = await discoverRelationshipFields(
      connection,
      fields as Parameters<typeof discoverRelationshipFields>[1],
    );

    expect(result).to.deep.equal(['RecordType.Name', 'RecordType.DeveloperName']);
  });

  it('discovers just the name field when there is no DeveloperName', async () => {
    const { connection } = fakeConnection({
      Account: [
        { name: 'Id', type: 'id' },
        { name: 'Name', type: 'string', nameField: true },
      ],
    });

    const fields: FakeField[] = [
      { name: 'ParentId', type: 'reference', relationshipName: 'Parent', referenceTo: ['Account'] },
    ];

    const result = await discoverRelationshipFields(
      connection,
      fields as Parameters<typeof discoverRelationshipFields>[1],
    );

    expect(result).to.deep.equal(['Parent.Name']);
  });

  it('skips polymorphic relationship fields', async () => {
    const { connection, describeCalls } = fakeConnection({});

    const fields: FakeField[] = [
      { name: 'OwnerId', type: 'reference', relationshipName: 'Owner', referenceTo: ['User', 'Group'] },
    ];

    const result = await discoverRelationshipFields(
      connection,
      fields as Parameters<typeof discoverRelationshipFields>[1],
    );

    expect(result).to.deep.equal([]);
    expect(describeCalls).to.deep.equal([]);
  });

  it('skips reference fields with no relationshipName', async () => {
    const { connection, describeCalls } = fakeConnection({});

    const fields: FakeField[] = [{ name: 'SomeSystemFieldId', type: 'reference', relationshipName: null }];

    const result = await discoverRelationshipFields(
      connection,
      fields as Parameters<typeof discoverRelationshipFields>[1],
    );

    expect(result).to.deep.equal([]);
    expect(describeCalls).to.deep.equal([]);
  });

  it('ignores non-reference fields', async () => {
    const { connection } = fakeConnection({});

    const fields: FakeField[] = [{ name: 'Name', type: 'string' }];

    const result = await discoverRelationshipFields(
      connection,
      fields as Parameters<typeof discoverRelationshipFields>[1],
    );

    expect(result).to.deep.equal([]);
  });

  it('describes each distinct target object only once', async () => {
    const { connection, describeCalls } = fakeConnection({
      Account: [{ name: 'Name', type: 'string', nameField: true }],
    });

    const fields: FakeField[] = [
      { name: 'AccountId', type: 'reference', relationshipName: 'Account', referenceTo: ['Account'] },
      { name: 'Other_Account__c', type: 'reference', relationshipName: 'Other_Account__r', referenceTo: ['Account'] },
    ];

    const result = await discoverRelationshipFields(
      connection,
      fields as Parameters<typeof discoverRelationshipFields>[1],
    );

    expect(describeCalls).to.deep.equal(['Account']);
    expect(result).to.deep.equal(['Account.Name', 'Other_Account__r.Name']);
  });
});
