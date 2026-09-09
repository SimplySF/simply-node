/*
 * Copyright (c) 2026, SimplySF.
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
import { BADGE_CSS, COLLAPSIBLE_SECTION_CSS, renderReportPage } from '../../src/page/reportPage.js';

describe('renderReportPage', () => {
  it('emits a complete document with the given title and body', () => {
    const html = renderReportPage({ title: 'My Report', body: '<h1>My Report</h1>' });

    expect(html.startsWith('<!DOCTYPE html>\n<html lang="en">')).to.equal(true);
    expect(html).to.contain('<title>My Report</title>');
    expect(html).to.contain('<h1>My Report</h1>');
    expect(html.trimEnd().endsWith('</html>')).to.equal(true);
  });

  it('always declares the charset and viewport', () => {
    const html = renderReportPage({ title: 'x', body: '' });

    expect(html).to.contain('<meta charset="UTF-8">');
    expect(html).to.contain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
  });

  it('defaults the page width to 1200px', () => {
    expect(renderReportPage({ title: 'x', body: '' })).to.contain('max-width: 1200px;');
  });

  it('uses a caller-supplied page width', () => {
    expect(renderReportPage({ title: 'x', body: '', maxWidth: '1400px' })).to.contain('max-width: 1400px;');
  });

  it('appends report CSS after the base rules, so it can override them', () => {
    const html = renderReportPage({ title: 'x', body: '', css: '  th { padding: 12px; }' });

    expect(html.indexOf('h1 { color: #2c3e50;')).to.be.lessThan(html.indexOf('th { padding: 12px; }'));
  });

  it('omits the script block entirely when no script is given', () => {
    expect(renderReportPage({ title: 'x', body: '' })).to.not.contain('<script>');
  });

  it('places a given script at the end of the body', () => {
    const html = renderReportPage({ title: 'x', body: '<p>hi</p>', script: 'function f() {}' });

    expect(html).to.contain('  <script>\nfunction f() {}\n  </script>');
    expect(html.indexOf('<p>hi</p>')).to.be.lessThan(html.indexOf('<script>'));
  });

  it('places extra head markup inside head, before the stylesheet', () => {
    const html = renderReportPage({ title: 'x', body: '', head: '<script src="https://cdn/lib.js"></script>' });

    expect(html.indexOf('<script src="https://cdn/lib.js">')).to.be.lessThan(html.indexOf('<style>'));
    expect(html.indexOf('<script src="https://cdn/lib.js">')).to.be.lessThan(html.indexOf('</head>'));
  });

  it('leaves Handlebars expressions in the body untouched, since the result is a template', () => {
    expect(renderReportPage({ title: 'x', body: '<p>{{username}}</p>' })).to.contain('<p>{{username}}</p>');
  });
});

describe('shared CSS fragments', () => {
  it('COLLAPSIBLE_SECTION_CSS carries the package-section and details rules', () => {
    expect(COLLAPSIBLE_SECTION_CSS).to.contain('.package-section {');
    expect(COLLAPSIBLE_SECTION_CSS).to.contain('details {');
    expect(COLLAPSIBLE_SECTION_CSS).to.contain('summary:hover {');
  });

  it('BADGE_CSS carries the badge rule', () => {
    expect(BADGE_CSS).to.contain('.badge {');
  });
});
