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

import type { AepConnection } from './at4dxBindingTypes.js';
import { parseTriggerHandlerClasses, parseTriggerSObject, type RawApexTriggerRecord } from './at4dxApexTriggerTypes.js';

type OrgApexTriggerRecord = {
  Name: string;
  Body: string;
  Status: string;
};

/** `ApexTrigger` is Tooling-API-only — it isn't queryable through the standard REST API at all. */
const SOQL = 'SELECT Name, Body, Status FROM ApexTrigger';

/**
 * Query the target org for every Apex trigger, parsing each `Body` the same way
 * `scanLocalApexTriggers` parses a `.trigger` file — for its target SObject and any
 * `fflib_SObjectDomain.triggerHandler(...)` calls. See
 * docs/design/0036-at4dx-domain-binding-trigger-validate.md.
 *
 * A trigger whose `Body` doesn't parse as `trigger X on Y (...)` at all is skipped, matching
 * `scanLocalApexTriggers`.
 *
 * @param connection - The org connection to query against.
 * @returns Every Apex trigger found, normalized.
 */
export async function scanOrgApexTriggers(connection: AepConnection): Promise<RawApexTriggerRecord[]> {
  const source = connection.getUsername() ?? 'org';

  const result = await connection.autoFetchQuery(SOQL, { tooling: true });
  const records: RawApexTriggerRecord[] = [];

  for (const record of result.records as unknown as OrgApexTriggerRecord[]) {
    const sobject = parseTriggerSObject(record.Body);
    if (!sobject) {
      continue;
    }

    records.push({
      name: record.Name,
      sobject,
      triggerHandlerClasses: parseTriggerHandlerClasses(record.Body),
      active: record.Status !== 'Inactive',
      source,
    });
  }

  return records;
}
