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

/** One `<values><field>.../field><value>.../value></values>` entry from a `CustomMetadata` record's parsed XML. */
export type RawMetadataValue = {
  field: string;
  value?: {
    '#text'?: string;
    '@_xsi:nil'?: string;
  };
};

export type CustomMetadataXml = {
  CustomMetadata?: {
    // A single `<values>` element parses as a bare object; more than one parses as an array.
    values?: RawMetadataValue | RawMetadataValue[];
  };
};

/** @returns The plain-text value for `field` in `values`, or `undefined` if the field is absent or explicitly nil. */
export function fieldValue(values: RawMetadataValue[], field: string): string | undefined {
  const entry = values.find((value) => value.field === field);
  if (!entry?.value || entry.value['@_xsi:nil'] === 'true') {
    return undefined;
  }
  return entry.value['#text'];
}

/** @returns `value` parsed as a number, or `undefined` if `value` is absent or not numeric. */
export function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** @returns `value` parsed as a boolean (`"true"`/`"false"` as Salesforce serializes Checkbox fields), or `defaultValue` if `value` is absent. */
export function toBoolean(value: string | undefined, defaultValue: boolean): boolean {
  return value === undefined ? defaultValue : value === 'true';
}

/** @returns The `values` array from a parsed `CustomMetadata` component's XML, normalizing the single-vs-array shape `fast-xml-parser` produces. */
export function extractValues(xml: CustomMetadataXml): RawMetadataValue[] {
  const rawValues = xml.CustomMetadata?.values;
  return rawValues === undefined ? [] : Array.isArray(rawValues) ? rawValues : [rawValues];
}
