/*
 * Copyright (c) 2026, Clay Chipps; Copyright (c) 2026 Salesforce, Inc.
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

/** A value that may arrive as a real boolean, or a stringified one (CSV/Excel input is always text). */
export type BoolLike = boolean | string | number | undefined;

/**
 * Converts a value to a boolean, preserving `undefined` for empty/missing input instead of
 * coercing it to `false`. Callers need to tell "explicitly FALSE" apart from "not specified" so
 * the XML builder can omit the tag entirely rather than writing out a literal `false`.
 *
 * @param value - The raw field value.
 * @returns The boolean value, or `undefined` if empty/missing.
 */
export function toBoolean(value: BoolLike): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
}

/**
 * Treats an empty string the same as `undefined`. CSV/Excel cells arrive as `''` rather than
 * `undefined` when blank, so a plain `??` fallback wouldn't catch them; use this before `??` (or
 * in place of `||`) wherever a blank cell should be treated as "not specified".
 *
 * @param value - The raw string field value.
 * @returns `value`, or `undefined` if it was blank/missing.
 */
export function blankToUndefined(value: string | undefined): string | undefined {
  return value === '' ? undefined : value;
}

/**
 * Standardized XML builder options to keep generated metadata formatted like Salesforce CLI
 * output. Deliberately untyped against fast-xml-builder's own option type: its package.json
 * "exports" serves different (and inconsistent) .d.ts files for its "import" vs "require"
 * conditions, and the "require" one doesn't declare a named `XmlBuilderOptions` export at all.
 * The `new XMLBuilder(XML_BUILDER_OPTIONS)` call site (which imports the constructor itself, not
 * a separate named type) still validates this object's shape.
 */
export const XML_BUILDER_OPTIONS = {
  format: true,
  ignoreAttributes: false,
  suppressEmptyNode: true,
  indentBy: '    ',
};
