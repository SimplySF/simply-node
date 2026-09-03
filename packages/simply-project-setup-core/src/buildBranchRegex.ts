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

import { Sfdevrc } from './sfdevrcSchema.js';

const DEFAULT_BRANCH_REGEX = '^(feature|bugfix|devops|release)/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*';

/**
 * Derives a branch-naming validation regex from a project's `.sfdevrc.json`: `branchRegex` wins
 * outright if set; otherwise `jiraProjectKey`/`jiraProjectKeys` (merged, deduped, each key folded
 * into both cases) build a JIRA-keyed regex; with neither set, `DEFAULT_BRANCH_REGEX`. Meant to
 * feed a `standardizeFiles` `transformFile` hook templating a branch-name check into a copied Git
 * hook — see this package's README.
 */
export function buildBranchRegex(sfdevrc: Sfdevrc | undefined): string {
  if (!sfdevrc) {
    return DEFAULT_BRANCH_REGEX;
  }

  if (sfdevrc.branchRegex) {
    return sfdevrc.branchRegex;
  }

  const jiraKeys: string[] = [];
  if (sfdevrc.jiraProjectKey) {
    jiraKeys.push(sfdevrc.jiraProjectKey);
  }
  if (sfdevrc.jiraProjectKeys) {
    jiraKeys.push(...sfdevrc.jiraProjectKeys);
  }

  if (jiraKeys.length === 0) {
    return DEFAULT_BRANCH_REGEX;
  }

  const uniqueKeys = Array.from(new Set(jiraKeys.flatMap((key) => [key.toUpperCase(), key.toLowerCase()]))).sort(
    (a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      if (aLower !== bLower) {
        return aLower.localeCompare(bLower);
      }
      return a < b ? -1 : 1;
    },
  );
  const keysStr = uniqueKeys.join('|');
  return `^(bugfix\\/(${keysStr})|devops\\/|feature\\/(${keysStr})|hotfix\\/(${keysStr})|release\\/v[0-9]+\\.[0-9]+\\.[0-9]+)([A-Za-z0-9._-]+)*`;
}
