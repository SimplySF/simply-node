# 0020 — Splitting `simply-document-core` out of `simply-document`

**Status:** Draft
**Package:** new `packages/simply-document-core`; `packages/simply-document` (CLI, slimmed)
**Date:** 2026-08-30

## Problem

[0019](0019-plugin-core-library-extraction.md) picked `simply-document` as the first plugin to apply the
`simply-aep-core` recipe to: its `src/common/` holds exactly two files —
`changeReportTemplate.ts` (`buildChangeReportHtml`, used by `simply document diff`) and
`technicalDesignDocumentTemplate.ts` (`buildTechnicalDesignDocumentHtml`, used by `simply document
generate`) — and neither imports anything beyond `handlebars`. Both render a Confluence-storage-format XHTML
document from a plain data object; a caller who has already scanned a project's metadata some other way (a
script, a CI job, an editor extension) currently has no way to reuse that rendering without invoking the
CLI command end to end. This is the smallest and lowest-risk of the candidates 0019 identified, and is
being done first to prove the recipe generalizes beyond AT4DX before tackling a larger package.

## Decision

Extract `packages/simply-document/src/common/*` verbatim into a new package, `@simplysf/simply-document-core`,
following 0009's template exactly. `packages/simply-document` keeps its two commands and depends on
`simply-document-core` like any other workspace dependency.

Concretely:

1. **New package, `packages/simply-document-core`.** Plain library shape modeled on
   `packages/simply-aep-core`: no `oclif` block, no `bin/`, no `messages/`. `dependencies`: only
   `handlebars` (the only import either moved file has) — confirmed by inspection, neither file touches
   `@salesforce/core`, `@salesforce/source-deploy-retrieve`, or `@simplysf/simply-core` (unlike
   `simply-document` itself, which depends on the first two for its command layer only).
2. **Move the two files as-is** — `git mv packages/simply-document/src/common/changeReportTemplate.ts
packages/simply-document-core/src/changeReportTemplate.ts` (and the same for
   `technicalDesignDocumentTemplate.ts`) — no relative imports between them to fix (each is self-contained).
3. **`packages/simply-document-core/src/index.ts`** — new barrel (this package never had one; `common/`
   was reached via direct relative imports from the two command files), re-exporting:
   - `buildChangeReportHtml`, `type ChangeEntry`, `type ChangesByComponentType` from
     `./changeReportTemplate.js`
   - `buildTechnicalDesignDocumentHtml`, `type TechnicalDesignDocumentData`, and the ~25 supporting item
     types (`RecordTypeItem`, `LayoutItem`, `CustomFieldItem`, `FieldSetItem`, `ValidationRuleItem`,
     `ObjectItem`, `GroupItem`, `QueueItem`, ... — the full list `technicalDesignDocumentTemplate.ts`
     exports today) from `./technicalDesignDocumentTemplate.js`

   With the same header comment convention as `simply-aep-core/src/index.ts`: everything here is
   semver-covered public API.

4. **`simply-document` depends on `simply-document-core`** (`workspace:^0.1.0`). `src/commands/simply/
document/diff.ts` and `.../generate.ts` change their import from `../../../common/*.js` to
   `@simplysf/simply-document-core`. `src/index.ts` is already the standard stub — no change needed there.
   No dependency drops from `simply-document`'s own `package.json`: `handlebars` stays (nothing else in
   `simply-document` uses it today, but removing it isn't required by this move and isn't verified safe
   without re-checking — leaving it is the conservative call, revisit only if a future change removes the
   last other use, if any surfaces).
5. **Document like a library**: `README.md`'s `## API` section (import snippet + one row per exported
   function, modeled on `simply-aep-core/README.md`'s tables), `CONTRIBUTING.md` stub (copy
   `simply-aep-core/CONTRIBUTING.md`, swap the package-specific paragraph), `test/index.test.ts` asserting
   the exported-key list.
6. **Same `"exports"`/`"main"`/`"types"` fallback shape** as `simply-aep-core/package.json` for classic
   `moduleResolution` consumers.

## Behavior

### `@simplysf/simply-document-core` — new package

```ts
import { buildChangeReportHtml, type ChangeEntry, type ChangesByComponentType } from '@simplysf/simply-document-core';

const html = buildChangeReportHtml({
  apexClasses: [
    {
      componentName: 'AccountService',
      componentType: 'ApexClass',
      changeType: 'Added',
      changeDescription: '',
      path: 'force-app/main/default/classes/AccountService.cls',
    },
  ],
});
```

```ts
import { buildTechnicalDesignDocumentHtml, type TechnicalDesignDocumentData } from '@simplysf/simply-document-core';

const html = buildTechnicalDesignDocumentHtml(scannedProjectData);
```

Both functions' signatures, return shapes, and optional `customTemplateSource` override parameter are
unchanged from what `simply-document`'s commands call today — only the import specifier changes.

`package.json` shape (modeled on `simply-aep-core`'s, see 0009's Behavior section for the full annotated
version):

```json
{
  "name": "@simplysf/simply-document-core",
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
    "handlebars": "^4.7.9"
  }
}
```

No `oclif` block, no `bin/`, no `@oclif/core`, no `@salesforce/sf-plugins-core`, no `@salesforce/core`, no
`messages/`.

### `@simplysf/simply-document` — CLI, slimmed

- `src/commands/simply/document/diff.ts` and `.../generate.ts` import the render functions and their types
  from `@simplysf/simply-document-core` instead of `../../../common/*.js`.
- `package.json` gains `@simplysf/simply-document-core: workspace:^0.1.0`.
- `messages/`, `oclif` config, `bin/`, and command behavior are unchanged.

### Public-API test (in `simply-document-core`)

`test/index.test.ts` imports the barrel as a namespace and asserts `Object.keys(api).sort()` against an
explicit literal array containing the two functions (types are erased at runtime and aren't in this list —
same caveat `simply-aep-core`'s test documents).

## Alternatives considered

**Leave the two template files where they are and just add a README `## API` section documenting the
existing relative-import path.** Rejected: nothing outside `simply-document` can import a path under
another package's `src/`, and `common/`'s files aren't re-exported from `simply-document`'s `index.ts`
today (it's the standard stub) — there is no importable surface to document without moving the code.

**Fold this into `@simplysf/simply-report`** (the existing shared HTML-report-scaffolding library used by
`simply-permissions`, `simply-schema`, and `simply-sobject`). Rejected: `simply-report`'s current consumers
use it for its generic scaffolding, not Salesforce-metadata-shaped Handlebars templates; these two functions
are `simply-document`-specific domain logic (the exact XHTML shape a Confluence change/design page expects),
not general report infrastructure. Same reasoning 0009 gave for rejecting folding `simply-aep-core` into
`simply-core`.

## Implementation plan

1. **Scaffold `packages/simply-document-core`** — `package.json` per Behavior above; `tsconfig.json`
   (`extends: "../../tsconfig.json"`, `outDir: "lib"`, `rootDir: "src"`, matching `simply-aep-core`'s);
   `.gitignore` (copy `simply-aep-core`'s); `vitest.config.ts` participation via the root config's
   auto-discovery (no change needed there — verified it globs `packages/*`).
2. **Move source files**: `git mv packages/simply-document/src/common/changeReportTemplate.ts
packages/simply-document-core/src/changeReportTemplate.ts`, same for
   `technicalDesignDocumentTemplate.ts`. No import-path fixes needed (neither imports the other).
3. **Write `packages/simply-document-core/src/index.ts`** — the barrel, per Behavior above, with the
   standard semver-policy header comment.
4. **No test files to move** — `simply-document` has zero existing tests under `test/**/common/**` (verified
   by inspection); the moved functions are currently exercised only indirectly through
   `test/commands/simply/document/{diff,generate}.test.ts`. Add fresh unit tests for both render functions
   in `packages/simply-document-core/test/` (there were none before, so this is new coverage, not a move) —
   at minimum one snapshot-style test per function with a small representative `data`/`changes` object, plus
   the custom-template-override path.
5. **`packages/simply-document-core/README.md`** — model on `simply-aep-core/README.md`: `## API` section
   with the two import snippets from Behavior above, `## Install`, `## Issues`, `## Contributing`.
6. **`packages/simply-document-core/CONTRIBUTING.md`** — copy `simply-aep-core/CONTRIBUTING.md`, replacing
   the package-specific paragraph.
7. **Update `packages/simply-document`**:
   - `src/commands/simply/document/diff.ts` and `.../generate.ts` — change imports to
     `@simplysf/simply-document-core`.
   - `package.json` — add `@simplysf/simply-document-core: workspace:^0.1.0` to `dependencies`.
   - `README.md` — no `## API` section existed before (this package's README was already pure command
     reference); no change needed there beyond the standard `pnpm run readme` regeneration check.
8. **`CONTRIBUTING.md`** — add a `simply-document-core` row to the repository-structure table, phrased like
   the `simply-aep-core` row (externally-consumable, not purely internal).
9. **`docs/design/README.md`** — add this doc's row to the index table (already added as part of landing
   0019; update its `Status` here when this doc itself is agreed).
10. **Housekeeping per `CLAUDE.md`**: `pnpm run readme` in `packages/simply-document` (confirms no `## API`
    section leaks back in); `pnpm run build` at the root, which builds `simply-document-core` before
    `simply-document` (Lerna respects workspace-dependency order) and regenerates
    `command-snapshot.json` for `simply-document` and the bundled `packages/simply`.
11. **Not a breaking change to `@simplysf/simply-document`'s published surface** — unlike 0009's
    `simply-aep`, `simply-document`'s `index.ts` was already the stub, so this move changes nothing an
    external consumer could have been depending on. `@simplysf/simply-document-core` starts fresh at
    `0.1.0`; no `BREAKING CHANGE:` footer needed on `simply-document`'s own commit.

## Testing

**Unit** — new `packages/simply-document-core/test/{changeReportTemplate,technicalDesignDocumentTemplate,
index}.test.ts` per step 4 above (no existing common-level tests to move, since none existed).

**`simply-document` command tests** (`test/commands/simply/document/{diff,generate}.test.ts`) — unchanged in
behavior; they continue to exercise the render functions through the command layer even though those
functions now live in a workspace dependency.

**Manual verification**: run `sf simply document diff` and `sf simply document generate` against a sample
project locally after the move and confirm the rendered HTML is byte-identical to a pre-move run (the move
changes only where the code lives, not what it does).

## Open questions

None — this is the smallest and most self-contained of the packages 0019 identified as candidates, and its
implementation plan above is complete enough to execute directly.
