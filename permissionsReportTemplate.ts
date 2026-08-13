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

/** A queried `ObjectPermissions` record, as attached to a permission set or group in the report. */
export type ObjectPermissionEntry = {
  SobjectType: string;
  PermissionsRead: boolean;
  PermissionsCreate: boolean;
  PermissionsEdit: boolean;
  PermissionsDelete: boolean;
  PermissionsViewAllRecords: boolean;
  PermissionsModifyAllRecords: boolean;
};

/** A queried `FieldPermissions` record, as attached to a permission set or group in the report. */
export type FieldPermissionEntry = {
  SobjectType: string;
  Field: string;
  PermissionsRead: boolean;
  PermissionsEdit: boolean;
};

/** A single permission set's identity and permissions, as rendered in the report. */
export type PermissionSetReportEntry = {
  Id: string;
  Name: string;
  Label: string;
  Description?: string;
  objectPerms: ObjectPermissionEntry[];
  fieldPerms: FieldPermissionEntry[];
};

/** A single permission set group's identity, member components, and permissions. */
export type PermissionSetGroupReportEntry = {
  Id: string;
  DeveloperName: string;
  MasterLabel: string;
  Description?: string;
  components: string[];
  objectPerms: ObjectPermissionEntry[];
  fieldPerms: FieldPermissionEntry[];
};

/** Permission sets and permission set groups, grouped by owning package (namespace or `''` for unpackaged). */
export type GroupedPermissionsData = Map<
  string,
  { permissionSets: PermissionSetReportEntry[]; permissionSetGroups: PermissionSetGroupReportEntry[] }
>;

// Handlebars auto-escapes every `{{expression}}` (unlike `{{{expression}}}`, which is left raw),
// so none of the templates below need a hand-rolled escapeHtml() call.
const handlebars = Handlebars.create();

// `Field` is the fully-qualified `Object.Field` name; the report only displays the field half.
handlebars.registerHelper('fieldName', (field: string): string => field.split('.')[1] ?? field);

const objectPermsTableSource = `
{{~#if perms}}
<table><thead><tr><th>Object</th><th>Read</th><th>Create</th><th>Edit</th><th>Delete</th><th>View All</th><th>Modify All</th></tr></thead><tbody>{{#each perms}}<tr><td>{{SobjectType}}</td><td>{{PermissionsRead}}</td><td>{{PermissionsCreate}}</td><td>{{PermissionsEdit}}</td><td>{{PermissionsDelete}}</td><td>{{PermissionsViewAllRecords}}</td><td>{{PermissionsModifyAllRecords}}</td></tr>{{/each}}</tbody></table>
{{~else~}}
<p>No object permissions.</p>
{{~/if~}}
`;

const fieldPermsTableSource = `
{{~#if perms}}
<table><thead><tr><th>Object</th><th>Field</th><th>Read</th><th>Edit</th></tr></thead><tbody>{{#each perms}}<tr><td>{{SobjectType}}</td><td>{{fieldName Field}}</td><td>{{PermissionsRead}}</td><td>{{PermissionsEdit}}</td></tr>{{/each}}</tbody></table>
{{~else~}}
<p>No field permissions.</p>
{{~/if~}}
`;

const permissionSetSource = `
<details>
  <summary>{{Label}} ({{Name}})</summary>
  <div class="content">
    {{#if Description}}<p>{{Description}}</p>{{/if}}
    <h4>Object Permissions</h4>
    {{> objectPermsTable perms=objectPerms}}
    <h4>Field Permissions</h4>
    {{> fieldPermsTable perms=fieldPerms}}
  </div>
</details>`;

const permissionSetGroupSource = `
<details>
  <summary>{{MasterLabel}} ({{DeveloperName}}) [Group]</summary>
  <div class="content">
    {{#if Description}}<p>{{Description}}</p>{{/if}}
    <p><strong>Components:</strong> {{componentsDisplay}}</p>
    <h4>Object Permissions</h4>
    {{> objectPermsTable perms=objectPerms}}
    <h4>Field Permissions</h4>
    {{> fieldPermsTable perms=fieldPerms}}
  </div>
</details>`;

const reportSource = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Permissions Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; background-color: #f4f7f6; }
  h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
  .package-section { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; padding: 15px; }
  details { margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; }
  summary { padding: 12px; cursor: pointer; font-weight: bold; background: #eee; outline: none; }
  summary:hover { background: #e0e0e0; }
  .content { padding: 15px; background: white; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; font-size: 0.9em; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  th { background-color: #f8f9fa; }
</style>
</head>
<body>
  <h1>Permissions Report</h1>
  <p>Org: <strong>{{username}}</strong> | Generated: {{reportDate}}</p>
  {{#each packages}}
  <div class="package-section" data-package="{{name}}">
    <h2>Package: {{name}}</h2>
    <h3>Permission Sets ({{permissionSets.length}})</h3>
    {{#each permissionSets}}{{> permissionSet}}{{/each}}
    <h3>Permission Set Groups ({{permissionSetGroups.length}})</h3>
    {{#each permissionSetGroups}}{{> permissionSetGroup}}{{/each}}
  </div>
  {{/each}}
</body>
</html>`;

handlebars.registerPartial('objectPermsTable', objectPermsTableSource);
handlebars.registerPartial('fieldPermsTable', fieldPermsTableSource);
handlebars.registerPartial('permissionSet', permissionSetSource);
handlebars.registerPartial('permissionSetGroup', permissionSetGroupSource);

const renderReport = handlebars.compile(reportSource);

/** View model for a single package section, as consumed by the report template. */
type PackageSection = {
  name: string;
  permissionSets: PermissionSetReportEntry[];
  permissionSetGroups: Array<PermissionSetGroupReportEntry & { componentsDisplay: string }>;
};

/**
 * Render a complete, self-contained HTML report of permission sets and permission set groups,
 * grouped by package, with each permission set/group collapsible for browsing.
 *
 * @param options.username - The org username the report was generated against.
 * @param options.reportDate - The report generation date/time, displayed as-is.
 * @param options.groupedData - The permission sets/groups to render, grouped by package.
 * @returns The rendered HTML document.
 */
export function buildPermissionsReportHtml(options: {
  username: string;
  reportDate: string;
  groupedData: GroupedPermissionsData;
}): string {
  const { username, reportDate, groupedData } = options;

  const packages: PackageSection[] = [...groupedData.keys()].sort().map((name) => {
    const data = groupedData.get(name);

    return {
      name,
      permissionSets: data?.permissionSets ?? [],
      permissionSetGroups: (data?.permissionSetGroups ?? []).map((group) => ({
        ...group,
        componentsDisplay: group.components.length > 0 ? group.components.join(', ') : 'None',
      })),
    };
  });

  return renderReport({ username, reportDate, packages });
}
