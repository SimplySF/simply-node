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
    label?: string;
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

/** One field to serialize into a `<values>` block. `value: undefined` writes `xsi:nil="true"` rather than omitting the field, matching how a real CustomMetadata record explicitly nils an unset field instead of leaving it out. */
export type CustomMetadataValueInput = {
  field: string;
  value?: string;
  /** `xsi:type`'s suffix, matching how Salesforce serializes each Apex/schema type. Default `'string'`. */
  type?: 'string' | 'double' | 'boolean';
};

/** @returns `value` with the XML-significant characters a field/description could plausibly contain escaped; CustomMetadata field values are never markup, so only entity-breaking characters need escaping. */
function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** @returns `value` with regex-significant characters escaped, so it can be spliced into a `RegExp` source as a literal match. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @returns The `<value>` element markup for one entry — `entry.field` is ignored (the caller places it in `<field>` separately). Shared by `buildValuesXml` (a full document) and `patchCustomMetadataXml` (an in-place patch), so the two can never render an entry differently. */
function valueMarkup(entry: Pick<CustomMetadataValueInput, 'value' | 'type'>): string {
  return entry.value === undefined
    ? '<value xsi:nil="true"/>'
    : `<value xsi:type="xsd:${entry.type ?? 'string'}">${escapeXmlText(entry.value)}</value>`;
}

/** @returns The `<values>` blocks for `entries`, in the same shape `extractValues` parses back. */
export function buildValuesXml(entries: CustomMetadataValueInput[]): string {
  return entries
    .map(({ field, ...entry }) => `  <values><field>${field}</field>${valueMarkup(entry)}</values>`)
    .join('\n');
}

/** @returns A full `.md-meta.xml` document: header, `<label>`, `<protected>false</protected>`, then `valuesXml`. `label` is escaped the same as any other field value. */
export function buildCustomMetadataXml(label: string, valuesXml: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n' +
    `  <label>${escapeXmlText(label)}</label>\n` +
    '  <protected>false</protected>\n' +
    `${valuesXml}\n` +
    '</CustomMetadata>\n'
  );
}

/** @returns Only the entries in `after` whose `field`/`value`/`type` differ from `before`'s entry at the same position — `before`/`after` must come from the same deterministic entry-builder (same fields, same order) called on the existing vs. merged record, so a positional compare is safe. */
export function diffValueEntries(
  before: CustomMetadataValueInput[],
  after: CustomMetadataValueInput[],
): CustomMetadataValueInput[] {
  return after.filter((entry, index) => {
    const previous = before[index];
    return previous?.field !== entry.field || previous?.value !== entry.value || previous?.type !== entry.type;
  });
}

/** Thrown by `patchCustomMetadataXml` when an entry's `<values>` block exists but its `<value>` element isn't in a shape the patcher recognizes (self-closing or not, on one line or several) — the caller is expected to catch this and fall back to full-document generation for just that file. See docs/design/0022-at4dx-update-xml-shape-preservation.md. */
export class UnpatchableValueShapeError extends Error {
  public readonly field: string;

  public constructor(field: string) {
    super(`The <value> element for field "${field}" isn't in a shape this patcher recognizes.`);
    this.name = 'UnpatchableValueShapeError';
    this.field = field;
  }
}

/** @returns The leading whitespace an existing `<values>` line in `xml` uses, or `'  '` (this module's own convention) if `xml` has no `<values>` line to sample. */
function detectValuesIndent(xml: string): string {
  const match = /^([ \t]*)<values>/m.exec(xml);
  return match ? match[1] : '  ';
}

/** Matches one field's `<values>` block, split into the part before its `<value>` element (through the `<field>` marker and following whitespace), the `<value>` element itself, and the part after (through `</values>`) — a replace can then swap only the middle group. */
function valuesBlockRegex(field: string): RegExp {
  const escapedField = escapeRegExp(field);
  return new RegExp(
    `(<values>\\s*<field>${escapedField}</field>\\s*)(<value\\b[^>]*?(?:/>|>[\\s\\S]*?</value>))(\\s*</values>)`,
  );
}

/**
 * Patch an existing `.md-meta.xml` document's `<label>` and/or specific `<values>` entries in
 * place, touching only the spans that actually need to change — every other byte (untouched
 * fields' exact `<value>` markup, field order, indentation, comments, the XML declaration,
 * `<protected>`) passes through unmodified. The in-place counterpart to `buildCustomMetadataXml`,
 * used by `update*` (never `create*`, which has no existing document to preserve) when writing to
 * local source. See docs/design/0022-at4dx-update-xml-shape-preservation.md.
 *
 * @param existingXml - The file's current contents.
 * @param label - The label to write. Left untouched if it already matches (byte-for-byte, once escaped).
 * @param changedEntries - Only the entries whose value actually changed — see `diffValueEntries`. An
 * entry not in this list is never touched, even if `buildValuesXml` would render it identically to
 * what's already there.
 * @returns The patched document text.
 * @throws {UnpatchableValueShapeError} If an entry's `<values>` block exists but its `<value>`
 * element isn't in a shape this patcher recognizes.
 */
export function patchCustomMetadataXml(
  existingXml: string,
  label: string,
  changedEntries: CustomMetadataValueInput[],
): string {
  let xml = existingXml;

  const escapedLabel = escapeXmlText(label);
  const labelRegex = /(<label>)([\s\S]*?)(<\/label>)/;
  if (labelRegex.test(xml)) {
    xml = xml.replace(labelRegex, (match, open: string, current: string, close: string) =>
      current === escapedLabel ? match : `${open}${escapedLabel}${close}`,
    );
  } else {
    xml = xml.replace(/<CustomMetadata\b[^>]*>\s*/, (match) => `${match}  <label>${escapedLabel}</label>\n`);
  }

  for (const entry of changedEntries) {
    const escapedField = escapeRegExp(entry.field);
    const markerRegex = new RegExp(`<values>\\s*<field>${escapedField}</field>`);
    const blockRegex = valuesBlockRegex(entry.field);

    if (!markerRegex.test(xml)) {
      const indent = detectValuesIndent(xml);
      const newBlock = `${indent}<values><field>${entry.field}</field>${valueMarkup(entry)}</values>\n`;
      xml = xml.replace(/<\/CustomMetadata>/, `${newBlock}</CustomMetadata>`);
      continue;
    }

    if (!blockRegex.test(xml)) {
      throw new UnpatchableValueShapeError(entry.field);
    }

    xml = xml.replace(
      blockRegex,
      (_match, before: string, _valueEl: string, after: string) => `${before}${valueMarkup(entry)}${after}`,
    );
  }

  return xml;
}
