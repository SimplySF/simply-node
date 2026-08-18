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

import { logger } from '../logger.js';
import { authenticateOrg } from '../sfAuth.js';
import { installPackageDependencies as installPackageDependenciesCommon } from '../sfPackages.js';
import { readScratchOrgInfo } from './scratchOrgInfo.js';

export type InstallDependenciesOptions = {
  jwtKeyFile: string;
  debug?: boolean;
  installType?: 'All' | 'Delta' | 'Upgrade';
};

/** Authenticates to the scratch org (recorded in `SCRATCH_ORG_INFO.json`) and installs its packaged dependencies. */
export async function installDependencies(options: InstallDependenciesOptions): Promise<void> {
  logger.info('Installing package dependencies into scratch org...');
  const scratchOrgInfo = await readScratchOrgInfo();
  await authenticateOrg({
    username: scratchOrgInfo.authFields.username,
    clientId: scratchOrgInfo.authFields.clientId,
    instanceUrl: scratchOrgInfo.authFields.instanceUrl,
    jwtKeyFile: options.jwtKeyFile,
    setDefault: true,
    debug: options.debug,
  });
  // A default org is now set, so no alias is needed.
  await installPackageDependenciesCommon({ wait: '240', installType: options.installType });
  logger.success('Package dependencies installed.');
}
