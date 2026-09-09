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
import { createReportHandlebars } from '../../src/handlebars/createReportHandlebars.js';

describe('createReportHandlebars', () => {
  it('registers an eq helper usable from a template', () => {
    const handlebars = createReportHandlebars();
    const render = handlebars.compile('{{#if (eq a b)}}same{{else}}different{{/if}}');

    expect(render({ a: 'x', b: 'x' })).to.equal('same');
    expect(render({ a: 'x', b: 'y' })).to.equal('different');
  });

  it('escapes interpolated values, so org data cannot inject markup', () => {
    const handlebars = createReportHandlebars();

    expect(handlebars.compile('{{value}}')({ value: '<script>x</script>' })).to.not.contain('<script>');
  });

  it('gives each caller an isolated environment, so partials cannot leak between reports', () => {
    const first = createReportHandlebars();
    const second = createReportHandlebars();
    first.registerPartial('only-in-first', 'hello');

    expect(() => second.compile('{{> only-in-first}}')({})).to.throw();
  });
});
