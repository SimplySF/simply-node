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

/**
 * Standard objects known to satisfy EntityDefinition's Metadata Relationship eligibility rule, per
 * Salesforce's Custom Metadata Types Implementation Guide ("Custom Metadata Relationships"): supports
 * custom fields, supports Apex triggers, supports custom layouts, isn't an activity object (`Task`/
 * `Event`), isn't `User`, isn't a Trialforce object. Salesforce doesn't publish a single canonical,
 * current list of which standard objects satisfy that rule, and it isn't fixed across releases, so this
 * is a best-effort baseline, not an authoritative table — extend it as a real binding confirms an object
 * works, or as a consuming rule false-positives on one that does. See
 * docs/design/0014-domain-process-binding-entity-definition-eligibility.md.
 *
 * Custom objects are never checked against this list — see `isCustomObjectApiName` — since a custom
 * object always satisfies the rule.
 *
 * Shared across every `MetadataRelationship`-to-`EntityDefinition` field this package validates:
 * `DomainProcessBinding__mdt`'s `RelatedDomainBindingSObject__c` (0014),
 * `ApplicationFactory_{Selector,Domain}Binding__mdt`'s `BindingSObject__c`
 * (docs/design/0015-at4dx-binding-validate-create-set.md), and
 * `SelectorConfig_FieldSetInclusion__mdt`'s `BindingSObject__c`
 * (docs/design/0016-at4dx-selector-config-field-set-inclusion.md).
 */
export const ENTITY_DEFINITION_STANDARD_OBJECTS: ReadonlySet<string> = new Set([
  'Account',
  'Asset',
  'Campaign',
  'CampaignMember',
  'Case',
  'Contact',
  'Contract',
  'ContractLineItem',
  'Entitlement',
  'Lead',
  'Opportunity',
  'OpportunityContactRole',
  'OpportunityLineItem',
  'Order',
  'OrderItem',
  'Pricebook2',
  'PricebookEntry',
  'Product2',
  'Quote',
  'QuoteLineItem',
  'ServiceContract',
  'Solution',
  'WorkOrder',
  'WorkOrderLineItem',
  'WorkType',
]);

/**
 * True when `apiName` is a custom (optionally namespaced) object. Salesforce reserves `__` in a standard
 * object's API name for exactly this suffix (`__c`, a namespace prefix, a platform event's `__e`, a
 * big/external object's `__b`/`__x`), so any object whose API name contains it always satisfies
 * EntityDefinition's Metadata Relationship eligibility rule on its own, without consulting
 * `ENTITY_DEFINITION_STANDARD_OBJECTS`.
 */
export function isCustomObjectApiName(apiName: string): boolean {
  return apiName.includes('__');
}
