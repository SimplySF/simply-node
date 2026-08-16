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

import { GitLabProvider } from './gitlab.js';
import type { VcsProvider, VcsProviderKind } from './types.js';

/** Builds a `VcsProvider` for the given platform. Only `gitlab` is implemented today. */
export function getVcsProvider(kind: VcsProviderKind, apiUrl: string, token: string): VcsProvider {
  switch (kind) {
    case 'gitlab':
      return new GitLabProvider(apiUrl, token);
    default:
      throw new Error(`VCS provider "${kind as string}" is not yet supported.`);
  }
}

export type {
  VcsBranch,
  VcsCommit,
  VcsMergeRequest,
  VcsProject,
  VcsProjectVariable,
  VcsProvider,
  VcsProviderKind,
} from './types.js';
