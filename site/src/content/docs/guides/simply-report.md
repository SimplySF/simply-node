---
title: simply-report
description: Usage examples for @simplysf/simply-report.
---

Shared HTML report scaffolding — the page shell, base stylesheet, and Handlebars environment behind
every standalone HTML report the Simply plugins emit. Full signatures and types are in the
[API reference](/api/simply-report/readme/).

```sh
npm install @simplysf/simply-report
```

## Wrapping a report body in the shared page frame

`renderReportPage` handles the doctype, `<head>`, viewport meta, and base stylesheet — you only
supply the title and the body markup (typically the output of a Handlebars template you compiled
yourself):

```ts
import { renderReportPage } from '@simplysf/simply-report';

const html = renderReportPage({
  title: 'Field History Report',
  body: '<h1>Field History Report</h1><table>...</table>',
  css: '.my-report-specific-rule { color: red; }',
});

await fs.promises.writeFile('report.html', html);
```

## Compiling your own report template

`createReportHandlebars` returns a fresh Handlebars environment pre-registered with the `eq` helper
every report template can rely on:

```ts
import { createReportHandlebars } from '@simplysf/simply-report';

const handlebars = createReportHandlebars();
const template = handlebars.compile(`
  <table>
    {{#each rows}}
      <tr class="{{#if (eq status 'Success')}}badge{{/if}}">
        <td>{{name}}</td>
        <td>{{status}}</td>
      </tr>
    {{/each}}
  </table>
`);

const body = template({ rows: [{ name: 'AccountService', status: 'Success' }] });
```

## Reusing the badge/collapsible-section styles

If your report needs the same status badges or collapsible `<details>` sections other Simply reports
use, pull in their CSS directly instead of re-writing it:

```ts
import { renderReportPage, BADGE_CSS, COLLAPSIBLE_SECTION_CSS } from '@simplysf/simply-report';

const html = renderReportPage({
  title: 'My Report',
  body,
  css: [BADGE_CSS, COLLAPSIBLE_SECTION_CSS].join('\n'),
});
```
