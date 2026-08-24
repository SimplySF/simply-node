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

export type DeployChangedFilesOptions = {
  connection: Connection;
  /** The exact files the command just wrote — the component set is scoped to only these. */
  filePaths: string[];
  wait: Duration;
};

export type DeployComponentFailure = {
  fullName: string;
  type: string;
  filePath?: string;
  error: string;
};

export type DeployChangedFilesResult = {
  id: string;
  status: string;
  success: boolean;
  componentsDeployed: string[];
  failures: DeployComponentFailure[];
};

/**
 * Deploy exactly the given files and poll until the deploy reaches a terminal state.
 *
 * Scoped to `filePaths` rather than a whole directory: the command already knows precisely which
 * one or two files it just patched, so the component set is built from that list instead of
 * rediscovering it from `--directory`.
 *
 * Does not throw on a failed deploy — a failure is reported in the returned result (`success:
 * false`, populated `failures`) so the caller's restore `finally` still runs before it decides
 * whether to throw. An error here means the deploy request or polling itself broke (auth,
 * network, timeout), not that components failed to deploy.
 *
 * @param options - The connection to deploy against, the changed files, and how long to wait.
 * @returns The deploy outcome: id, terminal status, and per-component successes/failures.
 */
export async function deployChangedFiles(options: DeployChangedFilesOptions): Promise<DeployChangedFilesResult> {
  const componentSet = ComponentSet.fromSource(options.filePaths);
  const deploy = await componentSet.deploy({ usernameOrConnection: options.connection });
  const result = await deploy.pollStatus({ timeout: options.wait });

  const failures: DeployComponentFailure[] = [];
  const componentsDeployed: string[] = [];

  for (const fileResponse of result.getFileResponses()) {
    if (fileResponse.state === ComponentStatus.Failed) {
      failures.push({
        fullName: fileResponse.fullName,
        type: fileResponse.type,
        filePath: fileResponse.filePath,
        error: fileResponse.error,
      });
    } else {
      componentsDeployed.push(fileResponse.fullName);
    }
  }

  return {
    id: result.response.id,
    status: result.response.status,
    success: result.response.success,
    componentsDeployed,
    failures,
  };
}
