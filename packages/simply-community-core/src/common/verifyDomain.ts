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
import { escapeSoqlLiteral } from '@simplysf/simply-core';

/** One row of the `DomainSites` child relationship on `Domain`. */
type DomainSiteRecord = { Id: string; SiteId: string; PathPrefix: string | null };

/** The `Domain` fields the preflight query reads, plus its `DomainSites` children. */
type DomainRecord = {
  Id: string;
  Domain: string;
  DomainType: string | null;
  OptionsExternalHttps: boolean | null;
  CnameTarget: string | null;
  DomainSites?: { records: DomainSiteRecord[] };
};

export type DomainCheckStatus = 'found' | 'missing' | 'unavailable';

export type DomainCheckResult = {
  status: DomainCheckStatus;
  domainId?: string;
  /** `SiteId` of every `DomainSite` this domain is already bound to. Empty when unbound. */
  boundToSiteIds: string[];
};

/**
 * Check whether a custom domain is registered in the target org, and what it's already bound to.
 *
 * `Domain` and `DomainSite` are read-only but SOQL-queryable (API 26.0+); they aren't in the
 * source-deploy-retrieve metadata registry, so this is the only way to catch a typo'd or
 * unregistered domain before a deploy fails with a less specific Salesforce-side error.
 *
 * Deliberately pure over a connection and a domain string — it doesn't know which site the
 * caller intends to bind, so it can't itself decide whether `boundToSiteIds` is a problem. The
 * caller compares those ids against whatever site it resolved and decides what's fatal.
 *
 * A query failure (missing permission, API error) is reported as `'unavailable'` rather than
 * thrown, since an inability to run an advisory check isn't the same as the check failing.
 *
 * @param connection - The org connection to query against.
 * @param domain - The fully qualified custom domain to look up.
 * @returns Whether the domain was found, its Id, and the sites it's already bound to.
 */
export async function verifyDomain(connection: Connection, domain: string): Promise<DomainCheckResult> {
  try {
    const result = await connection.query<DomainRecord>(
      `SELECT Id, Domain, DomainType, OptionsExternalHttps, CnameTarget, (SELECT Id, SiteId, PathPrefix FROM DomainSites) FROM Domain WHERE Domain = '${escapeSoqlLiteral(domain)}'`,
    );
    const record = result.records[0];

    if (!record) {
      return { status: 'missing', boundToSiteIds: [] };
    }

    return {
      status: 'found',
      domainId: record.Id,
      boundToSiteIds: (record.DomainSites?.records ?? []).map((domainSite) => domainSite.SiteId),
    };
  } catch {
    return { status: 'unavailable', boundToSiteIds: [] };
  }
}
