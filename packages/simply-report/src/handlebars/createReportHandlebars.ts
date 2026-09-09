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

import Handlebars from 'handlebars';

/**
 * Create a Handlebars environment for a report, with the helpers every report wants.
 *
 * Each report gets its own instance rather than sharing one, so registering a partial in one
 * can't leak into another. What's shared is the setup: currently the `eq` helper, which reports
 * use to branch on a value inside a template.
 *
 * Handlebars auto-escapes `{{expression}}` (unlike `{{{expression}}}`), so templates compiled
 * here don't need a hand-rolled `escapeHtml()` on interpolated org data.
 *
 * @returns A fresh Handlebars environment.
 */
export function createReportHandlebars(): typeof Handlebars {
  const handlebars = Handlebars.create();

  handlebars.registerHelper('eq', (a: unknown, b: unknown): boolean => a === b);

  return handlebars;
}
