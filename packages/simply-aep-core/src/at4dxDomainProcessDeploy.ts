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
import type { Duration } from '@salesforce/kit';
import { ComponentSet, ComponentStatus } from '@salesforce/source-deploy-retrieve';

export type DeployComponentFailure = {
  fullName: string;
  type: string;
  filePath?: string;
  error: string;
};

export type DeployMetadataFileResult = {
  id: string;
  status: string;
  success: boolean;
  failures: DeployComponentFailure[];
};

/**
 * Deploy exactly one metadata file and poll until the deploy reaches a terminal state.
 *
 * Structurally the same as `packages/simply-community/src/common/deployChangedFiles.ts` (build a
 * `ComponentSet.fromSource`, deploy, poll, map file responses to failures) but scoped to a single file
 * and kept local to this package rather than imported cross-package — see
 * docs/design/0012-at4dx-domain-process-binding-create-set.md's Alternatives considered for why this
 * isn't hoisted into a shared package.
 *
 * Does not throw on a failed deploy — a failure is reported via `success: false`/`failures` so the
 * caller can decide how to surface it (`at4dxDomainProcessWrite.ts` turns it into a
 * `DomainProcessBindingWriteError`). An error here means the deploy request or polling itself broke
 * (auth, network, timeout), not that the component failed to deploy.
 *
 * @param connection - The org connection to deploy against.
 * @param filePath - The single `.md-meta.xml` file to deploy.
 * @param wait - How long to poll before giving up.
 * @returns The deploy outcome: id, terminal status, and any per-component failures.
 */
export async function deployMetadataFile(
  connection: Connection,
  filePath: string,
  wait: Duration,
): Promise<DeployMetadataFileResult> {
  const componentSet = ComponentSet.fromSource(filePath);
  const deploy = await componentSet.deploy({ usernameOrConnection: connection });
  const result = await deploy.pollStatus({ timeout: wait });

  const failures: DeployComponentFailure[] = [];
  for (const fileResponse of result.getFileResponses()) {
    if (fileResponse.state === ComponentStatus.Failed) {
      failures.push({
        fullName: fileResponse.fullName,
        type: fileResponse.type,
        filePath: fileResponse.filePath,
        error: fileResponse.error,
      });
    }
  }

  return {
    id: result.response.id,
    status: result.response.status,
    success: result.response.success,
    failures,
  };
}
