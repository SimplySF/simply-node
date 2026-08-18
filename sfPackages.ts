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

import { runSf } from './exec/sfCli.js';
import { logger } from './logger.js';

export type InstallPackageDependenciesConfig = {
  alias?: string;
  wait?: string;
  noPrompt?: boolean;
  debug?: boolean;
  installType?: 'All' | 'Delta' | 'Upgrade';
};

/**
 * Installs Salesforce package dependencies defined in `sfdx-project.json` using the
 * `@simplysf/simply` plugin's `sf simply package dependencies install` command.
 */
export async function installPackageDependencies(config: InstallPackageDependenciesConfig = {}): Promise<void> {
  const { alias, wait = '120', noPrompt = true, installType = 'Upgrade' } = config;

  logger.info('Installing packaged dependencies using the @simplysf/simply plugin...');
  try {
    const args = [
      'simply',
      'package',
      'dependencies',
      'install',
      '--apex-compile',
      'package',
      '--wait',
      wait,
      '--install-type',
      installType,
    ];
    if (alias) {
      args.push('--target-org', alias);
    }
    if (noPrompt) {
      args.push('--no-prompt');
    }

    await runSf(args, { stdio: 'inherit' });
    logger.success('Packaged dependencies installed successfully.');
  } catch (error) {
    logger.error('Failed to install packaged dependencies.');
    logger.error(String(error));
    throw error;
  }
}
