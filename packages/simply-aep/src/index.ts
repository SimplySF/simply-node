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

// Unlike other `simply-*` command packages, this barrel isn't an empty oclif-plugin stub — the
// binding scan/resolve logic is meant to be consumed directly by a future VS Code extension, not
// just by this package's own command. See docs/design/0007-at4dx-binding-list.md's "Decision"
// section for why.

export {
  ALL_BINDING_TYPES,
  AT4DX_BINDING_OBJECTS,
  AT4DX_BINDING_LOCAL_OBJECT_NAMES,
  BINDING_TYPE_BY_FLAG,
  bindingTypeForLocalObjectName,
  type At4dxBindingListResult,
  type At4dxBindingRow,
  type BindingType,
  type BindingTypeFlag,
  type RawBindingRecord,
} from './common/at4dxBindingTypes.js';
export { scanLocalBindings } from './common/at4dxLocalScan.js';
export { scanOrgBindings, type OrgScanResult } from './common/at4dxOrgScan.js';
export { resolveBindings } from './common/at4dxResolve.js';
