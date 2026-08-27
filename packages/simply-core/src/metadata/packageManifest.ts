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

import { XMLParser } from 'fast-xml-parser';

type RawPackageManifestType = {
  name: string;
  members?: string | string[];
};

type RawPackageManifestXml = {
  Package?: {
    types?: RawPackageManifestType | RawPackageManifestType[];
  };
};

/**
 * Read the `<members>` of a `<types>` block matching `typeName` out of a `package.xml`/
 * `destructiveChanges.xml`-shaped document.
 *
 * Both files share the same `<Package><types><name/><members/></types></Package>` shape, and
 * `fast-xml-parser` collapses a single `<types>` or `<members>` element to a bare object/string
 * rather than a one-element array — normalized here the same way `customMetadataXml.ts`'s
 * `extractValues` normalizes the analogous `<values>` shape for `CustomMetadata` XML.
 *
 * @param xmlContent - The manifest file's raw XML text.
 * @param typeName - The `<name>` to look up (e.g. `'Flow'`, `'PermissionSet'`).
 * @returns The matching type's members, or `[]` if `typeName` isn't present in the file at all —
 * matching how a destructive-changes-driven caller treats "nothing of this type" as a no-op, not
 * an error.
 */
export function readPackageManifestMembers(xmlContent: string, typeName: string): string[] {
  const parsed = new XMLParser().parse(xmlContent) as RawPackageManifestXml;

  const rawTypes = parsed.Package?.types;
  const types = rawTypes === undefined ? [] : Array.isArray(rawTypes) ? rawTypes : [rawTypes];

  const members: string[] = [];
  for (const type of types) {
    if (type.name !== typeName) {
      continue;
    }
    if (type.members === undefined) {
      continue;
    }
    members.push(...(Array.isArray(type.members) ? type.members : [type.members]));
  }

  return members;
}
