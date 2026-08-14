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

/** A single object-to-object relationship, as rendered in the report's relationship table. */
export type SchemaRelationship = {
  from: string;
  fromLabel: string;
  to: string;
  toLabel: string;
  fromPackage: string;
  toPackage: string;
  field: string;
  label?: string;
  isMasterDetail: boolean;
};

/** A `vis-network` node, one per visualized object. */
export type SchemaDiagramNode = {
  id: string;
  label: string;
  group: string;
  title: string;
};

/** A `vis-network` edge, one per visualized relationship. */
export type SchemaDiagramEdge = {
  from: string;
  to: string;
  title: string;
  arrows: 'to';
  dashes: boolean;
  font: { align: 'middle' };
};

const handlebars = Handlebars.create();

const schemaReportSource = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Salesforce Schema Report</title>
    <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1400px; margin: 0 auto; padding: 20px; background-color: #f4f7f6; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .tabs { display: flex; border-bottom: 2px solid #ddd; margin-bottom: 20px; }
        .tab { padding: 10px 20px; cursor: pointer; border: 1px solid transparent; border-bottom: none; border-radius: 4px 4px 0 0; font-weight: bold; }
        .tab.active { background-color: white; border-color: #ddd; margin-bottom: -2px; color: #3498db; }
        .tab-content { display: none; background: white; padding: 20px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .tab-content.active { display: block; }
        table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f8f9fa; position: sticky; top: 0; }
        tr:hover { background-color: #f1f1f1; }
        #network { width: 100%; height: 80vh; background-color: #ffffff; border: 1px solid #eee; border-radius: 4px; }
        .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin-right: 2px; color: white; background-color: #95a5a6; }
        .badge-md { background-color: #e74c3c; }
        .controls { display: flex; gap: 10px; align-items: center; margin-bottom: 15px; }
        input[type="text"] { padding: 8px; width: 100%; max-width: 300px; border: 1px solid #ddd; border-radius: 4px; }
        .legend { display: flex; gap: 15px; font-size: 0.8em; margin-top: 10px; color: #666; }
        .legend-item { display: flex; align-items: center; gap: 5px; }
        .line { width: 20px; height: 2px; }
        .solid { background-color: #333; }
        .dashed { border-top: 2px dashed #333; }
    </style>
</head>
<body>
    <h1>Salesforce Schema Report</h1>
    <p>Org: <strong>{{username}}</strong> | Objects: {{objectsCount}} | Relationships: {{relationshipsCount}}</p>

    <div class="tabs">
        <div class="tab active" onclick="showTab('diagram')">Diagram (Interactive)</div>
        <div class="tab" onclick="showTab('data')">Relationship Data</div>
    </div>

    <div id="diagram" class="tab-content active">
        <div class="controls">
            <input type="text" id="graphSearch" onkeyup="searchGraph()" placeholder="Search and focus object...">
            <button onclick="resetGraph()">Reset View</button>
            <button onclick="togglePhysics()">Toggle Physics</button>
            <button onclick="resetHighlight()">Clear Selection</button>
        </div>
        <div id="network"></div>
        <div class="legend">
            <div class="legend-item"><div class="line solid"></div> Master-Detail</div>
            <div class="legend-item"><div class="line dashed"></div> Lookup</div>
            <div class="legend-item"><em>Drag nodes to untangle lines. Scroll to zoom.</em></div>
        </div>
    </div>

    <div id="data" class="tab-content">
        <div class="controls">
            <input type="text" id="tableSearch" onkeyup="filterTable()" placeholder="Search objects or fields...">
        </div>
        <table id="relTable">
            <thead>
                <tr>
                    <th>Source Object</th>
                    <th>Field</th>
                    <th>Target Object</th>
                    <th>Type</th>
                    <th>Source Package</th>
                </tr>
            </thead>
            <tbody>
                {{#each relationships}}
                    <tr>
                        <td><strong>{{this.fromLabel}}</strong><br><small>{{this.from}}</small></td>
                        <td>{{this.label}}<br><small>{{this.field}}</small></td>
                        <td><strong>{{this.toLabel}}</strong><br><small>{{this.to}}</small></td>
                        <td>{{#if this.isMasterDetail}}<span class="badge badge-md">Master-Detail</span>{{else}}<span class="badge">Lookup</span>{{/if}}</td>
                        <td>{{this.fromPackage}}</td>
                    </tr>
                {{/each}}
            </tbody>
        </table>
    </div>

    <script type="text/javascript">
        const nodesData = {{{nodesJs}}};
        const edgesData = {{{edgesJs}}};

        const nodes = new vis.DataSet(nodesData);
        const edges = new vis.DataSet(edgesData);

        const container = document.getElementById('network');
        const data = { nodes, edges };
        const options = {
            nodes: {
                shape: 'box',
                margin: 10,
                font: { size: 12, multi: true },
                borderWidth: 2,
                shadow: true,
                color: {
                    highlight: { border: '#2980b9', background: '#3498db' }
                }
            },
            edges: {
                width: 2,
                font: { size: 10, strokeWidth: 0 },
                color: { color: '#848484', highlight: '#3498db', hover: '#3498db' },
                smooth: { type: 'continuous' },
                arrows: { to: { enabled: true, scaleFactor: 1 } }
            },
            physics: {
                enabled: true,
                forceAtlas2Based: {
                    gravitationalConstant: -100,
                    centralGravity: 0.005,
                    springConstant: 0.08,
                    springLength: 250,
                    damping: 0.4,
                    avoidOverlap: 1
                },
                solver: 'forceAtlas2Based',
                stabilization: {
                    iterations: 1000,
                    updateInterval: 50
                }
            },
            interaction: {
                hover: true,
                tooltipDelay: 200,
                hideEdgesOnDrag: true,
                navigationButtons: true
            },
            groups: {
                'Standard/Local': { color: { background: '#ecf0f1', border: '#bdc3c7' } }
            }
        };

        const network = new vis.Network(container, data, options);

        // Disable physics after stabilization for a "locked" feel
        network.on("stabilizationIterationsDone", function () {
            network.setOptions({ physics: false });
            console.log("Graph stabilized and physics locked.");
        });

        // Highlight neighbors on click
        network.on("click", function (params) {
            if (params.nodes.length > 0) {
                const selectedNode = params.nodes[0];
                const connectedNodes = network.getConnectedNodes(selectedNode);
                const allNodes = nodes.get();

                const updateArray = allNodes.map(node => {
                    if (node.id === selectedNode || connectedNodes.includes(node.id)) {
                        return { id: node.id, opacity: 1 };
                    } else {
                        return { id: node.id, opacity: 0.1 };
                    }
                });
                nodes.update(updateArray);

                const allEdges = edges.get();
                const connectedEdges = network.getConnectedEdges(selectedNode);
                const edgeUpdate = allEdges.map(edge => {
                    if (connectedEdges.includes(edge.id)) {
                        return { id: edge.id, opacity: 1, color: { color: '#3498db' } };
                    } else {
                        return { id: edge.id, opacity: 0.1, color: { color: '#848484' } };
                    }
                });
                edges.update(edgeUpdate);
            } else {
                resetHighlight();
            }
        });

        function resetHighlight() {
            const allNodes = nodes.get();
            nodes.update(allNodes.map(node => ({ id: node.id, opacity: 1 })));
            const allEdges = edges.get();
            edges.update(allEdges.map(edge => ({ id: edge.id, opacity: 1, color: { color: '#848484' } })));
        }

        window.togglePhysics = function() {
            const isEnabled = network.physics.options.enabled;
            network.setOptions({ physics: !isEnabled });
            if (!isEnabled) {
                // Stabilize again if re-enabling
                network.stabilize();
            }
        }

        window.showTab = function(tabId) {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            event.target.classList.add('active');
            if (tabId === 'diagram') network.fit();
        }

        window.searchGraph = function() {
            const term = document.getElementById('graphSearch').value.toLowerCase();
            if (!term) return;
            const foundNode = nodesData.find(n => n.id.toLowerCase().includes(term) || n.label.toLowerCase().includes(term));
            if (foundNode) {
                network.focus(foundNode.id, {
                    scale: 1.2,
                    animation: true
                });
                network.selectNodes([foundNode.id]);
            }
        }

        window.resetGraph = function() {
            document.getElementById('graphSearch').value = '';
            network.fit({ animation: true });
            network.unselectAll();
        }

        window.filterTable = function() {
            let input = document.getElementById("tableSearch");
            let filter = input.value.toUpperCase();
            let table = document.getElementById("relTable");
            let tr = table.getElementsByTagName("tr");
            for (let i = 1; i < tr.length; i++) {
                let text = tr[i].textContent || tr[i].innerText;
                tr[i].style.display = text.toUpperCase().indexOf(filter) > -1 ? "" : "none";
            }
        }
    </script>
</body>
</html>
`;

const renderSchemaReport = handlebars.compile(schemaReportSource);

/**
 * Render a self-contained, interactive HTML schema report: a `vis-network` object-relationship
 * diagram plus a searchable relationship data table.
 *
 * @param options.username - The org username (or `'local files'`) the report was generated from.
 * @param options.nodes - The diagram nodes, one per visualized object.
 * @param options.edges - The diagram edges, one per visualized relationship.
 * @param options.relationships - The relationships rendered in the data table.
 * @returns The rendered HTML document.
 */
export function buildSchemaReportHtml(options: {
  username: string;
  nodes: SchemaDiagramNode[];
  edges: SchemaDiagramEdge[];
  relationships: SchemaRelationship[];
}): string {
  const { username, nodes, edges, relationships } = options;

  return renderSchemaReport({
    username,
    objectsCount: nodes.length,
    relationshipsCount: relationships.length,
    nodesJs: JSON.stringify(nodes),
    edgesJs: JSON.stringify(edges),
    relationships,
  });
}
