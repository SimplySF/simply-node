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

import fs from 'node:fs';
import path from 'node:path';
import { ComponentSet, type SourceComponent } from '@salesforce/source-deploy-retrieve';
import { parseTriggerHandlerClasses, parseTriggerSObject, type RawApexTriggerRecord } from './at4dxApexTriggerTypes.js';

/** Minimal shape of a parsed `.trigger-meta.xml` document — only the one field this scan reads. */
type ApexTriggerXml = {
  ApexTrigger?: {
    status?: string;
  };
};

/** @returns The source-format package/project directory name a trigger file belongs to (the directory containing `triggers`), the same convention `at4dxLocalScan.ts` uses for `customMetadata`. */
function deriveProjectName(filePath: string | undefined): string {
  if (!filePath) {
    return 'local';
  }
  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.indexOf('/triggers/');
  if (index === -1) {
    return 'local';
  }
  return path.basename(normalized.slice(0, index));
}

/**
 * Scan local Salesforce DX source directories for Apex triggers, reading each `.trigger` file's body
 * directly to recover its target SObject and any `fflib_SObjectDomain.triggerHandler(...)` calls it
 * makes — the data `missing-domain-trigger` (`at4dxValidate.ts`) needs. See
 * docs/design/0036-at4dx-domain-binding-trigger-validate.md.
 *
 * A trigger whose body doesn't parse as `trigger X on Y (...)` at all (corrupt/unreadable source) is
 * silently skipped — the same "can't identify it, so it doesn't count" treatment `at4dxLocalScan.ts`
 * gives a `CustomMetadata` component it can't derive a `DeveloperName` from.
 *
 * @param sourceDirs - The source directories to scan.
 * @returns Every Apex trigger found, normalized.
 */
export function scanLocalApexTriggers(sourceDirs: string[]): RawApexTriggerRecord[] {
  const records: RawApexTriggerRecord[] = [];

  const components = ComponentSet.fromSource(sourceDirs);

  for (const rawComponent of components) {
    const component = rawComponent as SourceComponent;
    if (component.type.id !== 'apextrigger' || !component.content) {
      continue;
    }

    const body = fs.readFileSync(component.content, 'utf-8');
    const sobject = parseTriggerSObject(body);
    if (!sobject) {
      continue;
    }

    let active = true;
    if (component.xml) {
      const xml = component.parseXmlSync<ApexTriggerXml>();
      active = (xml.ApexTrigger?.status ?? 'Active') !== 'Inactive';
    }

    records.push({
      name: component.name,
      sobject,
      triggerHandlerClasses: parseTriggerHandlerClasses(body),
      active,
      source: deriveProjectName(component.content),
      filePath: component.content,
    });
  }

  return records;
}
