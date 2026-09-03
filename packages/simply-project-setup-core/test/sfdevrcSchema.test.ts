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
import { sfdevrcSchema } from '../src/sfdevrcSchema.js';

describe('sfdevrcSchema', () => {
  it('accepts an empty object — every field is optional', () => {
    expect(sfdevrcSchema.safeParse({}).success).toBe(true);
  });

  it('accepts the full field set', () => {
    const result = sfdevrcSchema.safeParse({
      $schema: 'https://example.com/schema.json',
      gitlabProjectId: '123',
      jiraProjectKey: 'ABC',
      jiraProjectKeys: ['ABC', 'XYZ'],
      branchRegex: '^main$',
      deploymentPlugins: ['sfdmu'],
      setup: { include: ['core'], exclude: ['jest'] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown top-level field', () => {
    expect(sfdevrcSchema.safeParse({ notAField: true }).success).toBe(false);
  });

  it('rejects a wrong type for a known field', () => {
    expect(sfdevrcSchema.safeParse({ jiraProjectKeys: 'ABC' }).success).toBe(false);
  });
});
