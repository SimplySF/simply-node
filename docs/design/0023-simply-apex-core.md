# 0023 — Splitting `simply-apex-core` out of `simply-apex`

**Status:** Draft
**Package:** new `packages/simply-apex-core`; `packages/simply-apex` (CLI, slimmed)
**Date:** 2026-09-01

## Problem

[0019](0019-plugin-core-library-extraction.md) marked `simply-apex` **"Not applicable yet"** for a
`-core` split: at the time, all four of its commands (`execute`, `logs purge`, `trace setup`,
`trace silence`) had their org-interacting logic inlined directly into `run()`, with no
CLI-independent module to extract — 0019's first candidacy criterion ("CLI-independent logic
already exists as a distinct module") wasn't met.

A prior, unnumbered refactor (PR #159) closed that gap: it moved each command's logic into
`packages/simply-apex/src/common/` (`apexExecute.ts`, `apexLogsPurge.ts`, `apexTraceSetup.ts`,
`apexTraceSilence.ts`, plus the `classesToSilence` Zod schema), following the same core/CLI
error-boundary pattern `simply-aep` already established (typed `*Error` classes carrying a
structural `code`, mapped to the CLI's own `Messages` catalog at the command layer). That refactor
was scoped as pure internal restructuring — zero flag/output/error-text changes, so it needed no
design doc of its own per `CLAUDE.md`'s "refactors that keep the public surface identical" carve-out
— but it was explicitly done to make this doc possible: `simply-apex` now meets all three of 0019's
candidacy criteria (a distinct `common/` module exists; none of it imports `@oclif/core` or
`@salesforce/sf-plugins-core`, verified by inspection; each function has a plausible non-CLI
consumer — "execute this Apex file and get the result," "purge these logs," "configure a trace flag
for this user," "silence debug output for these classes" are all things a script, CI job, or editor
extension could want without shelling out to the CLI).

## Decision

Extract `packages/simply-apex/src/common/*` verbatim into a new package,
`@simplysf/simply-apex-core`, following 0009's/0020's template. `packages/simply-apex` keeps its
four commands and depends on `simply-apex-core` like any other workspace dependency.

Concretely:

1. **New package, `packages/simply-apex-core`.** Plain library shape modeled on
   `simply-aep-core`/`simply-document-core`: no `oclif` block, no `bin/`, no `messages/`.
   `dependencies`: `@salesforce/core` (the `Connection` type everywhere, and `ExecuteService` from
   `@salesforce/apex-node` needs the real class — not a narrowed structural type the way
   `simply-aep-core`'s `AepConnection` narrows `Connection` for its scan functions, since
   `@salesforce/apex-node` isn't guaranteed to only touch the subset a `Pick<>` would expose),
   `@salesforce/apex-node` (`ExecuteService`, `execute.ts`'s only consumer), `@simplysf/simply-core`
   (`chunk`, `escapeSoqlLiteral`, `loadJsonConfigSync` — already a real dependency, not narrowed),
   `zod` (the moved schema). No `@oclif/core`, no `@salesforce/sf-plugins-core`, no
   `@simplysf/simply-plugin-kit` — confirmed by inspection that no moved file imports any of them.
2. **Move the five files as-is** — `git mv packages/simply-apex/src/common/apexExecute.ts
packages/simply-apex-core/src/apexExecute.ts` (same for `apexLogsPurge.ts`,
   `apexTraceSetup.ts`, `apexTraceSilence.ts`), and `git mv
packages/simply-apex/src/common/schemas/classesToSilence.ts
packages/simply-apex-core/src/schemas/classesToSilence.ts` (kept in its own `schemas/`
   subdirectory, matching how `apexTraceSilence.ts` already imports it via a relative
   `./schemas/classesToSilence.js` path today — no import fix needed beyond the directory move
   itself, since the relative path between the two files doesn't change).
3. **`packages/simply-apex-core/src/index.ts`** — new barrel (this package never had one;
   `common/` was reached via direct relative imports from the four command files), re-exporting
   everything each moved file already exports as public (nothing currently private — like
   `findTraceTargetUserId`/`findOrCreateDebugLevel`/`findOrUpdateTraceFlag` in `apexTraceSetup.ts`
   — becomes newly public; see Behavior for the full list). Same semver-policy header comment
   convention as `simply-aep-core`/`simply-document-core`'s `index.ts`.
4. **`simply-apex` depends on `simply-apex-core`** (`workspace:^0.1.0`). The four command files
   change their imports from `../../../common/*.js` (or `../../../../common/*.js` for the two
   nested under `logs/`/`trace/`) to `@simplysf/simply-apex-core`. `@salesforce/apex-node` and
   `zod` drop from `simply-apex`'s own `dependencies` — confirmed by inspection that nothing
   outside the four moved files imports either directly. `@salesforce/core` stays (used directly
   by `requireConnection`'s return type and elsewhere in the CLI layer). `src/index.ts` is already
   the standard stub — no change needed there.
5. **Document like a library**: `README.md`'s `## API` section (import snippet + one row per
   exported function/type, modeled on `simply-aep-core/README.md`'s tables), `CONTRIBUTING.md` stub
   (copy `simply-aep-core/CONTRIBUTING.md`, swap the package-specific paragraph), `test/index.test.ts`
   asserting the exported-key list.
6. **Same `"exports"`/`"main"`/`"types"` fallback shape** as `simply-aep-core/package.json` for
   classic `moduleResolution` consumers.

## Behavior

### `@simplysf/simply-apex-core` — new package

```ts
import { executeApex, ApexExecuteError } from '@simplysf/simply-apex-core';

const result = await executeApex(connection, 'scripts/apex/data-fix.apex');
```

```ts
import { queryApexLogIdsViaRest, deleteApexLogsViaCollections } from '@simplysf/simply-apex-core';

const logIds = await queryApexLogIdsViaRest(connection, 'SELECT Id FROM ApexLog');
const results = await deleteApexLogsViaCollections(connection, logIds);
```

```ts
import { setupApexTrace } from '@simplysf/simply-apex-core';

const result = await setupApexTrace(connection, { onBehalfOf: { field: 'Username', value: 'someuser@example.com' } });
```

```ts
import { resolveClasses, silenceApexClasses } from '@simplysf/simply-apex-core';

const classes = resolveClasses(['NoisyClass'], undefined, { fflib: true, at4dx: false, forceDi: false });
const outcome = await silenceApexClasses(connection, classes);
```

Every function's signature and return/throw shape is unchanged from what `simply-apex`'s commands
call today (PR #159 already established these — this doc only relocates them) — only the import
specifier changes.

Full export list (barrel contents), by source file:

| File                          | Exports                                                                                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apexExecute.ts`              | `executeApex`, `ApexExecuteError`, `type ApexExecuteResult`, `type ApexExecuteErrorCode`                                                                                                                               |
| `apexLogsPurge.ts`            | `queryApexLogIdsViaRest`, `queryApexLogIdsViaBulkApi`, `deleteApexLogsViaCollections`, `deleteApexLogsViaBulkApi`, `type ApexLogsPurgeResult`                                                                          |
| `apexTraceSetup.ts`           | `setupApexTrace`, `parseOnBehalfOf`, `ApexTraceSetupError`, `DATE_TIME_PATTERN`, `ON_BEHALF_OF_PATTERN`, `type OnBehalfOf`, `type ApexTraceSetupOptions`, `type ApexTraceSetupResult`, `type ApexTraceSetupErrorCode`  |
| `apexTraceSilence.ts`         | `resolveClasses`, `silenceApexClasses`, `ApexTraceSilenceError`, `FFLIB_CLASSES`, `AT4DX_CLASSES`, `FORCE_DI_CLASSES`, `type ApexTraceSilenceResult`, `type ApexTraceSilenceOutcome`, `type ApexTraceSilenceErrorCode` |
| `schemas/classesToSilence.ts` | `ClassesToSilenceSchema`, `type ClassesToSilence`                                                                                                                                                                      |

`package.json` shape (modeled on `simply-aep-core`'s, see 0009's Behavior section for the full
annotated version):

```json
{
  "name": "@simplysf/simply-apex-core",
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
    "@salesforce/apex-node": "^8.4.39",
    "@salesforce/core": "^8.30.0",
    "@simplysf/simply-core": "workspace:^1.5.1",
    "zod": "^4.1.12"
  }
}
```

No `oclif` block, no `bin/`, no `@oclif/core`, no `@salesforce/sf-plugins-core`, no
`@simplysf/simply-plugin-kit`, no `messages/`.

### `@simplysf/simply-apex` — CLI, slimmed

- The four command files import from `@simplysf/simply-apex-core` instead of relative
  `common/*.js` paths.
- `package.json` gains `@simplysf/simply-apex-core: workspace:^0.1.0`; drops
  `@salesforce/apex-node` and `zod` (no longer imported directly).
- `messages/`, `oclif` config, `bin/`, and command behavior are unchanged.

### Public-API test (in `simply-apex-core`)

`test/index.test.ts` imports the barrel as a namespace and asserts `Object.keys(api).sort()`
against an explicit literal array containing every function/class/const in the table above (types
are erased at runtime and aren't in this list — same caveat every prior `-core` package's test
documents).

## Alternatives considered

**Extract only some of the four commands' logic (e.g. just `execute`/`logs purge`, leaving the two
trace commands' logic behind) if a narrower first cut seems safer.** Rejected: unlike
`simply-cicd` (0019's one package needing this kind of narrower scoping, because part of it is
genuine CLI-process orchestration), all four of `simply-apex`'s `common/` modules are already
equally CLI-independent — none imports `@oclif/core`/`@salesforce/sf-plugins-core`, and PR #159
already normalized all four to the same error-boundary shape. There's no scoping question here the
way there was for `simply-cicd`'s `build/`/`deploy/`.

**Fold this into `@simplysf/simply-core`** (the existing shared internal library every plugin
already depends on). Rejected for the same reason 0009 gave for `simply-aep-core` and 0020 gave for
`simply-document-core`: `simply-core` is generic cross-plugin infrastructure (CSV/multipart
helpers, JSON config loading, SOQL escaping — the very things `simply-apex-core` itself depends on)
rather than Apex-specific domain logic. A consumer who wants "execute this Apex file" shouldn't have
to pull in `simply-core`'s entire unrelated surface to get it, and `simply-core` shouldn't grow
`ApexTraceSetupError`-shaped exports that only ever make sense in an Apex-trace-flag context.

## Implementation plan

1. **Scaffold `packages/simply-apex-core`** — `package.json` per Behavior above; `tsconfig.json`
   (`extends: "../../tsconfig.json"`, `outDir: "lib"`, `rootDir: "src"`, matching
   `simply-aep-core`'s); `.gitignore` (copy `simply-aep-core`'s); `vitest.config.ts` participation
   via the root config's auto-discovery (no change needed — it globs `packages/*`).
2. **Move source files**: `git mv packages/simply-apex/src/common/apexExecute.ts
packages/simply-apex-core/src/apexExecute.ts` (same for the other three `.ts` files), `git mv
packages/simply-apex/src/common/schemas/classesToSilence.ts
packages/simply-apex-core/src/schemas/classesToSilence.ts`. No relative-import fixes needed
   between the four top-level files (none imports another); `apexTraceSilence.ts`'s
   `./schemas/classesToSilence.js` import stays correct since both move together, preserving their
   relative position.
3. **Move existing tests**: `git mv packages/simply-apex/test/common/apexTraceSilence.test.ts
packages/simply-apex-core/test/apexTraceSilence.test.ts` (same for
   `apexTraceSetup.test.ts`), shortening their relative import by one directory level
   (`../../src/common/apexTraceSetup.js` → `../src/apexTraceSetup.js`). Add fresh unit tests for
   `apexExecute.ts` and `apexLogsPurge.ts` in `packages/simply-apex-core/test/` — PR #159 didn't add
   any for these two (their existing coverage was, and remains, the CLI-level command tests), so
   this is new coverage for the newly-public library surface, not a move.
4. **Write `packages/simply-apex-core/src/index.ts`** — the barrel, per Behavior's export table,
   with the standard semver-policy header comment.
5. **`packages/simply-apex-core/README.md`** — model on `simply-aep-core/README.md`: `## API`
   section with the four import snippets from Behavior above, `## Install`, `## Issues`,
   `## Contributing`.
6. **`packages/simply-apex-core/CONTRIBUTING.md`** — copy `simply-aep-core/CONTRIBUTING.md`,
   replacing the package-specific paragraph.
7. **Update `packages/simply-apex`**:
   - Four command files (`execute.ts`, `logs/purge.ts`, `trace/setup.ts`, `trace/silence.ts`) —
     change imports to `@simplysf/simply-apex-core`.
   - `package.json` — add `@simplysf/simply-apex-core: workspace:^0.1.0` to `dependencies`, drop
     `@salesforce/apex-node` and `zod`.
   - `README.md` — no `## API` section existed before (already pure command reference); no change
     needed beyond the standard `pnpm run readme` regeneration check.
8. **`CONTRIBUTING.md`** — add a `simply-apex-core` row to the repository-structure table, phrased
   like the `simply-aep-core`/`simply-document-core` rows (externally-consumable, not purely
   internal).
9. **`eslint.config.mjs`** — add `packages/simply-apex-core` to both the `allPackages` and
   `libraryPackages` arrays (0019's corrected "repo-wide updates" section flags this as easy to
   miss — a package left off both silently falls back to plain-JS parsing and fails lint with
   `Parsing error: Unexpected token type` on its first `export type`).
10. **`docs/design/README.md`** — add this doc's row to the index table; update its `Status` when
    agreed/implemented.
11. **Housekeeping per `CONTRIBUTING.md`**: `pnpm run readme` in `packages/simply-apex` (confirms
    no `## API` section leaks back in); `pnpm run build` at the root, which builds
    `simply-apex-core` before `simply-apex` (Lerna respects workspace-dependency order) and
    regenerates `command-snapshot.json` for `simply-apex` and the bundled `packages/simply` — no
    actual snapshot content changes expected, since no flags move, but the build step still needs
    to run cleanly through the new dependency edge.
12. **Not a breaking change to `@simplysf/simply-apex`'s published surface** — like
    `simply-document-core`, `simply-apex`'s `index.ts` was already the stub, so this move changes
    nothing an external consumer could have been depending on. `@simplysf/simply-apex-core` starts
    fresh at `0.1.0`; no `BREAKING CHANGE:` footer needed on `simply-apex`'s own commit.

## Testing

**Unit** — `packages/simply-apex-core/test/{apexTraceSilence,apexTraceSetup}.test.ts` move over
from PR #159's `simply-apex/test/common/` with shortened relative imports, same cases. New
`apexExecute.test.ts` and `apexLogsPurge.test.ts` per step 3 above — at minimum, for `apexExecute`:
a successful compile+execute and each of the `compile-failed`/`execute-failed` error paths; for
`apexLogsPurge`: the REST/Bulk query functions and the Collections/Bulk delete functions each
against a stubbed `Connection`, plus the `onChunkComplete` callback firing with the right running
totals across a multi-chunk Collections delete. `test/index.test.ts` per the Public-API-test section
above.

**`simply-apex` command tests** (`test/commands/simply/apex/**`) — unchanged in behavior; they
continue to exercise the library functions through the command layer even though those functions
now live in a workspace dependency. Re-run in full after the import-path change to confirm nothing
broke crossing the package boundary (mock/stub targets are unaffected, since tests stub
`Connection.prototype`/`ExecuteService.prototype`, not anything package-path-specific).

**Manual verification**: not applicable — no user-facing behavior changes for this doc to verify
beyond what PR #159 already covered; this is purely a file-location and dependency-graph change.

## Open questions

None — this follows the now-twice-proven `simply-aep-core`/`simply-document-core` recipe directly,
and PR #159 already did the harder design work (deciding the core/CLI error boundary shape) as prep.
