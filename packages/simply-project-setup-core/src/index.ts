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

// Everything exported from this file is this package's public API and is semver-covered: adding an
// export is a minor/patch change, but removing or renaming one is breaking. `test/index.test.ts`
// pins the exported-key list down so an accidental removal fails a test instead of silently shipping
// in a patch release. See docs/design/0035-simply-project-setup-core.md for why this package has no
// built-in templates/presets (a consumer's own concern) but does own the `.sfdevrc.json` spec and
// validation (this package's one deliberate opinion).

export { resolveSetupConfig } from './resolveSetupConfig.js';
export { standardizeFiles } from './standardizeFiles.js';
export { standardizePackageJson } from './standardizePackageJson.js';
export { writeDependencies } from './writeDependencies.js';
export { PackageJson, type PackageJsonContents } from './packageJson.js';
export { sfdevrcSchema, type Sfdevrc } from './sfdevrcSchema.js';
export { loadSfdevrc, findSfdevrcPath } from './loadSfdevrc.js';
export { buildBranchRegex } from './buildBranchRegex.js';
export { exists } from './exists.js';
export { loadRootPath } from './loadRootPath.js';
export { log } from './log.js';
export { orderMap } from './orderMap.js';
export { semverIsLessThan } from './semver.js';
export type {
  SetupConfig,
  SetupFlags,
  ResolveSetupConfigOptions,
  FileAction,
  TransformFileContext,
  StandardizeFilesOptions,
  PackageJsonDefaults,
  StandardizePackageJsonOptions,
  WriteDependenciesOptions,
} from './types.js';
