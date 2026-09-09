/*
 * Copyright (c) 2026, SimplySF.
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

/**
 * The slice of a schema validator this module needs: anything with a `safeParse()` that returns
 * either the parsed value or an error carrying a message.
 *
 * Declared structurally rather than importing `zod` so `simply-core` stays free of a validation
 * dependency — every current caller passes a zod schema, which satisfies this as-is.
 */
export type ConfigSchema<T> = {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { message: string } };
};

/**
 * The outcome of validating a config file. Deliberately returned rather than thrown: each plugin
 * reports config problems through its own `messages.createError()` bundle, so the error text
 * stays with the command that owns it.
 */
export type JsonConfigResult<T> = { success: true; data: T } | { success: false; message: string };

/**
 * Parse a JSON string and validate it against a schema.
 *
 * @param raw - The raw JSON text to parse.
 * @param schema - The schema to validate the parsed value against.
 * @returns The validated value, or the validator's error message.
 * @throws {SyntaxError} If `raw` isn't valid JSON. Callers that want to report malformed JSON
 * differently from schema violations should catch this; the two failures are otherwise
 * indistinguishable to whoever wrote the file.
 */
export function parseJsonConfig<T>(raw: string, schema: ConfigSchema<T>): JsonConfigResult<T> {
  const parsed = schema.safeParse(JSON.parse(raw) as unknown);

  return parsed.success ? { success: true, data: parsed.data } : { success: false, message: parsed.error.message };
}

/**
 * Read a JSON config file and validate its contents against a schema.
 *
 * @param filePath - The file to read.
 * @param schema - The schema to validate the parsed contents against.
 * @returns The validated value, or the validator's error message.
 * @throws {SyntaxError} If the file isn't valid JSON.
 * @throws {NodeJS.ErrnoException} If the file can't be read.
 */
export async function loadJsonConfig<T>(filePath: string, schema: ConfigSchema<T>): Promise<JsonConfigResult<T>> {
  return parseJsonConfig(await fs.promises.readFile(filePath, 'utf-8'), schema);
}

/**
 * Synchronous {@link loadJsonConfig}, for callers already running outside an async context.
 *
 * @param filePath - The file to read.
 * @param schema - The schema to validate the parsed contents against.
 * @returns The validated value, or the validator's error message.
 * @throws {SyntaxError} If the file isn't valid JSON.
 * @throws {NodeJS.ErrnoException} If the file can't be read.
 */
export function loadJsonConfigSync<T>(filePath: string, schema: ConfigSchema<T>): JsonConfigResult<T> {
  return parseJsonConfig(fs.readFileSync(filePath, 'utf-8'), schema);
}
