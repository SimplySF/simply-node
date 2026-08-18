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

import { BADGE_CSS, COLLAPSIBLE_SECTION_CSS, createReportHandlebars, renderReportPage } from '@simplysf/simply-report';

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

const handlebars = createReportHandlebars();

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

const reportSource = renderReportPage({
  title: 'Field History Tracking Report',
  css: [
    COLLAPSIBLE_SECTION_CSS,
    '  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9em; }',
    '  th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }',
    '  th { background-color: #f8f9fa; position: sticky; top: 0; }',
    '  tr:hover { background-color: #f5f5f5; }',
    BADGE_CSS,
    '  .badge-ns { background-color: #3498db; }',
    '  .search-container { margin-bottom: 20px; position: sticky; top: 10px; z-index: 100; }',
    '  input[type="text"] { padding: 12px; width: 100%; max-width: 400px; border: 2px solid #3498db; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }',
  ].join('\n'),
  body: `  <h1>Field History Tracking Report</h1>
  <p>Org: <strong>{{username}}</strong> | Tracked Fields: {{fieldCount}} | Generated: {{reportDate}}</p>
  <div class="search-container">
    <input type="text" id="searchInput" onkeyup="filterFields()" placeholder="Search objects or fields across all packages...">
  </div>
  {{#each packages}}{{> packageSection}}{{/each}}`,
  script: `    function filterFields() {
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
    }`,
});

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
