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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRootPath } from './loadRootPath.js';
import { Sfdevrc, sfdevrcSchema } from './sfdevrcSchema.js';

const SFDEVRC_FILENAME = '.sfdevrc.json';

/** Walks up from `cwd` (default `process.cwd()`) for the nearest `.sfdevrc.json`. `undefined` if none is found. */
export function findSfdevrcPath(cwd?: string): string | undefined {
  try {
    return join(loadRootPath(SFDEVRC_FILENAME, cwd), SFDEVRC_FILENAME);
  } catch {
    return undefined;
  }
}

/**
 * Finds, reads, and validates the nearest `.sfdevrc.json`. Returns `undefined` when no file is
 * found (a project without one is valid — every field is optional). Throws when a file is found
 * but isn't valid JSON, or doesn't satisfy `sfdevrcSchema` — a malformed config file is always a
 * mistake worth surfacing, never something to silently fall back from.
 */
export function loadSfdevrc(cwd?: string): Sfdevrc | undefined {
  const sfdevrcPath = findSfdevrcPath(cwd);
  if (!sfdevrcPath) {
    return undefined;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(sfdevrcPath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse ${sfdevrcPath}: ${(error as Error).message}`, { cause: error });
  }

  const result = sfdevrcSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid ${sfdevrcPath}: ${result.error.message}`);
  }
  return result.data;
}
