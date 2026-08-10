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

export type FieldPermission = {
  field: string;
  readable: boolean;
  editable: boolean;
};

export type TabSetting = {
  tab: string;
  visible: boolean;
};

export type RecordTypeVisibility = {
  recordType: string;
  visible: boolean;
};

export type UserPermission = {
  name: string;
  enabled: boolean;
};

export type PermissionSetTemplateData = {
  label: string;
  description?: string;
  objectPermissions: ObjectPermission[];
  fieldPermissions: FieldPermission[];
  tabSettings: TabSetting[];
  recordTypeVisibilities: RecordTypeVisibility[];
  userPermissions: UserPermission[];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
