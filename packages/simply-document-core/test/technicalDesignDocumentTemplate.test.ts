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

import { describe, expect, it } from 'vitest';
import {
  buildTechnicalDesignDocumentHtml,
  type TechnicalDesignDocumentData,
} from '../src/technicalDesignDocumentTemplate.js';

const emptyData: TechnicalDesignDocumentData = {
  apexClasses: [],
  apexTriggers: [],
  approvalProcesses: [],
  auraComponents: [],
  customApplications: [],
  customLabels: [],
  customMetadata: [],
  customMetadataTypes: [],
  customObjects: [],
  customSettings: [],
  dashboards: [],
  digitalExperienceBundles: [],
  emailTemplates: [],
  experienceBundles: [],
  flexipages: [],
  flows: [],
  groups: [],
  lightningComponents: [],
  permissionSets: [],
  permissionSetGroups: [],
  platformEvents: [],
  queues: [],
  reports: [],
  sharingRules: [],
  standardObjects: [],
  staticResources: [],
  visualforcePages: [],
};

describe('buildTechnicalDesignDocumentHtml', () => {
  it('renders "None" sections throughout for an empty project', () => {
    const html = buildTechnicalDesignDocumentHtml(emptyData);

    expect(html).toContain('<h2>Objects</h2>');
    expect(html).toContain('<h1 class="auto-cursor-target">Security Model</h1>');
    expect(html.match(/<p>None<\/p>/g)?.length).toBeGreaterThan(0);
  });

  it('renders a custom object with its record types, fields, and validation rules', () => {
    const html = buildTechnicalDesignDocumentHtml({
      ...emptyData,
      customObjects: [
        {
          name: 'Invoice__c',
          label: 'Invoice',
          miniDescription: 'Billing record',
          recordTypes: [{ fullName: 'Standard', label: 'Standard', active: 'true' }],
          customFields: [{ fullName: 'Amount__c', label: 'Amount', type: 'Currency', required: 'true' }],
          validationRules: [{ fullName: 'Amount_Positive', active: 'true', description: 'Must be positive' }],
        },
      ],
    });

    expect(html).toContain('Invoice');
    expect(html).toContain('Amount__c');
    expect(html).toContain('Amount_Positive');
    expect(html).toContain('TRUE');
  });

  it('renders a custom template against the same loud helper', () => {
    const html = buildTechnicalDesignDocumentHtml(
      { ...emptyData, groups: [{ label: 'Support', apiName: 'Support_Group', doesIncludeBosses: 'true' }] },
      '{{#each groups}}{{loud this.label}}{{/each}}',
    );

    expect(html).toBe('SUPPORT');
  });
});
