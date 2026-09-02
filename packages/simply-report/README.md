# @simplysf/simply-report

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-report?label=@simplysf/simply-report)](https://npmjs.com/@simplysf/simply-report) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-report.svg)](https://npmjs.com/@simplysf/simply-report) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

Shared HTML report scaffolding for [`@simplysf`](https://github.com/SimplySF/simply-node) Salesforce CLI plugins. This is not a Salesforce CLI plugin itself — it's a plain library consumed by the other packages in this monorepo.

Several commands emit a standalone HTML report. This package holds the parts they all need — the page shell, the base stylesheet, and a Handlebars environment — so each report only has to supply its own body and any CSS specific to it.

Currently consumed by [`@simplysf/simply-permissions`](https://github.com/SimplySF/simply-plugins/tree/main/packages/simply-permissions), [`@simplysf/simply-schema`](https://github.com/SimplySF/simply-plugins/tree/main/packages/simply-schema), and [`@simplysf/simply-sobject`](https://github.com/SimplySF/simply-plugins/tree/main/packages/simply-sobject).

## Install

```bash
npm install @simplysf/simply-report
```

## Usage

```ts
import { createReportHandlebars, renderReportPage, BADGE_CSS } from '@simplysf/simply-report';

const handlebars = createReportHandlebars();
const template = handlebars.compile('<h1>{{title}}</h1><span class="badge">{{count}}</span>');

const html = renderReportPage({
  title: 'Permissions Report',
  body: template({ title: 'Permissions Report', count: 42 }),
  css: BADGE_CSS,
});
```

## API

| Export                      | Description                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `renderReportPage(options)` | Wraps a body in the shared page shell — doctype, `<head>`, and the base stylesheet — and returns the complete HTML document. |
| `ReportPageOptions`         | Options for `renderReportPage`: `title`, `body`, and optional `maxWidth` (defaults to `1200px`), `css`, and `head`.          |
| `createReportHandlebars()`  | Returns a fresh Handlebars environment with the helpers reports want (currently `eq`, for branching inside a template).      |
| `COLLAPSIBLE_SECTION_CSS`   | Styles for the card/`<details>` disclosure pattern shared by the reports that group their output into expandable sections.   |
| `BADGE_CSS`                 | Styles for the inline `.badge` pill.                                                                                         |

`css` is appended _after_ the base rules, so a report can extend or override them. The two exported CSS constants are opt-in — pass whichever a given report needs, concatenated.

## A note on escaping

`createReportHandlebars()` returns an isolated environment per report rather than a shared one, so a partial registered by one report can't leak into another.

Report data comes from a Salesforce org and is not trusted markup. Handlebars auto-escapes `{{expression}}`, so templates compiled here don't need a hand-rolled `escapeHtml()`. Use the triple-brace `{{{expression}}}` form only for markup you generated yourself.

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See [CONTRIBUTING.md](CONTRIBUTING.md) for what's specific to this package, and the repo's [root CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for repo structure, setup, commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt) license.
