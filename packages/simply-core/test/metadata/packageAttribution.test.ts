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

import { Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import sinon from 'sinon';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  LOCAL_PACKAGE_LABEL,
  normalizePublisherName,
  resolvePackageNamesByApiName,
  resolvePackageNamesBySubjectId,
} from '../../src/metadata/packageAttribution.js';

describe('normalizePublisherName', () => {
  it('maps the explicit <local> publisher to the unpackaged label', () => {
    expect(normalizePublisherName('<local>', 'Standard/Local')).to.equal(LOCAL_PACKAGE_LABEL);
  });

  it('passes a real package name through unchanged', () => {
    expect(normalizePublisherName('Acme Utilities', 'Standard/Local')).to.equal('Acme Utilities');
  });

  it('uses the caller fallback when there is no publisher at all', () => {
    expect(normalizePublisherName(undefined, 'Standard/Local')).to.equal('Standard/Local');
  });

  it('keeps the two "not packaged" cases distinct', () => {
    expect(normalizePublisherName('<local>', 'N/A')).to.not.equal(normalizePublisherName(undefined, 'N/A'));
  });
});

describe('resolvePackageNamesBySubjectId', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  it('keys results by 15-character ID and truncates 18-character inputs for the query', async () => {
    const connection = await testOrg.getConnection();
    const stub = $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      totalSize: 1,
      done: true,
      records: [{ SubjectId: '0PS000000000001', SubscriberPackage: { Name: 'Acme Utilities' } }],
    } as never);

    const result = await resolvePackageNamesBySubjectId(connection, ['0PS000000000001AAA'], { chunkSize: 10 });

    expect(stub.firstCall.args[0]).to.contain("'0PS000000000001'");
    expect(stub.firstCall.args[0]).to.not.contain('AAA');
    expect(result.get('0PS000000000001')).to.equal('Acme Utilities');
  });

  it('normalizes an 18-character SubjectId in the response back to 15 characters', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      totalSize: 1,
      done: true,
      records: [{ SubjectId: '0PS000000000001AAA', SubscriberPackage: { Name: 'Acme Utilities' } }],
    } as never);

    const result = await resolvePackageNamesBySubjectId(connection, ['0PS000000000001'], { chunkSize: 10 });

    expect(result.get('0PS000000000001')).to.equal('Acme Utilities');
  });

  it('omits components that came back without a package name, rather than inventing a placeholder', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      totalSize: 1,
      done: true,
      records: [{ SubjectId: '0PS000000000001', SubscriberPackage: {} }],
    } as never);

    const result = await resolvePackageNamesBySubjectId(connection, ['0PS000000000001'], { chunkSize: 10 });

    expect(result.has('0PS000000000001')).to.equal(false);
  });

  it('returns an empty map when the org has no Package2Member and failure is tolerated', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').rejects(new Error("sObject type 'Package2Member'"));

    const result = await resolvePackageNamesBySubjectId(connection, ['0PS000000000001'], {
      chunkSize: 10,
      tolerateFailure: true,
    });

    expect(result.size).to.equal(0);
  });

  it('queries the Tooling API', async () => {
    const connection = await testOrg.getConnection();
    const stub = $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      totalSize: 0,
      done: true,
      records: [],
    });

    await resolvePackageNamesBySubjectId(connection, ['0PS000000000001'], { chunkSize: 10 });

    expect(stub.firstCall.args[1]).to.deep.equal({ tooling: true });
  });
});

describe('resolvePackageNamesByApiName', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  it('maps each object API name to its normalized publisher label', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      totalSize: 3,
      done: true,
      records: [
        { QualifiedApiName: 'Account', Publisher: {} },
        { QualifiedApiName: 'Widget__c', Publisher: { Name: '<local>' } },
        { QualifiedApiName: 'acme__Gadget__c', Publisher: { Name: 'Acme Utilities' } },
      ],
    } as never);

    const result = await resolvePackageNamesByApiName(connection, ['Account', 'Widget__c', 'acme__Gadget__c'], {
      chunkSize: 10,
      fallbackLabel: 'Standard/Local',
    });

    expect(result.get('Account')).to.equal('Standard/Local');
    expect(result.get('Widget__c')).to.equal(LOCAL_PACKAGE_LABEL);
    expect(result.get('acme__Gadget__c')).to.equal('Acme Utilities');
    expect(result.size).to.equal(3);
  });

  it('defaults the no-publisher label to the unpackaged label', async () => {
    const connection = await testOrg.getConnection();
    $$.SANDBOX.stub(Connection.prototype, 'autoFetchQuery').resolves({
      totalSize: 1,
      done: true,
      records: [{ QualifiedApiName: 'Account', Publisher: {} }],
    } as never);

    const result = await resolvePackageNamesByApiName(connection, ['Account'], { chunkSize: 10 });

    expect(result.get('Account')).to.equal(LOCAL_PACKAGE_LABEL);
  });
});
