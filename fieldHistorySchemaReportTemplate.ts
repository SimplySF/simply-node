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

import Handlebars from 'handlebars';

/** A single field-history-tracked field, as rendered in the report. */
export type FieldHistorySchemaEntry = {
  objectName: string;
  objectApiName: string;
  fieldName: string;
  fieldApiName: string;
  managedPackageNamespace: string;
  packageName: string;
};

/** Tracked fields, grouped by owning package (namespace/subscriber package name, or `'Local (Unpackaged)'`). */
export type GroupedFieldHistorySchemaData = Map<string, FieldHistorySchemaEntry[]>;

// Handlebars auto-escapes every `{{expression}}` (unlike `{{{expression}}}`, which is left raw),
// so the template below doesn't need a hand-rolled escapeHtml() call.
const handlebars = Handlebars.create();

const fieldRowSource = `
<tr class="field-row">
  <td><strong>{{objectName}}</strong><br><small>{{objectApiName}}</small></td>
  <td><strong>{{fieldName}}</strong><br><small>{{fieldApiName}}</small></td>
  <td>
    {{#unless (eq managedPackageNamespace "N/A")}}<span class="badge badge-ns">{{managedPackageNamespace}}</span>{{/unless}}
    <span class="badge">{{packageName}}</span>
  </td>
</tr>`;

const packageSectionSource = `
<div class="package-section" data-package="{{name}}">
  <h2>Package: {{name}}</h2>
  <details>
    <summary>Tracked Fields ({{fields.length}})</summary>
    <div class="content">
      <table>
        <thead><tr><th>Object</th><th>Field</th><th>Details</th></tr></thead>
        <tbody>{{#each fields}}{{> fieldRow}}{{/each}}</tbody>
      </table>
    </div>
  </details>
</div>`;

const reportSource = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Field History Tracking Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; background-color: #f4f7f6; }
  h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
  .package-section { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; padding: 15px; }
  details { margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; }
  summary { padding: 12px; cursor: pointer; font-weight: bold; background: #eee; outline: none; }
  summary:hover { background: #e0e0e0; }
  .content { padding: 15px; background: white; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9em; }
  th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
  th { background-color: #f8f9fa; position: sticky; top: 0; }
  tr:hover { background-color: #f5f5f5; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin-right: 2px; color: white; background-color: #95a5a6; }
  .badge-ns { background-color: #3498db; }
  .search-container { margin-bottom: 20px; position: sticky; top: 10px; z-index: 100; }
  input[type="text"] { padding: 12px; width: 100%; max-width: 400px; border: 2px solid #3498db; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
</style>
</head>
<body>
  <h1>Field History Tracking Report</h1>
  <p>Org: <strong>{{username}}</strong> | Tracked Fields: {{fieldCount}} | Generated: {{reportDate}}</p>
  <div class="search-container">
    <input type="text" id="searchInput" onkeyup="filterFields()" placeholder="Search objects or fields across all packages...">
  </div>
  {{#each packages}}{{> packageSection}}{{/each}}
  <script>
    function filterFields() {
      const input = document.getElementById("searchInput");
      const filter = input.value.toUpperCase();
      const sections = document.querySelectorAll(".package-section");
      sections.forEach(section => {
        let sectionHasVisibleRows = false;
        const rows = section.querySelectorAll(".field-row");
        const details = section.querySelector("details");

        rows.forEach(row => {
          const text = row.textContent || row.innerText;
          if (text.toUpperCase().indexOf(filter) > -1) {
            row.style.display = "";
            sectionHasVisibleRows = true;
          } else {
            row.style.display = "none";
          }
        });

        section.style.display = sectionHasVisibleRows ? "" : "none";
        if (filter && sectionHasVisibleRows) {
          details.open = true;
        } else if (!filter) {
          details.open = false;
        }
      });
    }
  </script>
</body>
</html>`;

handlebars.registerHelper('eq', (a: unknown, b: unknown): boolean => a === b);
handlebars.registerPartial('fieldRow', fieldRowSource);
handlebars.registerPartial('packageSection', packageSectionSource);

const renderReport = handlebars.compile(reportSource);

/** View model for a single package section, as consumed by the report template. */
type PackageSection = {
  name: string;
  fields: FieldHistorySchemaEntry[];
};

/**
 * Render a complete, self-contained HTML report of field-history-tracked objects/fields, grouped
 * by owning package, with each package section collapsible and a client-side search box for
 * filtering objects/fields across all packages.
 *
 * @param options.username - The org username the report was generated against.
 * @param options.reportDate - The report generation date/time, displayed as-is.
 * @param options.groupedData - The tracked fields to render, grouped by package.
 * @returns The rendered HTML document.
 */
export function buildFieldHistorySchemaReportHtml(options: {
  username: string;
  reportDate: string;
  groupedData: GroupedFieldHistorySchemaData;
}): string {
  const { username, reportDate, groupedData } = options;

  const packages: PackageSection[] = [...groupedData.keys()]
    .sort()
    .map((name) => ({ name, fields: groupedData.get(name) ?? [] }));

  const fieldCount = packages.reduce((sum, pkg) => sum + pkg.fields.length, 0);

  return renderReport({ username, reportDate, fieldCount, packages });
}
