# 0033 — Splitting `simply-schema-core` out of `simply-schema`

**Status:** Implemented (PR #178) — published as `0.1.0` via `pnpm publish`. `simply-plugins`'
companion PR (#14) merged — this closes out round 1 (0027) entirely: all six packages' `simply-node`
and `simply-plugins` sides are done. `simply-cicd` remains explicitly out of scope.
**Package:** new `packages/simply-schema-core` (in `simply-node`); `packages/simply-schema` (CLI,
slimmed, in `simply-plugins`)
**Date:** 2026-09-02

## Problem

[0027](0027-core-extraction-round-1-post-split.md) put `simply-schema` sixth (last) in round 1.

Re-verified today (reading every file in full):

- **`common/schemaGenerateTypes.ts`** (124 lines): `IMPLEMENTED_FIELD_TYPES`,
  `FIELD_TYPES_WITHOUT_REQUIRED_PROP`, plus normalized-data types (`NormalizedFieldData`,
  `RecordTypeData`, `ObjectData`, `PicklistValueSetValue`, `PicklistValueSetDefinition`,
  `PicklistValueSettingEntry`, `PicklistValueSet`). Pure constants/types. Imports
  `./schemaGenerateUtils.js` (`BoolLike` type only).
- **`common/schemaGenerateUtils.ts`** (59 lines): `toBoolean`, `blankToUndefined`,
  `XML_BUILDER_OPTIONS`, `type BoolLike`. Pure functions/constants, no imports at all — `XML_BUILDER_OPTIONS`
  is a plain options object (not a `fast-xml-builder` import; the `XMLBuilder` constructor itself
  stays in `generate.ts`, which isn't moving).
- **`common/schemaGenerateExcelParser.ts`** (156 lines): `getObjectInfo`, `getFieldInfo`,
  `getValuesInfo`, plus `ExcelObjectInfo`/`ExcelFieldRow`/`ExcelValueRow` types. Pure `exceljs`
  worksheet parsing — no org access. Imports `./schemaGenerateUtils.js` (`toBoolean`).
- **`common/schemaReportTemplate.ts`** (305 lines): `buildSchemaReportHtml`, plus
  `SchemaRelationship`/`SchemaDiagramNode`/`SchemaDiagramEdge` types. A `vis-network` diagram +
  searchable table report, same shape as `simply-permissions-core`'s report renderer. Imports
  `@simplysf/simply-report`'s `createReportHandlebars`/`renderReportPage`.

None of the four files import `@oclif/core` or `@salesforce/sf-plugins-core`. **Zero existing test
coverage** — none of the four files has a test today (all new coverage; see Testing).

### Dependency footprint (checked outside `common/`)

| Dependency                           | Also used elsewhere in `simply-schema`?                                                                                                                                                         | Stays in `simply-schema`'s `dependencies`? |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `exceljs`                            | Yes — `generate.ts` reads the workbook                                                                                                                                                          | Yes                                        |
| `@simplysf/simply-report`            | No — only `schemaReportTemplate.ts`                                                                                                                                                             | No                                         |
| `@simplysf/simply-core`              | Yes — `visualize.ts`                                                                                                                                                                            | Yes                                        |
| `@salesforce/source-deploy-retrieve` | Yes — `visualize.ts`                                                                                                                                                                            | Yes                                        |
| `csv-parse`                          | Yes — `generate.ts` (`csv-parse/sync`)                                                                                                                                                          | Yes                                        |
| `fast-xml-builder`                   | Yes — `generate.ts` (the `XMLBuilder` class; `schemaGenerateUtils.ts`'s `XML_BUILDER_OPTIONS` is a plain object, not an import of this package)                                                 | Yes                                        |
| `handlebars`                         | Not imported directly anywhere in this package (pre-existing; `schemaReportTemplate.ts` only calls `@simplysf/simply-report`'s `createReportHandlebars()`) — unrelated to this move, left as-is | Yes (unchanged)                            |

`@simplysf/simply-report` is the only dependency that drops from `simply-schema`'s own
`package.json` — every other dependency the moved files use is also used directly by a command file
that isn't moving.

## Decision

Extract all four files verbatim into a new `simply-node` package, `@simplysf/simply-schema-core`,
following 0028–0032's recipe (0027's corrected cross-repo mechanics). `packages/simply-schema` (in
`simply-plugins`) keeps its commands and depends on the new package as a published npm dependency.

1. **New package, `packages/simply-schema-core`** (in `simply-node`). Plain library shape.
   `dependencies`: `exceljs` (`schemaGenerateExcelParser.ts`), `@simplysf/simply-report`
   (`schemaReportTemplate.ts` — `workspace:^1.0.4`, intra-repo now). No `@oclif/core`, no
   `@salesforce/sf-plugins-core`, no `@simplysf/simply-plugin-kit`, no `csv-parse`, no
   `fast-xml-builder`, no `handlebars`, no `@simplysf/simply-core`, no
   `@salesforce/source-deploy-retrieve` — confirmed by inspection none of the four moved files
   import them.
2. **Move all four files** via 0027's corrected cross-repo recipe, split from `simply-schema`'s
   pre-merge tip (`fa11b97f8ed8e5149259484597fce8bdb7cb622c` — the second parent of `b8bb92c`
   `chore: add simply-schema split history`, confirmed reachable with 5 commits touching
   `src/common`), `--prefix=src/common`.
3. **Flatten `common/`'s four files up to `src/`.** No path fixes needed this time — both internal
   references (`schemaGenerateTypes.ts` → `./schemaGenerateUtils.js`,
   `schemaGenerateExcelParser.ts` → `./schemaGenerateUtils.js`) are same-directory siblings within
   `common/` that flatten together, and `schemaReportTemplate.ts`'s only import is the external
   `@simplysf/simply-report` package (no relative import at all). This package has no `schemas/`
   subdirectory to fix cross-references into, unlike 0032.
4. **`packages/simply-schema-core/src/index.ts`** — new barrel, re-exporting everything each moved
   file already exports as public.
5. **`simply-schema` (in `simply-plugins`) depends on `simply-schema-core`** as a real semver range
   (`^0.1.0` once published). Both command files (`generate.ts`, `visualize.ts`) that import from
   `../../../common/*.js` change those specific imports to `@simplysf/simply-schema-core`.
   `@simplysf/simply-report` drops from `simply-schema`'s own `dependencies`.
6. **Document like a library**: `README.md`'s `## API` section, `CONTRIBUTING.md` stub (copy
   `simply-package-core`'s, swap the package-specific paragraph), `test/index.test.ts` asserting the
   exported-key list.
7. **Same `"exports"`/`"main"`/`"types"` fallback shape** as every prior `-core` package.

## Behavior

### `@simplysf/simply-schema-core` — new package

```ts
import { getObjectInfo, getFieldInfo, getValuesInfo } from '@simplysf/simply-schema-core';

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile('./schema.xlsx');
const objectInfo = getObjectInfo(workbook);
const fieldRows = getFieldInfo(workbook);
```

```ts
import { toBoolean, blankToUndefined } from '@simplysf/simply-schema-core';

const required = toBoolean(csvRow.Required);
const description = blankToUndefined(csvRow.Description);
```

```ts
import { buildSchemaReportHtml } from '@simplysf/simply-schema-core';

const html = buildSchemaReportHtml({ username: org.username, nodes, edges, relationships });
```

Every function's signature and return shape is unchanged from what `simply-schema`'s commands call
today — only the import specifier changes.

Full export list (barrel contents), by source file:

| File                           | Exports                                                                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaGenerateTypes.ts`       | `IMPLEMENTED_FIELD_TYPES`, `FIELD_TYPES_WITHOUT_REQUIRED_PROP`, `type NormalizedFieldData`, `type RecordTypeData`, `type ObjectData`, `type PicklistValueSetValue`, `type PicklistValueSetDefinition`, `type PicklistValueSettingEntry`, `type PicklistValueSet` |
| `schemaGenerateUtils.ts`       | `toBoolean`, `blankToUndefined`, `XML_BUILDER_OPTIONS`, `type BoolLike`                                                                                                                                                                                          |
| `schemaGenerateExcelParser.ts` | `getObjectInfo`, `getFieldInfo`, `getValuesInfo`, `type ExcelObjectInfo`, `type ExcelFieldRow`, `type ExcelValueRow`                                                                                                                                             |
| `schemaReportTemplate.ts`      | `buildSchemaReportHtml`, `type SchemaRelationship`, `type SchemaDiagramNode`, `type SchemaDiagramEdge`                                                                                                                                                           |

`package.json` shape:

```json
{
  "name": "@simplysf/simply-schema-core",
  "type": "module",
  "main": "./lib/index.js",
  "types": "./lib/index.d.ts",
  "exports": {
    ".": {
      "types": "./lib/index.d.ts",
      "default": "./lib/index.js"
    }
  },
  "dependencies": {
    "@simplysf/simply-report": "workspace:^1.0.4",
    "exceljs": "^4.4.0"
  }
}
```

No `oclif` block, no `bin/`, no `@oclif/core`, no `@salesforce/sf-plugins-core`, no
`@simplysf/simply-plugin-kit`, no `messages/`.

### `@simplysf/simply-schema` — CLI, slimmed (in `simply-plugins`)

- `generate.ts` and `visualize.ts` import from `@simplysf/simply-schema-core` instead of relative
  `common/*.js` paths.
- `package.json` gains `@simplysf/simply-schema-core: "^0.1.0"`; drops `@simplysf/simply-report`.
- `messages/`, `oclif` config, `bin/`, and command behavior are unchanged.

### Public-API test (in `simply-schema-core`)

`test/index.test.ts` asserts `Object.keys(api).sort()` against the runtime (non-type) exports, in
`Array.prototype.sort()`'s default order:
`['FIELD_TYPES_WITHOUT_REQUIRED_PROP', 'IMPLEMENTED_FIELD_TYPES', 'XML_BUILDER_OPTIONS', 'blankToUndefined', 'buildSchemaReportHtml', 'getFieldInfo', 'getObjectInfo', 'getValuesInfo', 'toBoolean']`.

## Alternatives considered

**Leave `schemaReportTemplate.ts` behind, since it's the only file of the four with an external
(non-`common/`) dependency (`@simplysf/simply-report`).** Rejected: `simply-permissions-core` and
`simply-community-core` both already established the precedent of a report-rendering file living
alongside the rest of a package's `-core` split, and there's no consumer-facing reason to split a
4-file, 644-line package into two even smaller ones over a single external dependency.

## Implementation plan

Per 0027's cross-repo recipe, using `simply-schema`'s pre-merge tip
(`fa11b97f8ed8e5149259484597fce8bdb7cb622c`):

1. **In `simply-plugins`**: `git subtree split --prefix=src/common <tip> -b split/simply-schema-core`.
2. **In `simply-node`**: subtree-add into `packages/simply-schema-core/src/common`, flatten.
3. **Scaffold the rest**: `package.json` per Behavior above; `tsconfig.json`/`test/tsconfig.json`/
   `.gitignore` (copy `simply-package-core`'s); `vitest.config.ts` participation via the root
   config's auto-discovery.
4. **Write fresh tests** for all four files — none have existing coverage (see Testing).
5. **Write `packages/simply-schema-core/src/index.ts`** — the barrel, per Behavior's export table.
6. **`packages/simply-schema-core/README.md`**/**`CONTRIBUTING.md`** — model on
   `simply-package-core`'s.
7. **`simply-node`'s `eslint.config.mjs`** — add `packages/simply-schema-core` to both
   `allPackages` and `libraryPackages`.
8. **`simply-node`'s `CONTRIBUTING.md`** — add a row to the repository structure table.
9. **`simply-node`'s `docs/design/README.md`** — add this doc's row.
10. **Open the PR against `simply-node`**, get it merged, confirm publish. Expect the same
    trusted-publisher first-publish constraint as every prior round-1 package — a one-time manual
    `pnpm publish --access public --no-git-checks` from `packages/simply-schema-core` (not plain
    `npm publish`). Also expect a `minimumReleaseAgeExclude` entry for the freshly-published version
    in `simply-plugins`' `pnpm-workspace.yaml` before its companion PR's install succeeds.
11. **In `simply-plugins`**: update `generate.ts`/`visualize.ts`'s imports, drop
    `@simplysf/simply-report` from `simply-schema`'s own `package.json`, `git rm` the four moved
    files, add this doc's duplicate to `docs/design/`.
12. **Housekeeping per `CONTRIBUTING.md`** (both repos): `pnpm run readme` in `simply-schema`;
    `pnpm run build` at each repo's root.
13. **Not a breaking change to `@simplysf/simply-schema`'s published surface** — its `index.ts` was
    already the stub. `@simplysf/simply-schema-core` starts fresh at `0.1.0`.
14. **This is the last package in round 1** — once merged/published and its companion PR is ready,
    round 1 (0027) is complete pending `simply-cicd`'s explicitly out-of-scope status.

## Testing

**Unit** — all new coverage:

- `schemaGenerateUtils.ts`: `toBoolean` (real boolean passthrough, `'true'`/`'false'` strings,
  numeric/other truthy-string coercion, `undefined`/`''` → `undefined`), `blankToUndefined` (blank
  string, non-blank string, `undefined` passthrough).
- `schemaGenerateExcelParser.ts`: `getObjectInfo` (present worksheet, missing worksheet → `{}`),
  `getFieldInfo` (header-driven column mapping, missing worksheet → `[]`, rich-text/formula/date
  cell value normalization), `getValuesInfo` (label/fullName fallback, `default` coercion,
  multi-line `controllingFieldValues` split/trim, missing worksheet → `[]`).
- `schemaReportTemplate.ts`: `buildSchemaReportHtml` (renders `username`/counts/relationship rows
  into the output HTML; asserts key structural markers rather than a full-document snapshot, per
  `simply-permissions-core`'s precedent for HTML-report tests).
- `schemaGenerateTypes.ts`: no direct test — pure constants/types, exercised transitively wherever
  `IMPLEMENTED_FIELD_TYPES`/`FIELD_TYPES_WITHOUT_REQUIRED_PROP` are asserted against in
  `schemaGenerateExcelParser.ts`'s or a future consumer's tests; nothing here has independent
  behavior to pin down.

`test/index.test.ts` per the Public-API-test section above.

**`simply-schema` command tests** — unchanged in behavior; re-run in full after the import-path
change.

**Manual verification**: not applicable — pure file-location and dependency-graph change.

## Open questions

None left for this doc — the dependency-footprint table above resolves the one question up front,
following 0032's approach of checking at design time rather than deferring to implementation.
