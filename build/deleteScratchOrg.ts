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

import { runSf } from '../exec/sfCli.js';
import { logger } from '../logger.js';
import { authenticateOrg } from '../sfAuth.js';
import type { DevHubConfig } from './devHubs.js';
import { readScratchOrgInfo } from './scratchOrgInfo.js';

export type DeleteScratchOrgOptions = {
  jwtKeyFile: string;
  debug?: boolean;
};

/**
 * Authenticates to the Dev Hub that owns the scratch org and deletes it.
 *
 * Deletion failures are logged, not thrown, matching the original behavior: a scratch org that
 * fails to delete just needs manual cleanup later, and shouldn't fail an otherwise-successful pipeline run.
 */
export async function deleteScratchOrg(options: DeleteScratchOrgOptions, devHubs: DevHubConfig[]): Promise<void> {
  logger.info('Deleting scratch org...');
  try {
    const scratchOrgInfo = await readScratchOrgInfo();
    const devHubUsername = scratchOrgInfo.authFields.devHubUsername;
    const devHubConfig = devHubs.find((h) => h.username === devHubUsername);
    if (!devHubConfig) {
      throw new Error(`Could not find Dev Hub configuration for username: ${devHubUsername ?? 'unknown'}`);
    }

    await authenticateOrg({
      username: devHubUsername,
      clientId: devHubConfig.clientId,
      instanceUrl: devHubConfig.instanceUrl,
      jwtKeyFile: options.jwtKeyFile,
      setDefaultDevHub: true,
      debug: options.debug,
    });
    await authenticateOrg({
      username: scratchOrgInfo.authFields.username,
      clientId: scratchOrgInfo.authFields.clientId,
      instanceUrl: scratchOrgInfo.authFields.instanceUrl,
      jwtKeyFile: options.jwtKeyFile,
      setDefault: true,
      debug: options.debug,
    });

    await runSf(['org', 'delete', 'scratch', '--no-prompt'], { stdio: 'inherit' });
    logger.success('Scratch org deleted.');
  } catch (e) {
    logger.error('Failed to delete scratch org. It may need to be deleted manually.', (e as Error).message);
  }
}
