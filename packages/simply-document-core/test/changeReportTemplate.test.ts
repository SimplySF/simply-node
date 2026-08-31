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
import { buildChangeReportHtml, type ChangesByComponentType } from '../src/changeReportTemplate.js';

describe('buildChangeReportHtml', () => {
  it('renders a table row per changed component, grouped under its section heading', () => {
    const changes: ChangesByComponentType = {
      apexClasses: [
        {
          componentName: 'AccountService',
          componentType: 'ApexClass',
          changeType: 'Added',
          changeDescription: 'New service class',
          path: 'force-app/main/default/classes/AccountService.cls',
        },
      ],
    };

    const html = buildChangeReportHtml(changes);

    expect(html).toContain('<h3>Apex Classes</h3>');
    expect(html).toContain('AccountService');
    expect(html).toContain('Added');
    expect(html).toContain('force-app/main/default/classes/AccountService.cls');
  });

  it('renders "None" under a section with no changed components', () => {
    const html = buildChangeReportHtml({});

    expect(html).toContain('<h3>Apex Classes</h3>');
    expect(html).toContain('<p>None</p>');
  });

  it('renders a custom template against the same changeTable partial', () => {
    const changes: ChangesByComponentType = {
      customObjects: [
        {
          componentName: 'Invoice__c',
          componentType: 'CustomObject',
          changeType: 'Modified',
          changeDescription: 'Added a field',
          path: 'force-app/main/default/objects/Invoice__c',
        },
      ],
    };

    const html = buildChangeReportHtml(changes, '<div>{{> changeTable customObjects}}</div>');

    expect(html).toContain('<div>');
    expect(html).toContain('Invoice__c');
    expect(html).not.toContain('<h2>Objects &amp; Data Model</h2>');
  });
});
