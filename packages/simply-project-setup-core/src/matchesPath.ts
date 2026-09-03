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

import { minimatch } from 'minimatch';

/**
 * `true` if `relativePath` matches any of `patterns` (glob syntax, `dot: true` so a pattern like
 * `.myrc.json` matches a dotfile without an explicit leading-dot escape). Used to match
 * `protectedFiles`/`jsonMergeFiles`/`regexCustomizations` entries against a resolved relative
 * destination path — not a filesystem glob against files that already exist on disk (that's
 * `banned`, via `glob`'s `globSync`).
 */
export function matchesAny(relativePath: string, patterns: string[]): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return patterns.some((pattern) => minimatch(normalized, pattern, { dot: true }));
}
