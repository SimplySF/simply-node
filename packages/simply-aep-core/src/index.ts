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
// in a patch release. See docs/design/0009-aep-library-consumption.md for why this package is split
// out from `@simplysf/simply-aep` (the CLI) rather than being one more relative import inside it.

export {
  ALL_BINDING_TYPES,
  AT4DX_BINDING_OBJECTS,
  AT4DX_BINDING_LOCAL_OBJECT_NAMES,
  BINDING_TYPE_BY_FLAG,
  bindingTypeForLocalObjectName,
  type AepConnection,
  type At4dxBindingListResult,
  type At4dxBindingRow,
  type BindingType,
  type BindingTypeFlag,
  type RawBindingRecord,
} from './at4dxBindingTypes.js';
export { scanLocalBindings } from './at4dxLocalScan.js';
export { scanOrgBindings, type OrgScanResult } from './at4dxOrgScan.js';
export { resolveBindings } from './at4dxResolve.js';
export {
  ALL_TRIGGER_OPERATIONS,
  DOMAIN_PROCESS_BINDING_OBJECT,
  DOMAIN_PROCESS_BINDING_LOCAL_OBJECT_NAME,
  type At4dxDomainProcessBindingListResult,
  type DomainProcessBindingRow,
  type DomainProcessType,
  type ProcessContext,
  type RawDomainProcessBindingRecord,
  type TriggerOperation,
} from './at4dxDomainProcessBindingTypes.js';
export { scanLocalDomainProcessBindings } from './at4dxDomainProcessLocalScan.js';
export { scanOrgDomainProcessBindings, type DomainProcessOrgScanResult } from './at4dxDomainProcessOrgScan.js';
export { resolveDomainProcessBindings } from './at4dxDomainProcessResolve.js';
