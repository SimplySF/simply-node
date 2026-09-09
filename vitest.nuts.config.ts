/*
 * Copyright (c) 2026, SimplySF.
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

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const packagesDir = fileURLToPath(new URL('./packages/', import.meta.url));
const setupFile = fileURLToPath(new URL('./vitest.setup.ts', import.meta.url));

// Built the same way as the unit-test projects in `vitest.config.ts`, and for the same two
// reasons: a bare `projects: ['packages/*']` glob gives each project neither the parent `test`
// config nor a predictable name, so `--project <package>` (which every package's `test:nuts`
// script passes) matches nothing. Explicit entries fix both, and resolve correctly regardless
// of which directory vitest was invoked from.
const packageProjects = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    test: {
      name: entry.name,
      root: fileURLToPath(new URL(`./packages/${entry.name}/`, import.meta.url)),
      // @salesforce/core/testSetup registers its stub/restore hooks against the
      // global beforeEach/afterEach, so vitest must expose test globals at runtime.
      globals: true,
      environment: 'node',
      include: ['test/**/*.nut.ts'],
      setupFiles: [setupFile],
      // NUTs create real scratch orgs and run commands against them, so they need much longer
      // allowances than the unit test config.
      testTimeout: 1_200_000,
      hookTimeout: 1_200_000,
    },
  }));

export default defineConfig({
  root: rootDir,
  test: {
    projects: packageProjects,
    maxWorkers: 5,
  },
});
