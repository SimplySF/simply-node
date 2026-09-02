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
  buildSchemaReportHtml,
  SchemaDiagramEdge,
  SchemaDiagramNode,
  SchemaRelationship,
} from '../src/schemaReportTemplate.js';

describe('buildSchemaReportHtml', () => {
  const nodes: SchemaDiagramNode[] = [{ id: 'Account', label: 'Account', group: 'Standard/Local', title: 'Account' }];
  const edges: SchemaDiagramEdge[] = [
    { from: 'Contact', to: 'Account', title: 'AccountId', arrows: 'to', dashes: true, font: { align: 'middle' } },
  ];
  const relationships: SchemaRelationship[] = [
    {
      from: 'Contact',
      fromLabel: 'Contact',
      to: 'Account',
      toLabel: 'Account',
      fromPackage: 'Standard/Local',
      toPackage: 'Standard/Local',
      field: 'AccountId',
      isMasterDetail: false,
    },
  ];

  it('includes the username and object/relationship counts', () => {
    const html = buildSchemaReportHtml({ username: 'test@example.com', nodes, edges, relationships });

    expect(html).to.include('test@example.com');
    expect(html).to.include('Objects: 1');
    expect(html).to.include('Relationships: 1');
  });

  it('embeds the nodes and edges as JSON for the diagram', () => {
    const html = buildSchemaReportHtml({ username: 'test@example.com', nodes, edges, relationships });

    expect(html).to.include(JSON.stringify(nodes));
    expect(html).to.include(JSON.stringify(edges));
  });

  it('renders each relationship as a table row, distinguishing lookup from master-detail', () => {
    const masterDetail: SchemaRelationship = { ...relationships[0], isMasterDetail: true };
    const html = buildSchemaReportHtml({ username: 'test@example.com', nodes, edges, relationships: [masterDetail] });

    expect(html).to.include('badge-md">Master-Detail<');
    expect(html).to.not.include('>Lookup<');
  });

  it('renders a lookup relationship without the master-detail badge', () => {
    const html = buildSchemaReportHtml({ username: 'test@example.com', nodes, edges, relationships });

    expect(html).to.include('>Lookup<');
    expect(html).to.not.include('badge-md">Master-Detail<');
  });

  it('handles no relationships without throwing', () => {
    const html = buildSchemaReportHtml({ username: 'test@example.com', nodes: [], edges: [], relationships: [] });

    expect(html).to.include('Objects: 0');
    expect(html).to.include('Relationships: 0');
  });
});
