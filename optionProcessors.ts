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

/**
 * Converts a string or boolean to a boolean. Handles `'true'`/`'false'` strings
 * (case/whitespace-insensitive); anything else coerces to `false`. Used to resolve boolean
 * environment-variable fallbacks (env vars are always strings, unlike CLI boolean flags, which
 * oclif already parses natively).
 */
export function parseBooleanString(value: string | boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  const lower = value.trim().toLowerCase();
  if (lower === 'true') {
    return true;
  } else if (lower === 'false') {
    return false;
  }

  return false;
}
