# 0031 — Splitting `simply-data-core` out of `simply-data`

**Status:** Implemented (PR #176) — published as `0.1.0` via `pnpm publish`. `simply-plugins`'
companion PR (#12) merged.
**Package:** new `packages/simply-data-core` (in `simply-node`); `packages/simply-data` (CLI,
slimmed, in `simply-plugins`)
**Date:** 2026-09-02

## Problem

[0027](0027-core-extraction-round-1-post-split.md) put `simply-data` fourth in round 1, with one
carve-out already decided there: `apiBudgetFlag.ts` stays behind because it defines an oclif flag
(`Flags.integer` from `@salesforce/sf-plugins-core`) alongside its budget-check helper.

Re-verified today (reading every file in `packages/simply-data/src/common/` in full):

- **`apiBudgetFlag.ts`** (stays — imports `@salesforce/sf-plugins-core`'s `Flags` and
  `Messages.loadMessages`, i.e. CLI-coupled).
- **`apiCost.ts`** (39 lines): `REQUESTS_PER_UPLOAD`, `REQUESTS_PER_DOWNLOAD`, `QUERY_BATCH_SIZE`,
  `requestsForQuery` — pure constants/arithmetic, no imports at all.
- **`contentVersionTypes.ts`** (49 lines): `ContentVersion`, `ContentVersionCreateRequest`,
  `ContentVersionCreateResult`, `ContentVersionDownload`, `ContentVersionToUpload` — pure types, no
  imports.
- **`contentVersionUtils.ts`** (144 lines): `downloadContentVersion`, `uploadContentVersion` —
  fetch-based file download/upload against a `Connection`. Imports `@salesforce/core`
  (`Connection`, `SfError`), `./multipart.js`, `./contentVersionTypes.js`.
- **`countCsvRows.ts`** (35 lines): `countCsvRows` — streaming CSV row counter. Imports `csv-parse`.
- **`multipart.ts`** (108 lines): `createBoundary`, `escapeHeaderFilename`, `contentVersionMultipart`,
  `type ContentVersionMultipart` — hand-built multipart body builder. Node built-ins only
  (`node:crypto`, `node:fs`, `node:stream`).

None of the five moving files import `@oclif/core` or `@salesforce/sf-plugins-core`; each has a
plausible non-CLI consumer (any tool doing bulk file transfer against a Salesforce org). 5 of 5 have
existing test coverage except `apiCost.ts`/`contentVersionTypes.ts` (arithmetic constants and pure
types respectively — no behavior to test beyond what a consumer's own tests already exercise).

## Decision

Extract the five files verbatim into a new `simply-node` package, `@simplysf/simply-data-core`,
following 0028's/0029's/0030's recipe (0027's corrected cross-repo mechanics). `apiBudgetFlag.ts`
stays in `packages/simply-data/src/common/` — it is not moving. `packages/simply-data` (in
`simply-plugins`) keeps its commands and `apiBudgetFlag.ts`, and depends on the new package as a
published npm dependency for the rest.

1. **New package, `packages/simply-data-core`** (in `simply-node`). Plain library shape.
   `dependencies`: `@salesforce/core` (`Connection`, `SfError` — `contentVersionUtils.ts`),
   `csv-parse` (`countCsvRows.ts`). No `@simplysf/simply-core`, no `@salesforce/kit`, no
   `@salesforce/source-deploy-retrieve`, no `xmlbuilder2`, no `glob` — confirmed by inspection that
   none of the five moved files import any of them. No `@oclif/core`, no
   `@salesforce/sf-plugins-core`, no `@simplysf/simply-plugin-kit`.
2. **Move four files, keep one behind.** `apiCost.ts`, `contentVersionTypes.ts`,
   `contentVersionUtils.ts`, `countCsvRows.ts`, `multipart.ts` move (five files — `apiBudgetFlag.ts`
   is the sixth file in `common/` and does not move). Via 0027's corrected cross-repo recipe, split
   from `simply-data`'s pre-merge tip (`6e9eb108e694483e9e1995dd1eb5749c920cc9d5` — the second parent
   of `6f8c996` `chore: add simply-data split history`, confirmed reachable with 7 commits touching
   `src/common`), `--prefix=src/common`. The split branch carries `apiBudgetFlag.ts` too (subtree
   split can't exclude a file mid-directory); drop it from the new package's tree after the
   subtree-add, before flattening — `simply-data` (in `simply-plugins`) keeps its own copy
   untouched.
3. **Relative imports unaffected by flattening**: `contentVersionUtils.ts`'s imports of
   `./multipart.js` and `./contentVersionTypes.js` are same-directory siblings within `common/` —
   flattening moves all three together (same non-bug case as 0030, not 0029's).
4. **`packages/simply-data-core/src/index.ts`** — new barrel, re-exporting everything each moved
   file already exports as public.
5. **`simply-data` (in `simply-plugins`) depends on `simply-data-core`** as a real semver range
   (`^0.1.0` once published). The three command files (`file/upload.ts`, `files/download.ts`,
   `files/upload.ts`) that import `uploadContentVersion`/`downloadContentVersion`/`countCsvRows`/
   `REQUESTS_PER_UPLOAD`/`REQUESTS_PER_DOWNLOAD`/`requestsForQuery`/`ContentVersion`/
   `ContentVersionDownload`/`ContentVersionToUpload` from `../../../../common/*.js` change those
   specific imports to `@simplysf/simply-data-core`; their `apiBudgetFlag.ts` import is unaffected
   (unmoved, same relative path). `csv-parse` drops from `simply-data`'s own `dependencies` if
   nothing else in the package imports it directly (checked at implementation time).
6. **Document like a library**: `README.md`'s `## API` section, `CONTRIBUTING.md` stub (copy
   `simply-community-core`'s, swap the package-specific paragraph), `test/index.test.ts` asserting
   the exported-key list.
7. **Same `"exports"`/`"main"`/`"types"` fallback shape** as every prior `-core` package.

## Behavior

### `@simplysf/simply-data-core` — new package

```ts
import { uploadContentVersion, downloadContentVersion } from '@simplysf/simply-data-core';

const contentVersion = await uploadContentVersion(connection, './report.pdf');
const filePath = await downloadContentVersion(connection, contentVersionDownload, './downloads');
```

```ts
import { countCsvRows } from '@simplysf/simply-data-core';

const rowCount = await countCsvRows('./records.csv');
```

```ts
import { REQUESTS_PER_UPLOAD, REQUESTS_PER_DOWNLOAD, requestsForQuery } from '@simplysf/simply-data-core';

const plannedRequests = requestsForQuery(rowCount) + rowCount * REQUESTS_PER_UPLOAD;
```

Every function's signature and return shape is unchanged from what `simply-data`'s commands call
today — only the import specifier changes.

Full export list (barrel contents), by source file:

| File                     | Exports                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiCost.ts`             | `REQUESTS_PER_UPLOAD`, `REQUESTS_PER_DOWNLOAD`, `QUERY_BATCH_SIZE`, `requestsForQuery`                                                                     |
| `contentVersionTypes.ts` | `type ContentVersion`, `type ContentVersionCreateRequest`, `type ContentVersionCreateResult`, `type ContentVersionDownload`, `type ContentVersionToUpload` |
| `contentVersionUtils.ts` | `downloadContentVersion`, `uploadContentVersion`                                                                                                           |
| `countCsvRows.ts`        | `countCsvRows`                                                                                                                                             |
| `multipart.ts`           | `createBoundary`, `escapeHeaderFilename`, `contentVersionMultipart`, `type ContentVersionMultipart`                                                        |

`package.json` shape:

```json
{
  "name": "@simplysf/simply-data-core",
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
    "csv-parse": "^7.0.2"
  }
}
```

No `oclif` block, no `bin/`, no `@oclif/core`, no `@salesforce/sf-plugins-core`, no
`@simplysf/simply-plugin-kit`, no `messages/`.

### `@simplysf/simply-data` — CLI, slimmed (in `simply-plugins`)

- `apiBudgetFlag.ts` stays exactly where it is — not part of this split.
- The three command files' imports of the five moved exports change to
  `@simplysf/simply-data-core`; their `apiBudgetFlag.ts` import is untouched.
- `package.json` gains `@simplysf/simply-data-core: "^0.1.0"`; drops `csv-parse` if nothing else in
  the package imports it directly (checked at implementation time).
- `messages/`, `oclif` config, `bin/`, and command behavior are unchanged.

### Public-API test (in `simply-data-core`)

`test/index.test.ts` asserts `Object.keys(api).sort()` against:
`['REQUESTS_PER_DOWNLOAD', 'REQUESTS_PER_UPLOAD', 'QUERY_BATCH_SIZE', 'contentVersionMultipart', 'countCsvRows', 'createBoundary', 'downloadContentVersion', 'escapeHeaderFilename', 'requestsForQuery', 'uploadContentVersion']`
(types don't appear at runtime, so they're excluded from this list; sorted per `Object.keys` order,
not the table's grouping).

## Alternatives considered

**Move `apiBudgetFlag.ts` too, splitting its flag definition from its budget-check logic.**
Rejected: 0027 already decided this file stays for exactly this reason, and re-litigating a
oclif-flag/pure-function split here would be new scope beyond what 0027 called for. A future doc
could revisit splitting `assertApiBudget` out from `apiBudgetFlags` if another package needs the
check without the flag, but nothing today needs that.

## Implementation plan

Per 0027's cross-repo recipe, using `simply-data`'s pre-merge tip
(`6e9eb108e694483e9e1995dd1eb5749c920cc9d5`):

1. **In `simply-plugins`**: `git subtree split --prefix=src/common <tip> -b split/simply-data-core`.
2. **In `simply-node`**: subtree-add into `packages/simply-data-core/src/common`, `git rm`
   `apiBudgetFlag.ts` (and its now-orphaned import of `@salesforce/sf-plugins-core`/messages
   directory reference, if any leaked in), flatten the remaining four files up one level.
3. **Scaffold the rest**: `package.json` per Behavior above; `tsconfig.json`/`test/tsconfig.json`/
   `.gitignore` (copy `simply-community-core`'s); `vitest.config.ts` participation via the root
   config's auto-discovery.
4. **Move existing tests**: `contentVersionUtils.test.ts`, `countCsvRows.test.ts`,
   `multipart.test.ts` (shortened relative imports by one directory level, same as 0030's non-bug
   case). No test to move for `apiCost.ts`/`contentVersionTypes.ts` (no prior coverage — pure
   constants/types).
5. **Write `packages/simply-data-core/src/index.ts`** — the barrel, per Behavior's export table.
6. **`packages/simply-data-core/README.md`**/**`CONTRIBUTING.md`** — model on
   `simply-community-core`'s.
7. **`simply-node`'s `eslint.config.mjs`** — add `packages/simply-data-core` to both `allPackages`
   and `libraryPackages`.
8. **`simply-node`'s `CONTRIBUTING.md`** — add a row to the repository structure table.
9. **`simply-node`'s `docs/design/README.md`** — add this doc's row.
10. **Open the PR against `simply-node`**, get it merged, confirm publish. Expect the same
    trusted-publisher first-publish constraint as 0028/0029/0030 — a one-time manual
    `pnpm publish --access public --no-git-checks` from `packages/simply-data-core` (not plain
    `npm publish`). Also expect a `minimumReleaseAgeExclude` entry for the freshly-published version
    in `simply-plugins`' `pnpm-workspace.yaml` before its companion PR's install succeeds.
11. **In `simply-plugins`**: update the three command files' imports (leave `apiBudgetFlag.ts`'s
    import alone), resolve whether `csv-parse` drops from `simply-data`'s own `package.json` by
    grepping for it outside `common/`, `git rm` the four moved files (not `apiBudgetFlag.ts`),
    update `package.json`, add this doc's duplicate to `docs/design/`.
12. **Housekeeping per `CONTRIBUTING.md`** (both repos): `pnpm run readme` in `simply-data`;
    `pnpm run build` at each repo's root.
13. **Not a breaking change to `@simplysf/simply-data`'s published surface** —
    `@simplysf/simply-data-core` starts fresh at `0.1.0`.

## Testing

**Unit** — move the three existing test files as-is (shortened relative imports).
`test/index.test.ts` per the Public-API-test section above.

**`simply-data` command tests** — unchanged in behavior; re-run in full after the import-path
change.

**Manual verification**: not applicable — pure file-location and dependency-graph change.

## Open questions

None left for this doc — the one deliberately deferred question (whether `csv-parse` also drops
from `simply-data`'s own `package.json`) is Implementation-plan work, not a design decision.
