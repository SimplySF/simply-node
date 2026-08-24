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

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Connection, SfError } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { ComponentSet, ComponentStatus } from '@salesforce/source-deploy-retrieve';
import sinon from 'sinon';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import CommunityUrlSet from '../../../../../src/commands/simply/community/url/set.js';

const SITE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CustomSite xmlns="http://soap.sforce.com/2006/04/metadata">
    <customWebAddresses>
        <domainName>old.example.com</domainName>
        <primary>true</primary>
    </customWebAddresses>
    <label>Partner Portal</label>
</CustomSite>
`;

const NETWORK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Network xmlns="http://soap.sforce.com/2006/04/metadata">
    <site>Partner_Portal</site>
</Network>
`;

const DOMAIN_FOUND_UNBOUND = {
  done: true,
  totalSize: 1,
  records: [{ Id: '0Dm000000000001', Domain: 'partners.acme.com', DomainSites: { records: [] } }],
};

async function writeFile(root: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

describe('simply community url set', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();
  let directory: string;
  let siteFile: string;
  let networkFile: string;

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'simply-community-url-set-'));
    siteFile = path.join(directory, 'sites', 'Partner_Portal.site-meta.xml');
    networkFile = path.join(directory, 'networks', 'Partner_Portal.network-meta.xml');
    await writeFile(directory, 'sites/Partner_Portal.site-meta.xml', SITE_XML);
    await writeFile(directory, 'networks/Partner_Portal.network-meta.xml', NETWORK_XML);
  });

  afterEach(async () => {
    $$.restore();
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('errors without the required flags', async () => {
    try {
      await CommunityUrlSet.run([]);
      expect.fail('should have thrown');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include('site');
      expect(error.message).to.include('domain');
    }
  });

  it('patches the site file in place without an org, and does not touch the network file', async () => {
    const result = await CommunityUrlSet.run([
      '--site',
      'Partner_Portal',
      '--domain',
      'partners.acme.com',
      '--directory',
      directory,
    ]);

    expect(result.previousDomains).to.deep.equal(['old.example.com']);
    expect(result.domainCheck).to.be.undefined;
    expect(result.networkFile).to.be.undefined;

    const siteContent = await fs.readFile(siteFile, 'utf-8');
    expect(siteContent).to.include('<domainName>partners.acme.com</domainName>');
    expect(siteContent).not.to.include('old.example.com');

    const networkContent = await fs.readFile(networkFile, 'utf-8');
    expect(networkContent).to.equal(NETWORK_XML);
  });

  it('patches both files when --path-prefix is given', async () => {
    const result = await CommunityUrlSet.run([
      '--site',
      'Partner_Portal',
      '--domain',
      'partners.acme.com',
      '--path-prefix',
      'partners',
      '--directory',
      directory,
    ]);

    expect(result.networkFile).to.equal(networkFile);

    const siteContent = await fs.readFile(siteFile, 'utf-8');
    expect(siteContent).to.include('<urlPathPrefix>partners</urlPathPrefix>');

    const networkContent = await fs.readFile(networkFile, 'utf-8');
    expect(networkContent).to.include('<urlPathPrefix>partners</urlPathPrefix>');
  });

  it('errors and leaves the site file unchanged when the domain is not registered', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'query').resolves({ done: true, totalSize: 0, records: [] });

    try {
      await CommunityUrlSet.run([
        '--site',
        'Partner_Portal',
        '--domain',
        'partners.acme.com',
        '--directory',
        directory,
        '--target-org',
        testOrg.username,
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include('partners.acme.com');
    }

    const siteContent = await fs.readFile(siteFile, 'utf-8');
    expect(siteContent).to.equal(SITE_XML);
  });

  it('warns and patches anyway when the domain is missing and --ignore-missing-domain is passed', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'query').resolves({ done: true, totalSize: 0, records: [] });
    const warnStub = $$.SANDBOX.stub(CommunityUrlSet.prototype, 'warn');

    const result = await CommunityUrlSet.run([
      '--site',
      'Partner_Portal',
      '--domain',
      'partners.acme.com',
      '--directory',
      directory,
      '--target-org',
      testOrg.username,
      '--ignore-missing-domain',
    ]);

    expect(result.domainCheck).to.deep.equal({ status: 'missing', boundToSiteIds: [], ignored: true });
    expect(warnStub.called).to.equal(true);

    const siteContent = await fs.readFile(siteFile, 'utf-8');
    expect(siteContent).to.include('<domainName>partners.acme.com</domainName>');
  });

  it('errors at parse time when --deploy is passed without --target-org', async () => {
    try {
      await CommunityUrlSet.run([
        '--site',
        'Partner_Portal',
        '--domain',
        'partners.acme.com',
        '--directory',
        directory,
        '--deploy',
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      const error = err as SfError;
      expect(error.message.toLowerCase()).to.include('target-org');
    }
  });

  it('errors at parse time when --publish is passed without --deploy', async () => {
    try {
      await CommunityUrlSet.run([
        '--site',
        'Partner_Portal',
        '--domain',
        'partners.acme.com',
        '--directory',
        directory,
        '--publish',
        '--target-org',
        testOrg.username,
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      const error = err as SfError;
      expect(error.message.toLowerCase()).to.include('deploy');
    }
  });

  it('restores the original file contents after a successful --deploy', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'query').resolves(DOMAIN_FOUND_UNBOUND);
    const fakeDeployResult = {
      response: { id: '0Af000000000001', status: 'Succeeded', success: true },
      getFileResponses: () => [
        { fullName: 'Partner_Portal', type: 'CustomSite', filePath: siteFile, state: ComponentStatus.Changed },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    const result = await CommunityUrlSet.run([
      '--site',
      'Partner_Portal',
      '--domain',
      'partners.acme.com',
      '--directory',
      directory,
      '--deploy',
      '--target-org',
      testOrg.username,
    ]);

    expect(result.deploy).to.deep.equal({
      id: '0Af000000000001',
      status: 'Succeeded',
      componentsDeployed: ['Partner_Portal'],
      restored: true,
    });

    const siteContent = await fs.readFile(siteFile, 'utf-8');
    expect(siteContent).to.equal(SITE_XML);
  });

  it('still restores the original file contents when --deploy fails, and throws', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'query').resolves(DOMAIN_FOUND_UNBOUND);
    const fakeDeployResult = {
      response: { id: '0Af000000000002', status: 'Failed', success: false },
      getFileResponses: () => [
        {
          fullName: 'Partner_Portal',
          type: 'CustomSite',
          filePath: siteFile,
          state: ComponentStatus.Failed,
          error: 'Domain is not registered',
        },
      ],
    };
    $$.SANDBOX.stub(ComponentSet.prototype, 'deploy').resolves({
      pollStatus: sinon.stub().resolves(fakeDeployResult),
    } as never);

    try {
      await CommunityUrlSet.run([
        '--site',
        'Partner_Portal',
        '--domain',
        'partners.acme.com',
        '--directory',
        directory,
        '--deploy',
        '--target-org',
        testOrg.username,
      ]);
      expect.fail('should have thrown');
    } catch (err) {
      const error = err as SfError;
      expect(error.message).to.include('Domain is not registered');
    }

    const siteContent = await fs.readFile(siteFile, 'utf-8');
    expect(siteContent).to.equal(SITE_XML);
  });
});
