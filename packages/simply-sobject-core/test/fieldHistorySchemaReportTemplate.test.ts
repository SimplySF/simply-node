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
  buildFieldHistorySchemaReportHtml,
  type GroupedFieldHistorySchemaData,
  type FieldHistorySchemaEntry,
} from '../src/fieldHistorySchemaReportTemplate.js';

const trackedField: FieldHistorySchemaEntry = {
  objectName: 'Account',
  objectApiName: 'Account',
  fieldName: 'Custom Field',
  fieldApiName: 'CustomField__c',
  managedPackageNamespace: 'N/A',
  packageName: 'Local (Unpackaged)',
};

describe('buildFieldHistorySchemaReportHtml', () => {
  it('renders an empty report with no packages', () => {
    const html = buildFieldHistorySchemaReportHtml({
      username: 'user@example.com',
      reportDate: '2026-01-01',
      groupedData: new Map(),
    });

    expect(html).toContain('Field History Tracking Report');
    expect(html).toContain('user@example.com');
    expect(html).toContain('Tracked Fields: 0');
  });

  it('renders a package section with its tracked fields and total count', () => {
    const groupedData: GroupedFieldHistorySchemaData = new Map([['Local (Unpackaged)', [trackedField]]]);

    const html = buildFieldHistorySchemaReportHtml({
      username: 'user@example.com',
      reportDate: '2026-01-01',
      groupedData,
    });

    expect(html).toContain('Account');
    expect(html).toContain('CustomField__c');
    expect(html).toContain('Tracked Fields: 1');
  });

  it('omits the namespace badge when managedPackageNamespace is N/A', () => {
    const groupedData: GroupedFieldHistorySchemaData = new Map([['Local (Unpackaged)', [trackedField]]]);

    const html = buildFieldHistorySchemaReportHtml({
      username: 'user@example.com',
      reportDate: '2026-01-01',
      groupedData,
    });

    expect(html).not.toContain('badge-ns">N/A');
  });

  it('renders the namespace badge when a managed package namespace is set', () => {
    const namespacedField: FieldHistorySchemaEntry = {
      ...trackedField,
      managedPackageNamespace: 'myns',
      packageName: 'My Package',
    };
    const groupedData: GroupedFieldHistorySchemaData = new Map([['myns', [namespacedField]]]);

    const html = buildFieldHistorySchemaReportHtml({
      username: 'user@example.com',
      reportDate: '2026-01-01',
      groupedData,
    });

    expect(html).toContain('badge-ns">myns');
  });

  it('sums field counts across multiple packages and sorts sections by name', () => {
    const groupedData: GroupedFieldHistorySchemaData = new Map([
      ['zPackage', [trackedField]],
      ['aPackage', [trackedField, trackedField]],
    ]);

    const html = buildFieldHistorySchemaReportHtml({
      username: 'user@example.com',
      reportDate: '2026-01-01',
      groupedData,
    });

    expect(html).toContain('Tracked Fields: 3');
    expect(html.indexOf('aPackage')).toBeLessThan(html.indexOf('zPackage'));
  });
});
