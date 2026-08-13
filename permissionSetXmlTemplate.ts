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

/** One `<objectPermissions>` entry in a PermissionSet metadata file. */
export type ObjectPermission = {
  object: string;
  allowCreate: boolean;
  allowDelete: boolean;
  allowEdit: boolean;
  allowRead: boolean;
  modifyAllRecords: boolean;
  viewAllRecords: boolean;
  viewAllFields: boolean;
};

/** One `<fieldPermissions>` entry in a PermissionSet metadata file. */
export type FieldPermission = {
  field: string;
  readable: boolean;
  editable: boolean;
};

/** One `<tabSettings>` entry in a PermissionSet metadata file. */
export type TabSetting = {
  tab: string;
  visible: boolean;
};

/** One `<recordTypeVisibilities>` entry in a PermissionSet metadata file. */
export type RecordTypeVisibility = {
  recordType: string;
  visible: boolean;
};

/** One `<userPermissions>` entry in a PermissionSet metadata file. */
export type UserPermission = {
  name: string;
  enabled: boolean;
};

/** Everything needed to render a complete PermissionSet metadata XML file. */
export type PermissionSetTemplateData = {
  label: string;
  description?: string;
  objectPermissions: ObjectPermission[];
  fieldPermissions: FieldPermission[];
  tabSettings: TabSetting[];
  recordTypeVisibilities: RecordTypeVisibility[];
  userPermissions: UserPermission[];
};

/**
 * @param value - The raw string to escape.
 * @returns `value` with XML special characters (`& < > " '`) replaced by their entity references.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Render a complete PermissionSet metadata XML document from template data.
 *
 * @param data - The permission set's label, description, and permission entries.
 * @returns The rendered `<PermissionSet>` XML document, ready to write to a `.permissionset-meta.xml` file.
 */
export function buildPermissionSetXml(data: PermissionSetTemplateData): string {
  const objectPermissionsXml = data.objectPermissions
    .map(
      (permission) => `  <objectPermissions>
    <object>${escapeXml(permission.object)}</object>
    <allowCreate>${permission.allowCreate}</allowCreate>
    <allowDelete>${permission.allowDelete}</allowDelete>
    <allowEdit>${permission.allowEdit}</allowEdit>
    <allowRead>${permission.allowRead}</allowRead>
    <modifyAllRecords>${permission.modifyAllRecords}</modifyAllRecords>
    <viewAllRecords>${permission.viewAllRecords}</viewAllRecords>
  </objectPermissions>`,
    )
    .join('\n');

  const fieldPermissionsXml = data.fieldPermissions
    .map(
      (permission) => `  <fieldPermissions>
    <field>${escapeXml(permission.field)}</field>
    <readable>${permission.readable}</readable>
    <editable>${permission.editable}</editable>
  </fieldPermissions>`,
    )
    .join('\n');

  const tabSettingsXml = data.tabSettings
    .map(
      (setting) => `  <tabSettings>
    <tab>${escapeXml(setting.tab)}</tab>
    <visibility>${setting.visible ? 'Visible' : 'Hidden'}</visibility>
  </tabSettings>`,
    )
    .join('\n');

  const recordTypeVisibilitiesXml = data.recordTypeVisibilities
    .map(
      (visibility) => `  <recordTypeVisibilities>
    <recordType>${escapeXml(visibility.recordType)}</recordType>
    <visible>${visibility.visible}</visible>
  </recordTypeVisibilities>`,
    )
    .join('\n');

  const userPermissionsXml = data.userPermissions
    .map(
      (permission) => `  <userPermissions>
    <name>${escapeXml(permission.name)}</name>
    <enabled>${permission.enabled}</enabled>
  </userPermissions>`,
    )
    .join('\n');

  const sections = [
    `  <label>${escapeXml(data.label)}</label>`,
    data.description ? `  <description>${escapeXml(data.description)}</description>` : '',
    objectPermissionsXml,
    fieldPermissionsXml,
    tabSettingsXml,
    recordTypeVisibilitiesXml,
    userPermissionsXml,
  ].filter(Boolean);

  return `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
${sections.join('\n')}
</PermissionSet>
`;
}
