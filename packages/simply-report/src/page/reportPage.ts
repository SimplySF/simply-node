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

/** Default page width. Reports with a wide table or diagram pass their own. */
const DEFAULT_MAX_WIDTH = '1200px';

/**
 * The rules every generated report shares: the page frame and its heading.
 *
 * Kept as literal CSS rather than custom properties so the emitted stylesheet stays byte-identical
 * to what these reports have always produced — these are files people keep, and a restyling is a
 * decision to make on purpose, not a side effect of sharing the code.
 *
 * @param maxWidth - The page's `max-width`.
 * @returns The base rules, indented two spaces.
 */
function baseCss(maxWidth: string): string {
  return [
    `  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: ${maxWidth}; margin: 0 auto; padding: 20px; background-color: #f4f7f6; }`,
    '  h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }',
  ].join('\n');
}

/** The collapsible package-section block, shared by the reports that group their rows by package. */
export const COLLAPSIBLE_SECTION_CSS = [
  '  .package-section { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; padding: 15px; }',
  '  details { margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; }',
  '  summary { padding: 12px; cursor: pointer; font-weight: bold; background: #eee; outline: none; }',
  '  summary:hover { background: #e0e0e0; }',
  '  .content { padding: 15px; background: white; }',
].join('\n');

/** The pill used to tag a row with its namespace or owning package. */
export const BADGE_CSS =
  '  .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin-right: 2px; color: white; background-color: #95a5a6; }';

export type ReportPageOptions = {
  /** The `<title>`, and nothing else — each report writes its own `<h1>` into `body`. */
  title: string;
  /** The page body's markup, which may contain Handlebars expressions. */
  body: string;
  /** Page `max-width`. Defaults to `'1200px'`. */
  maxWidth?: string;
  /** Report-specific CSS, appended after the base rules so it can extend or override them. */
  css?: string;
  /** Extra `<head>` markup, e.g. a `<script src>` for a diagramming library. */
  head?: string;
  /** Script body placed at the end of `<body>`, inside a `<script>` tag. */
  script?: string;
};

/**
 * Wrap a report's body in the shared HTML page frame.
 *
 * The doctype, `<head>`, viewport meta, and stylesheet scaffold were written out once per
 * report; only the title, the extra rules, and the body ever differed.
 *
 * @param options - The page's title, body, and any report-specific additions.
 * @returns The complete HTML document, as a Handlebars template source string.
 */
export function renderReportPage(options: ReportPageOptions): string {
  const { title, body, maxWidth = DEFAULT_MAX_WIDTH, css, head, script } = options;

  const styles = [baseCss(maxWidth), css].filter(Boolean).join('\n');
  const headExtra = head ? `\n${head}` : '';
  const scriptBlock = script ? `\n  <script>\n${script}\n  </script>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>${headExtra}
<style>
${styles}
</style>
</head>
<body>
${body}${scriptBlock}
</body>
</html>`;
}
