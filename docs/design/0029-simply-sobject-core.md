# 0029 — Splitting `simply-sobject-core` out of `simply-sobject`

**Status:** Draft
**Package:** new `packages/simply-sobject-core` (in `simply-node`); `packages/simply-sobject` (CLI,
slimmed, in `simply-plugins`)
**Date:** 2026-09-02

## Problem

[0019](0019-plugin-core-library-extraction.md) marked `simply-sobject` a **candidate**, tied with
`simply-permissions` for round 1's first slot (0028, done). Re-verified today (reading every file in
full):

- **`common/fieldHistory.ts`** (176 lines): `getHistoryObjectName`, `getParentIdField`,
  `buildWhereClause`, `recordMatchesClientFilters` — pure functions deriving field-history object
  names and evaluating a filter tree against SOQL/client-side conditions. No org access, no flags.
- **`common/fieldHistorySchemaReportTemplate.ts`** (117 lines): `buildFieldHistorySchemaReportHtml` —
  pure, renders a field-history-tracking report via `@simplysf/simply-report`. No existing test
  (0019's "light coverage" undersold this one too).
- **`common/relationshipFields.ts`** (65 lines): `discoverRelationshipFields` — takes a `Connection`
  and describe-result fields, returns expandable relationship paths. The one moved function that
  does touch an org (via `Connection#describe`), but takes the connection as a plain argument like
  every other `-core` function that needs one (`simply-apex-core`'s `executeApex`, `simply-aep-core`'s
  `scanOrgBindings`) — not a CLI/flag concern.

**One wrinkle 0019 didn't surface**: `fieldHistory.ts` imports `FilterCondition`/`FilterGroup` types
from `../schemas/history/filterConfig.ts` — a zod schema file _outside_ `common/`, also imported
directly by the CLI command `commands/simply/sobject/history/query.ts` (for parsing the `--filter`
flag's JSON input via `FilterConfigSchema`). Nothing in `filterConfig.ts` touches `@oclif/core` or
`@salesforce/sf-plugins-core` either — it's pure zod — so it moves too, following the same
`schemas/`-subdirectory precedent `simply-apex-core` already set for `classesToSilence.ts` (0023).
`schemas/deduplicate/deduplicateConfig.ts` (the package's other schema file) is unrelated — used only
by `commands/simply/sobject/deduplicate.ts`, nothing in `common/` touches it — so it stays behind.

## Decision

Extract `packages/simply-sobject/src/common/*` **and** `packages/simply-sobject/src/schemas/history/filterConfig.ts`
verbatim into a new `simply-node` package, `@simplysf/simply-sobject-core`, following 0028's
now-twice-proven recipe (corrected cross-repo mechanics from 0027). `packages/simply-sobject` (in
`simply-plugins`) keeps its commands and depends on the new package as a published npm dependency.

1. **New package, `packages/simply-sobject-core`** (in `simply-node`). Plain library shape modeled
   on `simply-permissions-core`/`simply-apex-core`: no `oclif` block, no `bin/`, no `messages/`.
   `dependencies`: `@salesforce/core` (`Connection` type, `relationshipFields.ts`'s only import),
   `@simplysf/simply-report` (`workspace:^1.0.4` — intra-repo now), `zod` (the moved
   `filterConfig.ts` schema). No `@oclif/core`, no `@salesforce/sf-plugins-core`, no
   `@simplysf/simply-plugin-kit`, no `@simplysf/simply-core` — confirmed by inspection that none of
   the four moved files imports any of them.
2. **Move the four files** via 0027's corrected cross-repo recipe (split from the pre-merge tip,
   `5f1ebd843e811b147e8dbc5976d0803bd16447bf` — `simply-sobject`'s own second parent off
   `chore: add simply-sobject split history`, confirmed reachable with 6 commits touching
   `src/common` and 3 touching `src/schemas/history`):
   - `git subtree split --prefix=src/common <tip> -b split/simply-sobject-core-common`, subtree-add
     into `packages/simply-sobject-core/src/common`, then flatten (`git mv .../common/* ...src/`) —
     matching every prior `-core` package's flat `src/`.
   - `git subtree split --prefix=src/schemas/history <tip> -b split/simply-sobject-core-schemas`,
     subtree-add into `packages/simply-sobject-core/src/schemas/history` — **not** flattened, kept
     in its own `schemas/` subdirectory, matching `simply-apex-core`'s `schemas/classesToSilence.ts`
     precedent (0023). **Correction, caught by the build's lint step**: `fieldHistory.ts`'s import
     of `filterConfig.js` _does_ need a path fix — flattening `common/` moves `fieldHistory.ts` up
     one level relative to `schemas/`, so `../schemas/history/filterConfig.js` (correct from
     `common/`) must become `./schemas/history/filterConfig.js` (correct from the flattened `src/`).
     Left unfixed, TypeScript can't resolve the import at all, which ESLint's type-aware rules
     report as 33 unrelated-looking `no-unsafe-*`/`no-redundant-type-constituents` errors on every
     line that touches a `FilterGroup`/`FilterCondition`-typed value — worth remembering as the
     signature of an unresolved import, not a real type problem, if this recurs.
3. **`packages/simply-sobject-core/src/index.ts`** — new barrel, re-exporting everything each moved
   file already exports as public. Same semver-policy header comment convention as every prior
   `-core` package's `index.ts`.
4. **`simply-sobject` (in `simply-plugins`) depends on `simply-sobject-core`** as a real semver
   range (`^0.1.0` once published). The command files that import from `../../common/*.js` or
   `../../../schemas/history/filterConfig.js` (`history/query.ts` specifically, for
   `FilterConfigSchema`/`FilterConfig`) change to `@simplysf/simply-sobject-core`. `zod` **stays**
   in `simply-sobject`'s own `dependencies` — confirmed by inspection that
   `schemas/deduplicate/deduplicateConfig.ts` (which stays behind) also imports it directly.
5. **Document like a library**: `README.md`'s `## API` section, `CONTRIBUTING.md` stub (copy
   `simply-permissions-core`'s, swap the package-specific paragraph), `test/index.test.ts` asserting
   the exported-key list.
6. **Same `"exports"`/`"main"`/`"types"` fallback shape** as every prior `-core` package's
   `package.json`.

## Behavior

### `@simplysf/simply-sobject-core` — new package

```ts
import { getHistoryObjectName, getParentIdField } from '@simplysf/simply-sobject-core';

getHistoryObjectName('Opportunity'); // 'OpportunityFieldHistory'
getHistoryObjectName('My_Object__c'); // 'My_Object__History'
```

```ts
import { buildWhereClause, recordMatchesClientFilters, type FilterConfig } from '@simplysf/simply-sobject-core';

const filter: FilterConfig = { logic: 'AND', filters: [{ field: 'Field__c', operator: '=', value: 'X' }] };
const whereClause = buildWhereClause(filter, 'AccountId', new Set(['AccountId', 'CreatedDate']));
```

```ts
import { discoverRelationshipFields } from '@simplysf/simply-sobject-core';

const describeResult = await connection.describe('Account');
const paths = await discoverRelationshipFields(connection, describeResult.fields);
```

```ts
import { buildFieldHistorySchemaReportHtml } from '@simplysf/simply-sobject-core';

const html = buildFieldHistorySchemaReportHtml({
  username: 'user@example.com',
  reportDate: new Date().toISOString(),
  groupedData: new Map(),
});
```

Every function's signature and return shape is unchanged from what `simply-sobject`'s commands call
today — only the import specifier changes.

Full export list (barrel contents), by source file:

| File                                  | Exports                                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `fieldHistory.ts`                     | `getHistoryObjectName`, `getParentIdField`, `buildWhereClause`, `recordMatchesClientFilters`                                        |
| `fieldHistorySchemaReportTemplate.ts` | `buildFieldHistorySchemaReportHtml`, `type FieldHistorySchemaEntry`, `type GroupedFieldHistorySchemaData`                           |
| `relationshipFields.ts`               | `discoverRelationshipFields`                                                                                                        |
| `schemas/history/filterConfig.ts`     | `FilterConditionSchema`, `FilterGroupSchema`, `FilterConfigSchema`, `type FilterCondition`, `type FilterGroup`, `type FilterConfig` |

`package.json` shape:

```json
{
  "name": "@simplysf/simply-sobject-core",
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
    "@salesforce/core": "^8.30.0",
    "@simplysf/simply-report": "workspace:^1.0.4",
    "zod": "^4.1.12"
  }
}
```

No `oclif` block, no `bin/`, no `@oclif/core`, no `@salesforce/sf-plugins-core`, no
`@simplysf/simply-plugin-kit`, no `@simplysf/simply-core`, no `messages/`.

### `@simplysf/simply-sobject` — CLI, slimmed (in `simply-plugins`)

- Command files import from `@simplysf/simply-sobject-core` instead of relative `common/*.js` /
  `schemas/history/filterConfig.js` paths.
- `package.json` gains `@simplysf/simply-sobject-core: "^0.1.0"`; keeps `zod`
  (`schemas/deduplicate/deduplicateConfig.ts` still needs it).
- `messages/`, `oclif` config, `bin/`, and command behavior are unchanged.

### Public-API test (in `simply-sobject-core`)

`test/index.test.ts` asserts `Object.keys(api).sort()` against:
`['FilterConditionSchema', 'FilterConfigSchema', 'FilterGroupSchema', 'buildFieldHistorySchemaReportHtml', 'buildWhereClause', 'discoverRelationshipFields', 'getHistoryObjectName', 'getParentIdField', 'recordMatchesClientFilters']`.

## Alternatives considered

**Leave `filterConfig.ts` behind in `simply-sobject`, and have `simply-sobject-core` import the
`FilterCondition`/`FilterGroup` types from the CLI package.** Rejected: that would make the new
library depend on the CLI package it's supposed to be independent of — exactly backwards, and
impossible besides once they're in different repos with no workspace link. The schema has to live
wherever `fieldHistory.ts` lives, which is `simply-sobject-core`.

**Fold `filterConfig.ts` into `common/` instead of keeping its own `schemas/` subdirectory.**
Rejected for consistency with `simply-apex-core`'s established `schemas/classesToSilence.ts`
precedent (0023) — a schema file is conceptually distinct from the functions that consume it, and
the relative-import fix needed either way (see the correction above) is a one-line change regardless
of which layout is chosen.

## Implementation plan

Per 0027's (corrected) cross-repo recipe, using `simply-sobject`'s pre-merge tip
(`5f1ebd843e811b147e8dbc5976d0803bd16447bf`):

1. **In `simply-plugins`**: two subtree splits from that tip — `--prefix=src/common -b
split/simply-sobject-core-common` and `--prefix=src/schemas/history -b
split/simply-sobject-core-schemas`.
2. **In `simply-node`**: subtree-add both into `packages/simply-sobject-core` (`src/common`, then
   flattened; `src/schemas/history`, kept as-is).
3. **Scaffold the rest**: `package.json` per Behavior above; `tsconfig.json`/`test/tsconfig.json`
   (copy `simply-permissions-core`'s — note 0028 needed the `test/tsconfig.json` copy explicitly,
   it's easy to miss); `.gitignore` (copy `simply-permissions-core`'s); `vitest.config.ts`
   participation via the root config's auto-discovery.
4. **Move existing tests**: `git mv` (or recreate, shortening relative imports by one directory
   level) `test/common/fieldHistory.test.ts`, `test/common/relationshipFields.test.ts`,
   `test/schemas/history/filterConfig.test.ts` from `simply-plugins` — these came along with the
   subtree splits above (test/ wasn't included in either split's prefix, so they need a separate
   move, same as 0023's `apexTraceSilence.test.ts`/`apexTraceSetup.test.ts` handling). Add fresh
   coverage for `fieldHistorySchemaReportTemplate.ts` — no existing test to move.
5. **Write `packages/simply-sobject-core/src/index.ts`** — the barrel, per Behavior's export table.
6. **`packages/simply-sobject-core/README.md`**/**`CONTRIBUTING.md`** — model on
   `simply-permissions-core`'s.
7. **`simply-node`'s `eslint.config.mjs`** — add `packages/simply-sobject-core` to both
   `allPackages` and `libraryPackages`.
8. **`simply-node`'s `CONTRIBUTING.md`** — add a row to the repository structure table.
9. **`simply-node`'s `docs/design/README.md`** — add this doc's row.
10. **Open the PR against `simply-node`**, get it merged, confirm publish. Given 0028 hit npm's
    trusted-publisher constraint (a brand-new package's very first publish can't go through CI's
    OIDC token — see 0028's own follow-up), expect the same here: after the version/tag lands via
    `release.yml`, a one-time manual `npm publish --access public` from `packages/simply-sobject-core`
    is needed before the package exists on the registry. Every version after that publishes
    normally through CI.
11. **In `simply-plugins`**: update `packages/simply-sobject`'s command files' imports (`common/*`
    call sites, plus `history/query.ts`'s `filterConfig` import), `git rm` the moved files,
    update `package.json` (`@simplysf/simply-sobject-core: "^<published-version>"`, keep `zod`),
    add this doc's duplicate to `docs/design/`.
12. **Housekeeping per `CONTRIBUTING.md`** (both repos): `pnpm run readme` in `simply-sobject`;
    `pnpm run build` at each repo's root.
13. **Not a breaking change to `@simplysf/simply-sobject`'s published surface** — its `index.ts` was
    already the stub. `@simplysf/simply-sobject-core` starts fresh at `0.1.0`.

## Testing

**Unit** — move `fieldHistory.test.ts`, `relationshipFields.test.ts`, `filterConfig.test.ts` as-is
(shortened relative imports). New tests for `buildFieldHistorySchemaReportHtml`: empty
`groupedData`, a single package with tracked fields (covering the namespace-badge
`{{#unless (eq managedPackageNamespace "N/A")}}` conditional), and multiple packages (covering the
sort-by-key ordering and `fieldCount` total). `test/index.test.ts` per the Public-API-test section.

**`simply-sobject` command tests** — unchanged in behavior; re-run in full after the import-path
change.

**Manual verification**: not applicable — pure file-location and dependency-graph change.

## Open questions

None — checked at doc-writing time (see Decision step 4): `zod` stays in `simply-sobject`'s own
`dependencies` since `schemas/deduplicate/deduplicateConfig.ts` also imports it directly.
