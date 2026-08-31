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

import Handlebars from 'handlebars';

/** A single changed component, as rendered in a change table row. */
export type ChangeEntry = {
  componentName: string;
  componentType: string;
  changeType: string;
  changeDescription: string;
  path: string;
};

/** Changed components, grouped by component type (e.g. `apexClasses`, `customObjects`). */
export type ChangesByComponentType = Record<string, ChangeEntry[]>;

const handlebars = Handlebars.create();

const changeTableSource = `
<table class="wrapped">
  <colgroup>
    <col />
    <col />
    <col />
    <col />
    <col />
  </colgroup>
  <tbody>
    <tr>
      <th>Component Name</th>
      <th>Component Type</th>
      <th>Change Type</th>
      <th>Change description</th>
      <th>Path</th>
    </tr>
    {{#each this}}
    <tr>
      <td>{{this.componentName}}</td>
      <td>{{this.componentType}}</td>
      <td style="text-align: center"><b>{{this.changeType}}</b></td>
      <td>{{this.changeDescription}}</td>
      <td>{{this.path}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
`;

const changeReportSource = `<h2>Objects &amp; Data Model</h2>

<h3>Standard Objects</h3>
{{#if standardObjects}}
  {{> changeTable standardObjects}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Custom Objects</h3>
{{#if customObjects}}
  {{> changeTable customObjects}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Custom Settings</h3>
{{#if customSettings}}
  {{> changeTable customSettings}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Custom Metadata Types</h3>
{{#if customMetadataTypes}}
  {{> changeTable customMetadataTypes}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Custom Metadata</h3>
{{#if customMetadata}}
  {{> changeTable customMetadata}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Platform Events</h3>
{{#if platformEvents}}
  {{> changeTable platformEvents}}
{{else}}
  <p>None</p>
{{/if}}

<h2>Custom Code</h2>

<h3>Apex Classes</h3>
{{#if apexClasses}}
  {{> changeTable apexClasses}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Apex Triggers</h3>
{{#if apexTriggers}}
  {{> changeTable apexTriggers}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Visualforce Pages</h3>
{{#if visualforcePages}}
  {{> changeTable visualforcePages}}
{{else}}
  <p>None</p>
{{/if}}

<h2>User Interface Components</h2>

<h3>Lightning Web Components</h3>
{{#if lightningComponents}}
  {{> changeTable lightningComponents}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Aura Components</h3>
{{#if auraComponents}}
  {{> changeTable auraComponents}}
{{else}}
  <p>None</p>
{{/if}}

<h2>Business Logic &amp; Automation</h2>

<h3>Flows</h3>
{{#if flows}}
  {{> changeTable flows}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Flexipages</h3>
{{#if flexipages}}
  {{> changeTable flexipages}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Approval Processes</h3>
{{#if approvalProcesses}}
  {{> changeTable approvalProcesses}}
{{else}}
  <p>None</p>
{{/if}}

<h2>Applications &amp; Branding</h2>

<h3>Custom Applications</h3>
{{#if customApplications}}
  {{> changeTable customApplications}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Custom Labels</h3>
{{#if customLabels}}
  {{> changeTable customLabels}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Static Resources</h3>
{{#if staticResources}}
  {{> changeTable staticResources}}
{{else}}
  <p>None</p>
{{/if}}

<h2>Analytics &amp; Reporting</h2>

<h3>Dashboards</h3>
{{#if dashboards}}
  {{> changeTable dashboards}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Reports</h3>
{{#if reports}}
  {{> changeTable reports}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Email Templates</h3>
{{#if emailTemplates}}
  {{> changeTable emailTemplates}}
{{else}}
  <p>None</p>
{{/if}}

<h2>Digital Experiences</h2>

<h3>Digital Experience Bundles</h3>
{{#if digitalExperienceBundles}}
  {{> changeTable digitalExperienceBundles}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Experience Bundles</h3>
{{#if experienceBundles}}
  {{> changeTable experienceBundles}}
{{else}}
  <p>None</p>
{{/if}}

<h2>Security, Groups &amp; Queues</h2>

<h3>Groups</h3>
{{#if groups}}
  {{> changeTable groups}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Queues</h3>
{{#if queues}}
  {{> changeTable queues}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Permission Sets</h3>
{{#if permissionSets}}
  {{> changeTable permissionSets}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Permission Set Groups</h3>
{{#if permissionSetGroups}}
  {{> changeTable permissionSetGroups}}
{{else}}
  <p>None</p>
{{/if}}

<h3>Sharing Rules</h3>
{{#if sharingRules}}
  {{> changeTable sharingRules}}
{{else}}
  <p>None</p>
{{/if}}
`;

handlebars.registerPartial('changeTable', changeTableSource);

const renderChangeReport = handlebars.compile(changeReportSource);

/**
 * Render a Confluence-storage-format change report grouping a set of changed components by
 * component type, for pasting into a release/change-management page.
 *
 * @param changes - The changed components, grouped by component type.
 * @param customTemplateSource - A user-supplied Handlebars template to render instead of the
 * built-in one. Compiled against the same Handlebars instance as the built-in template, so it
 * can also use the `changeTable` partial. See the README's "Custom Templates" section for the
 * `changes` data shape and the fields `changeTable` renders.
 * @returns The rendered XHTML fragment.
 */
export function buildChangeReportHtml(changes: ChangesByComponentType, customTemplateSource?: string): string {
  const render = customTemplateSource ? handlebars.compile(customTemplateSource) : renderChangeReport;
  return render(changes);
}
