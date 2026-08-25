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

import type { Connection } from '@salesforce/core';

/**
 * The subset of `@salesforce/core`'s `Connection` the org-scan functions actually call. Accepting
 * this instead of the full `Connection` class lets a consumer with its own `@salesforce/core`
 * install (a different major version, even) pass in a connection without needing an exact version
 * match — anything structurally compatible works.
 */
export type AepConnection = Pick<Connection, 'autoFetchQuery' | 'getUsername'>;

/** The four AT4DX Application Factory binding types this command reads. */
export type BindingType = 'Service' | 'Selector' | 'Domain' | 'UnitOfWork';

export const ALL_BINDING_TYPES: BindingType[] = ['Service', 'Selector', 'Domain', 'UnitOfWork'];

/** The `--type` flag's CLI-facing spelling for each binding type. */
export type BindingTypeFlag = 'service' | 'selector' | 'domain' | 'unit-of-work';

export const BINDING_TYPE_BY_FLAG: Record<BindingTypeFlag, BindingType> = {
  service: 'Service',
  selector: 'Selector',
  domain: 'Domain',
  'unit-of-work': 'UnitOfWork',
};

/**
 * The Custom Metadata Type API name AT4DX stores each binding type's records in.
 *
 * This is the single source of truth `at4dxOrgScan`, `at4dxLocalScan`, and `at4dxResolve` all key
 * off of, so the four binding types can't drift out of sync with each other.
 */
export const AT4DX_BINDING_OBJECTS: Record<BindingType, string> = {
  Service: 'ApplicationFactory_ServiceBinding__mdt',
  Selector: 'ApplicationFactory_SelectorBinding__mdt',
  Domain: 'ApplicationFactory_DomainBinding__mdt',
  UnitOfWork: 'ApplicationFactory_UnitOfWorkBinding__mdt',
};

/**
 * The local-source component name AT4DX's Custom Metadata Type records use — the CMDT API name
 * without its `__mdt` suffix, e.g. `ApplicationFactory_ServiceBinding.CampaignSObjectBinding` is a
 * `CustomMetadata` component named `ApplicationFactory_ServiceBinding.<record>`.
 */
export const AT4DX_BINDING_LOCAL_OBJECT_NAMES: Record<BindingType, string> = {
  Service: 'ApplicationFactory_ServiceBinding',
  Selector: 'ApplicationFactory_SelectorBinding',
  Domain: 'ApplicationFactory_DomainBinding',
  UnitOfWork: 'ApplicationFactory_UnitOfWorkBinding',
};

/** @returns The binding type whose local object name is `localObjectName`, or `undefined` if none matches. */
export function bindingTypeForLocalObjectName(localObjectName: string): BindingType | undefined {
  return ALL_BINDING_TYPES.find((type) => AT4DX_BINDING_LOCAL_OBJECT_NAMES[type] === localObjectName);
}

/**
 * One binding record, normalized from either an org query or local source, before resolution.
 *
 * `key` is the interface name (Service) or SObject API name (Selector/Domain/UnitOfWork) the
 * binding resolves for. `to` is the implementing Apex class — absent for UnitOfWork, which has no
 * `To__c` field (see `at4dxResolve` for why).
 */
export type RawBindingRecord = {
  bindingType: BindingType;
  developerName: string;
  key: string;
  to?: string;
  priority?: number;
  sequence?: number;
  /** Local package directory name, or the org username when read from `--target-org`. */
  source: string;
};

/** A `RawBindingRecord` annotated with the resolution outcome `at4dxResolve` computed for it. */
export type At4dxBindingRow = RawBindingRecord & {
  /** Whether this row is the one AT4DX actually resolves to for its key. Always `true` for UnitOfWork. */
  effective: boolean;
  /** Domain only: `true` when >1 row shares this key and AT4DX doesn't guarantee which one wins. */
  ambiguous?: boolean;
};

export type At4dxBindingListResult = {
  source: string;
  bindings: At4dxBindingRow[];
};
