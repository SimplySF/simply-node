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
// in a patch release. See docs/design/0031-simply-data-core.md for why this package is split out
// from `@simplysf/simply-data` (the CLI) rather than being one more relative import inside it.

export { REQUESTS_PER_UPLOAD, REQUESTS_PER_DOWNLOAD, QUERY_BATCH_SIZE, requestsForQuery } from './apiCost.js';
export {
  type ContentVersion,
  type ContentVersionCreateRequest,
  type ContentVersionCreateResult,
  type ContentVersionDownload,
  type ContentVersionToUpload,
} from './contentVersionTypes.js';
export { downloadContentVersion, uploadContentVersion } from './contentVersionUtils.js';
export { countCsvRows } from './countCsvRows.js';
export {
  createBoundary,
  escapeHeaderFilename,
  contentVersionMultipart,
  type ContentVersionMultipart,
} from './multipart.js';
