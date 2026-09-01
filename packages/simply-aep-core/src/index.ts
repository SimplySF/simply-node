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
  ALL_WRITABLE_BINDING_TYPES,
  AT4DX_BINDING_OBJECTS,
  AT4DX_BINDING_LOCAL_OBJECT_NAMES,
  BINDING_TYPE_BY_FLAG,
  BINDING_RULES,
  WRITABLE_BINDING_TYPE_BY_FLAG,
  bindingTypeForLocalObjectName,
  BindingWriteError,
  type AepConnection,
  type AmbiguousBindingRecord,
  type At4dxBindingCreateResult,
  type At4dxBindingListResult,
  type At4dxBindingRow,
  type At4dxBindingUpdateResult,
  type At4dxBindingValidateResult,
  type At4dxBindingWriteResult,
  type BindingFieldsInput,
  type BindingIssue,
  type BindingIssueRule,
  type BindingIssueScope,
  type BindingIssueSeverity,
  type BindingKeyField,
  type BindingRuleInfo,
  type BindingType,
  type BindingTypeFlag,
  type BindingWriteErrorCode,
  type CreateBindingInput,
  type CreateBindingTarget,
  type MalformedBindingRecord,
  type RawBindingRecord,
  type UpdateBindingInput,
  type UpdateBindingTarget,
  type WritableBindingType,
  type WritableBindingTypeFlag,
} from './at4dxBindingTypes.js';
export { buildBindingXml, type BindingXmlFields } from './at4dxBuildXml.js';
export { scanLocalBindings, type LocalScanResult } from './at4dxLocalScan.js';
export { scanOrgBindings, type OrgScanResult } from './at4dxOrgScan.js';
export { resolveBindings } from './at4dxResolve.js';
export { validateBindings } from './at4dxValidate.js';
export { createBinding, updateBinding } from './at4dxWrite.js';
export { ENTITY_DEFINITION_STANDARD_OBJECTS, isCustomObjectApiName } from './entityDefinitionEligibility.js';
export {
  ALL_TRIGGER_OPERATIONS,
  DOMAIN_PROCESS_BINDING_OBJECT,
  DOMAIN_PROCESS_BINDING_LOCAL_OBJECT_NAME,
  DOMAIN_PROCESS_BINDING_RULES,
  DomainProcessBindingWriteError,
  type AmbiguousDomainProcessBindingRecord,
  type At4dxDomainProcessBindingCreateResult,
  type At4dxDomainProcessBindingListResult,
  type At4dxDomainProcessBindingUpdateResult,
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
  type TriggerOperation,
  type UpdateDomainProcessBindingInput,
  type UpdateDomainProcessBindingTarget,
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
export { createDomainProcessBinding, updateDomainProcessBinding } from './at4dxDomainProcessWrite.js';
export {
  FIELD_SET_INCLUSION_OBJECT,
  FIELD_SET_INCLUSION_LOCAL_OBJECT_NAME,
  FIELD_SET_INCLUSION_RULES,
  FieldSetInclusionWriteError,
  type AmbiguousFieldSetInclusionRecord,
  type At4dxFieldSetInclusionCreateResult,
  type At4dxFieldSetInclusionListResult,
  type At4dxFieldSetInclusionUpdateResult,
  type At4dxFieldSetInclusionValidateResult,
  type At4dxFieldSetInclusionWriteResult,
  type CreateFieldSetInclusionInput,
  type CreateFieldSetInclusionTarget,
  type FieldSetInclusionFieldsInput,
  type FieldSetInclusionIssue,
  type FieldSetInclusionIssueRule,
  type FieldSetInclusionIssueScope,
  type FieldSetInclusionIssueSeverity,
  type FieldSetInclusionRuleInfo,
  type FieldSetInclusionSObjectField,
  type FieldSetInclusionWriteErrorCode,
  type MalformedFieldSetInclusionRecord,
  type RawFieldSetInclusionRecord,
  type UpdateFieldSetInclusionInput,
  type UpdateFieldSetInclusionTarget,
} from './at4dxFieldSetInclusionTypes.js';
export { buildFieldSetInclusionXml, type FieldSetInclusionXmlFields } from './at4dxFieldSetInclusionBuildXml.js';
export {
  scanLocalFieldSetInclusions,
  type FieldSetInclusionLocalScanResult,
} from './at4dxFieldSetInclusionLocalScan.js';
export { scanOrgFieldSetInclusions, type FieldSetInclusionOrgScanResult } from './at4dxFieldSetInclusionOrgScan.js';
export { validateFieldSetInclusions } from './at4dxFieldSetInclusionResolve.js';
export { createFieldSetInclusion, updateFieldSetInclusion } from './at4dxFieldSetInclusionWrite.js';

// AT4DX Platform Event Subscription (docs/design/0025) — Stage 1 (read): Types, LocalScan, OrgScan,
// and validatePlatformEventSubscriptions. Stage 3 (write) lands here too: BuildXml, Write, and the
// CreatePlatformEventSubscription*/UpdatePlatformEventSubscription* types. The simulator
// (resolvePlatformEventDistribution, Stage 2) lands in a separate PR — see 0025's Implementation plan.
export {
  ALL_MATCHER_RULES,
  PLATFORM_EVENT_SUBSCRIPTION_OBJECT,
  PLATFORM_EVENT_SUBSCRIPTION_LOCAL_OBJECT_NAME,
  PLATFORM_EVENT_SUBSCRIPTION_RULES,
  PlatformEventSubscriptionWriteError,
  type MatcherRule,
  type RawPlatformEventSubscriptionRecord,
  type MalformedPlatformEventSubscriptionRecord,
  type PlatformEventSubscriptionIssue,
  type PlatformEventSubscriptionIssueRule,
  type PlatformEventSubscriptionIssueScope,
  type PlatformEventSubscriptionIssueSeverity,
  type PlatformEventSubscriptionRuleInfo,
  type PlatformEventSubscriptionFieldsInput,
  type CreatePlatformEventSubscriptionInput,
  type CreatePlatformEventSubscriptionTarget,
  type UpdatePlatformEventSubscriptionInput,
  type UpdatePlatformEventSubscriptionTarget,
  type PlatformEventSubscriptionWriteErrorCode,
  type At4dxPlatformEventSubscriptionListResult,
  type At4dxPlatformEventSubscriptionValidateResult,
  type At4dxPlatformEventSubscriptionWriteResult,
  type At4dxPlatformEventSubscriptionCreateResult,
  type At4dxPlatformEventSubscriptionUpdateResult,
} from './at4dxPlatformEventSubscriptionTypes.js';
export {
  buildPlatformEventSubscriptionXml,
  type PlatformEventSubscriptionXmlFields,
} from './at4dxPlatformEventSubscriptionBuildXml.js';
export {
  scanLocalPlatformEventSubscriptions,
  type PlatformEventSubscriptionLocalScanResult,
} from './at4dxPlatformEventSubscriptionLocalScan.js';
export {
  scanOrgPlatformEventSubscriptions,
  type PlatformEventSubscriptionOrgScanResult,
} from './at4dxPlatformEventSubscriptionOrgScan.js';
export { validatePlatformEventSubscriptions, type EventBusFields } from './at4dxPlatformEventSubscriptionResolve.js';
export {
  createPlatformEventSubscription,
  updatePlatformEventSubscription,
} from './at4dxPlatformEventSubscriptionWrite.js';
