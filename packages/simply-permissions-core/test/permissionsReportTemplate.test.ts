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

import { describe, it, expect } from 'vitest';
import {
  buildPermissionsReportHtml,
  type GroupedPermissionsData,
  type PermissionSetReportEntry,
  type PermissionSetGroupReportEntry,
} from '../src/permissionsReportTemplate.js';

const permissionSet: PermissionSetReportEntry = {
  Id: '0PS000000000001',
  Name: 'My_Permission_Set',
  Label: 'My Permission Set',
  objectPerms: [
    {
      SobjectType: 'Account',
      PermissionsRead: true,
      PermissionsCreate: true,
      PermissionsEdit: false,
      PermissionsDelete: false,
      PermissionsViewAllRecords: false,
      PermissionsModifyAllRecords: false,
    },
  ],
  fieldPerms: [
    { SobjectType: 'Account', Field: 'Account.CustomField__c', PermissionsRead: true, PermissionsEdit: false },
  ],
};

const permissionSetGroup: PermissionSetGroupReportEntry = {
  Id: '0PG000000000001',
  DeveloperName: 'My_Group',
  MasterLabel: 'My Group',
  components: ['My_Permission_Set'],
  objectPerms: [],
  fieldPerms: [],
};

describe('buildPermissionsReportHtml', () => {
  it('renders an empty report with no packages', () => {
    const html = buildPermissionsReportHtml({
      username: 'user@example.com',
      reportDate: '2026-01-01',
      groupedData: new Map(),
    });

    expect(html).toContain('Permissions Report');
    expect(html).toContain('user@example.com');
  });

  it('renders a package section with a permission set and its permissions', () => {
    const groupedData: GroupedPermissionsData = new Map([
      ['', { permissionSets: [permissionSet], permissionSetGroups: [] }],
    ]);

    const html = buildPermissionsReportHtml({ username: 'user@example.com', reportDate: '2026-01-01', groupedData });

    expect(html).toContain('My Permission Set');
    expect(html).toContain('Account');
    // fieldName helper strips the SObject prefix off the fully-qualified field name
    expect(html).toContain('CustomField__c');
  });

  it('renders a permission set group with its joined components', () => {
    const groupedData: GroupedPermissionsData = new Map([
      ['', { permissionSets: [], permissionSetGroups: [permissionSetGroup] }],
    ]);

    const html = buildPermissionsReportHtml({ username: 'user@example.com', reportDate: '2026-01-01', groupedData });

    expect(html).toContain('My Group');
    expect(html).toContain('My_Permission_Set');
  });

  it('renders "None" for a permission set group with no components', () => {
    const groupedData: GroupedPermissionsData = new Map([
      ['', { permissionSets: [], permissionSetGroups: [{ ...permissionSetGroup, components: [] }] }],
    ]);

    const html = buildPermissionsReportHtml({ username: 'user@example.com', reportDate: '2026-01-01', groupedData });

    expect(html).toContain('None');
  });

  it('sorts multiple packages by name', () => {
    const groupedData: GroupedPermissionsData = new Map([
      ['zPackage', { permissionSets: [], permissionSetGroups: [] }],
      ['aPackage', { permissionSets: [], permissionSetGroups: [] }],
    ]);

    const html = buildPermissionsReportHtml({ username: 'user@example.com', reportDate: '2026-01-01', groupedData });
    const aIndex = html.indexOf('aPackage');
    const zIndex = html.indexOf('zPackage');

    expect(aIndex).toBeGreaterThan(-1);
    expect(aIndex).toBeLessThan(zIndex);
  });
});
