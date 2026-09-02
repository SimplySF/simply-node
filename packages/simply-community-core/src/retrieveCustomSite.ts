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
import { ComponentSet, ComponentStatus } from '@salesforce/source-deploy-retrieve';

/**
 * Retrieve a single `CustomSite` component by name into a destination directory.
 *
 * Used when the site file isn't found locally (see `resolveSiteFile`) but a `--target-org`
 * connection is available — the fallback that lets the command work against a checkout that never
 * had `sites/` committed at all.
 *
 * The component set is built directly from `{ fullName, type: 'CustomSite' }` rather than resolved
 * from source, since there's nothing on disk yet for this component; `merge: true` is passed
 * anyway so a same-named file elsewhere under `outputDirectory` gets merged into rather than
 * duplicated, on the off chance the local search missed something the registry wouldn't.
 *
 * @param connection - The org connection to retrieve from.
 * @param site - The CustomSite API name to retrieve.
 * @param outputDirectory - Where to write the retrieved file, from `resolveRetrieveDestination`.
 * @returns The retrieved file's path, or `undefined` if the org has no `CustomSite` by that name.
 * @throws If the retrieve request or polling itself fails (auth, network, timeout) — only "the
 * component doesn't exist" is reported as `undefined` rather than thrown.
 */
export async function retrieveCustomSite(
  connection: Connection,
  site: string,
  outputDirectory: string,
): Promise<string | undefined> {
  const componentSet = new ComponentSet([{ fullName: site, type: 'CustomSite' }]);
  const operation = await componentSet.retrieve({
    usernameOrConnection: connection,
    output: outputDirectory,
    merge: true,
  });
  const result = await operation.pollStatus();

  const fileResponse = result
    .getFileResponses()
    .find((response) => response.type === 'CustomSite' && response.fullName === site);

  if (!fileResponse || fileResponse.state === ComponentStatus.Failed) {
    return undefined;
  }

  return fileResponse.filePath;
}
