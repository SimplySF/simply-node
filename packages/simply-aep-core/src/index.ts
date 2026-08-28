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
  DOMAIN_PROCESS_BINDING_RULES,
  ENTITY_DEFINITION_STANDARD_OBJECTS,
  isCustomObjectApiName,
  DomainProcessBindingWriteError,
  type AmbiguousDomainProcessBindingRecord,
  type At4dxDomainProcessBindingCreateResult,
  type At4dxDomainProcessBindingListResult,
  type At4dxDomainProcessBindingSetResult,
  type At4dxDomainProcessBindingValidateResult,
  type At4dxDomainProcessBindingWriteResult,
  type CreateDomainProcessBindingInput,
  type CreateDomainProcessBindingTarget,
  type DomainProcessBindingFieldsInput,
  type DomainProcessBindingIssue,
  type DomainProcessBindingIssueRule,
  type DomainProcessBindingIssueScope,
  type DomainProcessBindingIssueSeverity,
  type DomainProcessBindingRow,
  type DomainProcessBindingRuleInfo,
  type DomainProcessBindingSObjectField,
  type DomainProcessBindingWriteErrorCode,
  type DomainProcessType,
  type MalformedDomainProcessBindingRecord,
  type ProcessContext,
  type RawDomainProcessBindingRecord,
  type SetDomainProcessBindingInput,
  type SetDomainProcessBindingTarget,
  type TriggerOperation,
} from './at4dxDomainProcessBindingTypes.js';
export { buildDomainProcessBindingXml, type DomainProcessBindingXmlFields } from './at4dxDomainProcessBuildXml.js';
export {
  deployMetadataFile,
  type DeployComponentFailure,
  type DeployMetadataFileResult,
} from './at4dxDomainProcessDeploy.js';
export { scanLocalDomainProcessBindings, type DomainProcessLocalScanResult } from './at4dxDomainProcessLocalScan.js';
export { scanOrgDomainProcessBindings, type DomainProcessOrgScanResult } from './at4dxDomainProcessOrgScan.js';
export {
  filterDomainProcessBindingIssues,
  resolveDomainProcessBindings,
  validateDomainProcessBindings,
} from './at4dxDomainProcessResolve.js';
export { createDomainProcessBinding, setDomainProcessBinding } from './at4dxDomainProcessWrite.js';
