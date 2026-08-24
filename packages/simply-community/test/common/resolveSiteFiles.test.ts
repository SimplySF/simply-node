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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  resolveNetworkFile,
  resolveRetrieveDestination,
  resolveSearchRoots,
  resolveSiteFile,
} from '../../src/common/resolveSiteFiles.js';

const SITE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CustomSite xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Partner Portal</label>
</CustomSite>
`;

function networkXml(site: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Network xmlns="http://soap.sforce.com/2006/04/metadata">
    <site>${site}</site>
</Network>
`;
}

async function writeFile(root: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

describe('resolveSiteFiles', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'simply-community-test-'));
  });

  afterEach(async () => {
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  describe('resolveSearchRoots', () => {
    it('uses the given directory as the sole root when provided', async () => {
      const roots = await resolveSearchRoots(projectDir, projectDir);

      expect(roots).to.deep.equal([path.resolve(projectDir)]);
    });

    it('defaults to every package directory in sfdx-project.json', async () => {
      await writeFile(
        projectDir,
        'sfdx-project.json',
        JSON.stringify({ packageDirectories: [{ path: 'force-app', default: true }, { path: 'unpackaged' }] }),
      );

      const roots = await resolveSearchRoots(undefined, projectDir);

      expect(roots).to.deep.equal([path.resolve(projectDir, 'force-app'), path.resolve(projectDir, 'unpackaged')]);
    });
  });

  describe('resolveRetrieveDestination', () => {
    it('uses the given directory when provided', async () => {
      const destination = await resolveRetrieveDestination(projectDir, projectDir);

      expect(destination).to.equal(path.resolve(projectDir));
    });

    it('defaults to the project default package directory', async () => {
      await writeFile(
        projectDir,
        'sfdx-project.json',
        JSON.stringify({
          packageDirectories: [{ path: 'unpackaged' }, { path: 'force-app', default: true }],
        }),
      );

      const destination = await resolveRetrieveDestination(undefined, projectDir);

      expect(destination).to.equal(path.resolve(projectDir, 'force-app'));
    });

    it('throws when no directory is given and the project has no default package directory', async () => {
      await writeFile(projectDir, 'sfdx-project.json', JSON.stringify({ packageDirectories: [{ path: 'force-app' }] }));

      await expect(resolveRetrieveDestination(undefined, projectDir)).rejects.toMatchObject({
        name: 'CommunityUrlNoRetrieveDestinationError',
      });
    });
  });

  describe('resolveSiteFile', () => {
    it('throws when no site file matches', async () => {
      await expect(resolveSiteFile('Partner_Portal', [projectDir])).rejects.toMatchObject({
        name: 'CommunityUrlSiteFileNotFoundError',
      });
    });

    it('finds exactly one matching site file', async () => {
      await writeFile(projectDir, 'force-app/main/default/sites/Partner_Portal.site-meta.xml', SITE_XML);

      const found = await resolveSiteFile('Partner_Portal', [projectDir]);

      expect(found).to.equal(path.resolve(projectDir, 'force-app/main/default/sites/Partner_Portal.site-meta.xml'));
    });

    it('throws and lists the matches when more than one site file matches', async () => {
      await writeFile(projectDir, 'pkg-a/sites/Partner_Portal.site-meta.xml', SITE_XML);
      await writeFile(projectDir, 'pkg-b/sites/Partner_Portal.site-meta.xml', SITE_XML);

      await expect(resolveSiteFile('Partner_Portal', [projectDir])).rejects.toMatchObject({
        name: 'CommunityUrlSiteFileAmbiguousError',
      });
    });
  });

  describe('resolveNetworkFile', () => {
    it('throws when no network file references the site', async () => {
      await writeFile(projectDir, 'force-app/networks/Other.network-meta.xml', networkXml('Other_Site'));

      await expect(resolveNetworkFile('Partner_Portal', [projectDir])).rejects.toMatchObject({
        name: 'CommunityUrlNetworkFileNotFoundError',
      });
    });

    it('finds the one network file whose <site> matches, regardless of its own basename', async () => {
      await writeFile(projectDir, 'force-app/networks/Partner Portal.network-meta.xml', networkXml('Partner_Portal'));
      await writeFile(projectDir, 'force-app/networks/Other.network-meta.xml', networkXml('Other_Site'));

      const found = await resolveNetworkFile('Partner_Portal', [projectDir]);

      expect(found).to.equal(path.resolve(projectDir, 'force-app/networks/Partner Portal.network-meta.xml'));
    });

    it('throws and lists the matches when more than one network file references the site', async () => {
      await writeFile(projectDir, 'pkg-a/networks/A.network-meta.xml', networkXml('Partner_Portal'));
      await writeFile(projectDir, 'pkg-b/networks/B.network-meta.xml', networkXml('Partner_Portal'));

      await expect(resolveNetworkFile('Partner_Portal', [projectDir])).rejects.toMatchObject({
        name: 'CommunityUrlNetworkFileAmbiguousError',
      });
    });
  });
});
