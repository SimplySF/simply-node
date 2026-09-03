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

import { Connection } from '@salesforce/core';
import { describe, expect, it } from 'vitest';
import { createContentNote, uploadContentNotes } from '../src/contentNoteUtils.js';
import { ContentNoteInput } from '../src/contentNoteTypes.js';

type CreateCall = { sobject: string; fields: Record<string, unknown> };

type StubResult =
  { success: true; id: string; errors: never[] } | { success: false; errors: Array<{ message: string }> };

/**
 * Build a `Connection` stub whose `sobject(name).create(fields)` records every call and returns a
 * per-sobject-name result, defaulting to a successful create with an incrementing id.
 *
 * @param results - Per-sobject-name results to return instead of the success default.
 * @returns The stub connection, plus the calls it recorded (in call order).
 */
function stubConnection(results: Partial<Record<string, StubResult>> = {}): {
  connection: Connection;
  calls: CreateCall[];
} {
  const calls: CreateCall[] = [];
  let nextId = 1;

  const connection = {
    sobject: (sobject: string) => ({
      create: (fields: Record<string, unknown>) => {
        calls.push({ sobject, fields });

        const result = results[sobject];
        if (result) {
          return Promise.resolve(result);
        }

        return Promise.resolve({ success: true, id: `${sobject}Id${nextId++}`, errors: [] });
      },
    }),
  } as unknown as Connection;

  return { connection, calls };
}

const baseInput: ContentNoteInput = {
  content: 'hello world',
  title: 'My Note',
  linkedRecordExternalId: 'EXT-1',
};

describe('createContentNote', () => {
  it('base64-encodes the content and sends it with the title', async () => {
    const { connection, calls } = stubConnection();

    await createContentNote(connection, baseInput, '001000000000001AAA');

    const noteCall = calls.find((call) => call.sobject === 'ContentNote');
    expect(noteCall?.fields.Content).to.equal(Buffer.from('hello world').toString('base64'));
    expect(noteCall?.fields.Title).to.equal('My Note');
  });

  it('omits CreatedDate and CreatedBy when not given', async () => {
    const { connection, calls } = stubConnection();

    await createContentNote(connection, baseInput, '001000000000001AAA');

    const noteCall = calls.find((call) => call.sobject === 'ContentNote');
    expect(noteCall?.fields).to.not.have.property('CreatedDate');
    expect(noteCall?.fields).to.not.have.property('CreatedBy');
  });

  it('sends CreatedDate as the given ISO-8601 string, not a numeric timestamp', async () => {
    const { connection, calls } = stubConnection();

    await createContentNote(
      connection,
      { ...baseInput, createdDate: '2024-01-15T10:30:00.000Z' },
      '001000000000001AAA',
    );

    const noteCall = calls.find((call) => call.sobject === 'ContentNote');
    expect(noteCall?.fields.CreatedDate).to.equal('2024-01-15T10:30:00.000Z');
  });

  it('sends CreatedBy.FederationIdentifier when given', async () => {
    const { connection, calls } = stubConnection();

    await createContentNote(connection, { ...baseInput, createdByFederationId: 'fed-123' }, '001000000000001AAA');

    const noteCall = calls.find((call) => call.sobject === 'ContentNote');
    expect(noteCall?.fields.CreatedBy).to.deep.equal({ FederationIdentifier: 'fed-123' });
  });

  it('links the created note to the given record with the expected share settings', async () => {
    const { connection, calls } = stubConnection();

    await createContentNote(connection, baseInput, '001000000000001AAA');

    const linkCall = calls.find((call) => call.sobject === 'ContentDocumentLink');
    expect(linkCall?.fields).to.deep.equal({
      ContentDocumentId: 'ContentNoteId1',
      LinkedEntityId: '001000000000001AAA',
      ShareType: 'I',
      Visibility: 'InternalUsers',
    });
  });

  it('returns success with both created ids', async () => {
    const { connection } = stubConnection();

    const result = await createContentNote(connection, baseInput, '001000000000001AAA');

    expect(result).to.deep.equal({
      status: 'success',
      input: baseInput,
      contentNoteId: 'ContentNoteId1',
      contentDocumentLinkId: 'ContentDocumentLinkId2',
    });
  });

  it('returns a note-stage error and never attempts the link when the note create fails', async () => {
    const { connection, calls } = stubConnection({
      ContentNote: { success: false, errors: [{ message: 'REQUIRED_FIELD_MISSING: Title' }] },
    });

    const result = await createContentNote(connection, baseInput, '001000000000001AAA');

    expect(result).to.deep.equal({
      status: 'error',
      input: baseInput,
      stage: 'note',
      message: 'REQUIRED_FIELD_MISSING: Title',
    });
    expect(calls.some((call) => call.sobject === 'ContentDocumentLink')).to.equal(false);
  });

  it('returns a link-stage error that still reports the orphaned note id', async () => {
    const { connection } = stubConnection({
      ContentDocumentLink: { success: false, errors: [{ message: 'INVALID_FIELD: LinkedEntityId' }] },
    });

    const result = await createContentNote(connection, baseInput, '001000000000001AAA');

    expect(result).to.deep.equal({
      status: 'error',
      input: baseInput,
      stage: 'link',
      contentNoteId: 'ContentNoteId1',
      message: 'INVALID_FIELD: LinkedEntityId',
    });
  });
});

describe('uploadContentNotes', () => {
  it('resolves each input against the lookup map and creates a note per input', async () => {
    const { connection, calls } = stubConnection();
    const lookup = new Map([
      ['EXT-1', '001000000000001AAA'],
      ['EXT-2', '001000000000002AAA'],
    ]);

    const results = [];
    for await (const result of uploadContentNotes(
      connection,
      [
        { ...baseInput, linkedRecordExternalId: 'EXT-1' },
        { ...baseInput, linkedRecordExternalId: 'EXT-2' },
      ],
      lookup,
    )) {
      results.push(result);
    }

    expect(results).to.have.lengthOf(2);
    expect(results.every((result) => result.status === 'success')).to.equal(true);

    const linkedEntityIds = calls
      .filter((call) => call.sobject === 'ContentDocumentLink')
      .map((call) => call.fields.LinkedEntityId);
    expect(linkedEntityIds.sort()).to.deep.equal(['001000000000001AAA', '001000000000002AAA']);
  });

  it('returns a lookup-stage error without any DML when the external id has no match', async () => {
    const { connection, calls } = stubConnection();

    const results = [];
    for await (const result of uploadContentNotes(connection, [baseInput], new Map())) {
      results.push(result);
    }

    expect(results).to.deep.equal([
      {
        status: 'error',
        input: baseInput,
        stage: 'lookup',
        message: 'No linked record found for external ID "EXT-1".',
      },
    ]);
    expect(calls).to.have.lengthOf(0);
  });

  it('produces exactly one result per input', async () => {
    const { connection } = stubConnection();
    const lookup = new Map([['EXT-1', '001000000000001AAA']]);
    const inputs = Array.from({ length: 5 }, () => ({ ...baseInput }));

    const results = [];
    for await (const result of uploadContentNotes(connection, inputs, lookup, { concurrency: 2 })) {
      results.push(result);
    }

    expect(results).to.have.lengthOf(5);
  });
});
