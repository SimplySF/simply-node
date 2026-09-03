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

import { describe, it, expect } from 'vitest';
import { buildBranchRegex } from '../src/buildBranchRegex.js';

describe('buildBranchRegex', () => {
  it('returns the default regex when sfdevrc is undefined', () => {
    expect(buildBranchRegex(undefined)).toBe('^(feature|bugfix|devops|release)/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*');
  });

  it('returns the default regex when no branchRegex or JIRA keys are configured', () => {
    expect(buildBranchRegex({})).toBe('^(feature|bugfix|devops|release)/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*');
  });

  it('returns branchRegex verbatim when configured, ignoring JIRA keys', () => {
    expect(buildBranchRegex({ branchRegex: '^main$', jiraProjectKey: 'ABC' })).toBe('^main$');
  });

  it('builds a JIRA-keyed regex from jiraProjectKeys, folding each key into both cases', () => {
    const regex = buildBranchRegex({ jiraProjectKeys: ['ABC', 'Xyz'] });
    expect(regex).toBe(
      '^(bugfix\\/(ABC|abc|XYZ|xyz)|devops\\/|feature\\/(ABC|abc|XYZ|xyz)|hotfix\\/(ABC|abc|XYZ|xyz)|release\\/v[0-9]+\\.[0-9]+\\.[0-9]+)([A-Za-z0-9._-]+)*',
    );
  });

  it('merges jiraProjectKey and jiraProjectKeys without duplicates', () => {
    const regex = buildBranchRegex({ jiraProjectKey: 'abc', jiraProjectKeys: ['ABC', 'xyz'] });
    expect(regex).toBe(
      '^(bugfix\\/(ABC|abc|XYZ|xyz)|devops\\/|feature\\/(ABC|abc|XYZ|xyz)|hotfix\\/(ABC|abc|XYZ|xyz)|release\\/v[0-9]+\\.[0-9]+\\.[0-9]+)([A-Za-z0-9._-]+)*',
    );
  });
});
