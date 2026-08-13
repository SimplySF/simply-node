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

/**
 * @param value - The raw string to escape.
 * @returns `value` with HTML special characters (`& < > "`) replaced by their entity references.
 */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** @returns An HTML `<table>` of object permissions, or a placeholder `<p>` if `perms` is empty. */
function renderObjectPermsTable(perms: ObjectPermissionEntry[]): string {
  if (perms.length === 0) {
    return '<p>No object permissions.</p>';
  }

  const rows = perms
    .map(
      (permission) =>
        `<tr><td>${escapeHtml(permission.SobjectType)}</td><td>${permission.PermissionsRead}</td><td>${permission.PermissionsCreate}</td><td>${permission.PermissionsEdit}</td><td>${permission.PermissionsDelete}</td><td>${permission.PermissionsViewAllRecords}</td><td>${permission.PermissionsModifyAllRecords}</td></tr>`,
    )
    .join('');

  return `<table><thead><tr><th>Object</th><th>Read</th><th>Create</th><th>Edit</th><th>Delete</th><th>View All</th><th>Modify All</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** @returns An HTML `<table>` of field permissions, or a placeholder `<p>` if `perms` is empty. */
function renderFieldPermsTable(perms: FieldPermissionEntry[]): string {
  if (perms.length === 0) {
    return '<p>No field permissions.</p>';
  }

  const rows = perms
    .map(
      (permission) =>
        `<tr><td>${escapeHtml(permission.SobjectType)}</td><td>${escapeHtml(permission.Field.split('.')[1] ?? permission.Field)}</td><td>${permission.PermissionsRead}</td><td>${permission.PermissionsEdit}</td></tr>`,
    )
    .join('');

  return `<table><thead><tr><th>Object</th><th>Field</th><th>Read</th><th>Edit</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** @returns A collapsible `<details>` section summarizing one permission set's permissions. */
function renderPermissionSet(permissionSet: PermissionSetReportEntry): string {
  return `
    <details>
      <summary>${escapeHtml(permissionSet.Label)} (${escapeHtml(permissionSet.Name)})</summary>
      <div class="content">
        ${permissionSet.Description ? `<p>${escapeHtml(permissionSet.Description)}</p>` : ''}
        <h4>Object Permissions</h4>
        ${renderObjectPermsTable(permissionSet.objectPerms)}
        <h4>Field Permissions</h4>
        ${renderFieldPermsTable(permissionSet.fieldPerms)}
      </div>
    </details>`;
}

/** @returns A collapsible `<details>` section summarizing one permission set group's permissions. */
function renderPermissionSetGroup(permissionSetGroup: PermissionSetGroupReportEntry): string {
  return `
    <details>
      <summary>${escapeHtml(permissionSetGroup.MasterLabel)} (${escapeHtml(permissionSetGroup.DeveloperName)}) [Group]</summary>
      <div class="content">
        ${permissionSetGroup.Description ? `<p>${escapeHtml(permissionSetGroup.Description)}</p>` : ''}
        <p><strong>Components:</strong> ${permissionSetGroup.components.map(escapeHtml).join(', ') || 'None'}</p>
        <h4>Object Permissions</h4>
        ${renderObjectPermsTable(permissionSetGroup.objectPerms)}
        <h4>Field Permissions</h4>
        ${renderFieldPermsTable(permissionSetGroup.fieldPerms)}
      </div>
    </details>`;
}

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
  const sortedPackages = [...groupedData.keys()].sort();

  const sections = sortedPackages
    .map((pkg) => {
      const data = groupedData.get(pkg);
      if (!data) {
        return '';
      }

      return `
        <div class="package-section" data-package="${escapeHtml(pkg)}">
          <h2>Package: ${escapeHtml(pkg)}</h2>
          <h3>Permission Sets (${data.permissionSets.length})</h3>
          ${data.permissionSets.map(renderPermissionSet).join('')}
          <h3>Permission Set Groups (${data.permissionSetGroups.length})</h3>
          ${data.permissionSetGroups.map(renderPermissionSetGroup).join('')}
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
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
  <p>Org: <strong>${escapeHtml(username)}</strong> | Generated: ${escapeHtml(reportDate)}</p>
  ${sections}
</body>
</html>`;
}
