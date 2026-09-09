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
 * Create a directory (and any missing parents) if it doesn't already exist.
 *
 * Returns the directory it was given so it can wrap a flag default inline, e.g.
 * `const outputDir = ensureDirectory(flags['output-dir'] ?? '.')`.
 *
 * @param directoryPath - The directory to create if missing.
 * @returns `directoryPath`, unchanged.
 */
export function ensureDirectory(directoryPath: string): string {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  return directoryPath;
}

/**
 * Format a date as a `YYYYMMDD_HHMMSS` string in local time, for uniquing generated file and
 * directory names.
 *
 * Local time rather than UTC is deliberate: these names are read by whoever ran the command, so
 * they should line up with that person's clock.
 *
 * @param date - The date to format. Defaults to now.
 * @returns The formatted timestamp, e.g. `20260817_142530`.
 */
export function timestampForFileName(date: Date = new Date()): string {
  const pad = (value: number): string => value.toString().padStart(2, '0');

  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(
    date.getMinutes(),
  )}${pad(date.getSeconds())}`;
}
