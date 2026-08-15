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

import type { XmlBuilderOptions } from 'fast-xml-builder';

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

/** Standardized XML builder options to keep generated metadata formatted like Salesforce CLI output. */
export const XML_BUILDER_OPTIONS: XmlBuilderOptions = {
  format: true,
  ignoreAttributes: false,
  suppressEmptyNode: true,
  indentBy: '    ',
};
