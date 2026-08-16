/*
 * Copyright (c) 2026, Clay Chipps; Copyright (c) 2026 Salesforce, Inc.
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

import { promises as fs } from 'node:fs';
import { execa } from 'execa';
import { logger } from '../logger.js';
import { authenticateOrg } from '../sfAuth.js';
import { readScratchOrgInfo } from './scratchOrgInfo.js';

const INCOMPATIBLE_METADATA_PATTERNS = [
  '*.eca-meta.xml',
  '*.ecaGlblOauth-meta.xml',
  '*.ecaOauth-meta.xml',
  '*.ecaOauthPlcy-meta.xml',
  '*.ecaPlcy-meta.xml',
];

async function removeIncompatibleMetadata(): Promise<void> {
  logger.info('Removing incompatible metadata before push...');
  for (const pattern of INCOMPATIBLE_METADATA_PATTERNS) {
    // eslint-disable-next-line no-await-in-loop -- deletions must not race each other on the same tree
    await execa('find', [process.cwd(), '-type', 'f', '-name', pattern, '-delete']);
  }
}

export type PushScratchOptions = {
  jwtKeyFile: string;
  debug?: boolean;
  ignoreWarnings?: boolean;
  scratchOrgSourceDir?: string;
};

/** Authenticates to the scratch org, strips ECA-related metadata, and pushes source to it. */
export async function pushToScratch(options: PushScratchOptions): Promise<void> {
  logger.info('Pushing source to scratch org...');
  const scratchOrgInfo = await readScratchOrgInfo();
  await authenticateOrg({
    username: scratchOrgInfo.authFields.username,
    clientId: scratchOrgInfo.authFields.clientId,
    instanceUrl: scratchOrgInfo.authFields.instanceUrl,
    jwtKeyFile: options.jwtKeyFile,
    setDefault: true,
    debug: options.debug,
  });

  await removeIncompatibleMetadata();

  const pushArgs = ['project', 'deploy', 'start', '--ignore-conflicts', '--wait', '120'];
  if (options.ignoreWarnings) {
    pushArgs.push('--ignore-warnings');
  }
  if (options.scratchOrgSourceDir) {
    pushArgs.push('--source-dir', options.scratchOrgSourceDir);
    const sfdxProjectJson = JSON.parse(await fs.readFile('sfdx-project.json', 'utf-8')) as {
      packageDirectories: Array<{ default?: boolean; seedMetadata?: { path?: string } }>;
    };
    const seedMetadataDir = sfdxProjectJson.packageDirectories.find((d) => d.default)?.seedMetadata?.path;
    if (seedMetadataDir) {
      pushArgs.push('--source-dir', seedMetadataDir);
    }
  }

  await execa('sf', pushArgs, { stdio: 'inherit' });
  logger.success('Source pushed to scratch org.');
}
