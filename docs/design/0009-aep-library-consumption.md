# 0009 — Splitting `simply-aep-core` out of `simply-aep`

**Status:** Implemented (PR #126)
**Package:** new `packages/simply-aep-core`; `packages/simply-aep` (CLI, slimmed)
**Date:** 2026-08-25

## Problem

[0007](0007-at4dx-binding-list.md) and [0008](0008-at4dx-domain-process-binding-list.md) deviated
from the empty-`index.ts`-stub convention every other `simply-*` command package follows, so a
companion VS Code extension (`simply-vscode/extensions/simply-at4dx`, referenced in 0008's Problem
section) could import the AT4DX scan/resolve functions and row types directly instead of shelling out
to `sf simply aep at4dx ... --json`. That barrel is real and published — `@simplysf/simply-aep` has
been on the public npm registry since 0.1.0, and `src/index.ts` re-exports everything both binding
commands' logic needs.

But it's one barrel bolted onto a CLI plugin, not a library in its own right, and nothing has
consumed it yet to expose the seams:

- Installing `@simplysf/simply-aep` — for its four exported functions and a dozen types — pulls in
  `@oclif/core` and `@salesforce/sf-plugins-core`, dependencies the library half never touches. Those
  exist solely to run `sf simply aep at4dx binding list`, which an editor extension has no reason to
  invoke.
- `scanOrgBindings`/`scanOrgDomainProcessBindings` take a `@salesforce/core` `Connection` by exact
  class type. A separate repo, with its own release cadence, now has to install a `@salesforce/core`
  version compatible with whatever `simply-aep` was built against, just to satisfy a type it only
  calls two methods on.
- Nothing pins down that the barrel's exports are a stable, semver-covered contract independent of
  the CLI's own version history. Today, `simply-aep`'s version number tracks command changes (new
  flags, new error messages) and library-surface changes with the same number — a consumer watching
  for library breakage has no way to tell which bump affected them.
- There's no README section documenting what's importable — `simply-core` (the one package in this
  monorepo that's a library first) has a hand-written `## API` section with an import snippet per
  feature; `simply-aep`'s `README.md` is 100% `oclif readme`-generated command reference.

The underlying issue is architectural: a package whose `package.json` declares an `oclif` block, a
`bin/`, and CLI-only dependencies is a plugin that happens to also export some functions — not a
library a second, independent consumer should be expected to reason about or version against.

## Decision

Extract the CLI-independent logic — everything currently under `packages/simply-aep/src/common/`,
plus the barrel `index.ts` — into a new package, **`@simplysf/simply-aep-core`**. `packages/simply-aep`
keeps the four commands and depends on `simply-aep-core` like any other workspace dependency, the same
shape `simply-aep` (and every other CLI package) already has with `@simplysf/simply-core`.

This makes `simply-aep-core` the fourth "internal library" package in this monorepo alongside
`simply-core`, `simply-plugin-kit`, and `simply-report` — but with one difference worth being explicit
about: those three are consumed _only_ by other packages in this monorepo (published to npm as a side
effect of the release process, not because an external consumer is expected). `simply-aep-core` is
deliberately meant to be installed standalone by something outside this monorepo — that's the entire
reason it exists. Its README, versioning discipline, and dependency footprint should be held to that
higher bar from day one, not treated as "another internal package."

Concretely:

1. **New package, `packages/simply-aep-core`.** Plain library shape (no `oclif` block, no `bin/`, no
   `messages/` — `common/`'s functions never used `Messages`, they already throw plain `Error`s, so
   nothing there depends on oclif's message-catalog convention). Modeled on `simply-core`'s
   `package.json`: `"exports"`, `"type": "module"`, `dependencies` limited to what the moved code
   actually imports (`@salesforce/core` for the `Connection` type, `@salesforce/source-deploy-retrieve`
   for `ComponentSet`) — no `@oclif/core`, no `@salesforce/sf-plugins-core`, no `@simplysf/simply-core`
   (verified: nothing under `common/` imports any of the three today).
2. **Flatten `common/` into the new package's `src/`.** The "common" qualifier existed to distinguish
   shared code from `commands/` inside one package; once the whole package _is_ the shared code, the
   prefix is dead weight. Files move as-is (`at4dxBindingTypes.ts`, `at4dxLocalScan.ts`,
   `at4dxOrgScan.ts`, `at4dxResolve.ts`, the domain-process equivalents, `customMetadataXml.ts`) with
   only their import paths changing.
3. **Decouple from the exact `Connection` class**, same fix identified before the split changed shape:
   both org-scan functions only call `.autoFetchQuery()` and `.getUsername()`. Add
   `export type AepConnection = Pick<Connection, 'autoFetchQuery' | 'getUsername'>;` to
   `at4dxBindingTypes.ts`, and use it as both org-scan functions' parameter type. Any real `Connection`
   still satisfies it structurally; a consumer isn't forced into an exact `@salesforce/core` version
   match.
4. **`simply-aep` depends on `simply-aep-core`** (`workspace:^0.1.0`) and drops its own now-unused
   `@salesforce/source-deploy-retrieve` dependency (only `common/`'s local-scan functions used it;
   commands never imported it directly — confirmed by inspection). `src/index.ts` reverts to the
   standard stub (`export default {};`) every other command package uses; the two command files import
   from `@simplysf/simply-aep-core` instead of relative `../../../../../common/*.js` paths.
5. **Document `simply-aep-core` like a real library**, matching `simply-core`'s convention: a `## API`
   section in its `README.md` with an import snippet per binding family, plus a header comment on
   `index.ts` stating the semver policy (everything re-exported there is public API; removing or
   renaming an export is a breaking change) and a `test/index.test.ts` asserting the exported-key list,
   so an accidental removal fails a test instead of silently shipping in a patch release.
6. **Type resolution robustness.** Use the conditional `"exports"` object form with an explicit
   `"types"` condition, plus top-level `"main"`/`"types"` fallback fields, so consumers on classic
   (non-`node16`/`nodenext`/`bundler`) `moduleResolution` can still resolve the package — the same fix
   identified in the single-package version of this plan, just landing in the new package instead.
7. **Extend the design-doc trigger list and the package table.** Add `simply-aep-core` to
   `CONTRIBUTING.md`'s repository-structure table (now four internal libraries, not three) with a
   description that flags it as externally-consumable, not purely internal. Add a bullet to
   `docs/design/README.md`'s "When a design doc is required" list for "extracting or growing a
   library package meant for consumption outside this monorepo" — this is a different bar than the
   existing "new shared module in simply-core/simply-plugin-kit/simply-report" bullet, since those are
   monorepo-internal and this is not.

### Why this is the more future-proof shape than the single-package version of this plan

The previous draft of this doc chose _not_ to split, on the reasoning that only two commands
currently export through the barrel and the CLI-only dependencies would tree-shake away in any
bundler the extension would use. That's still true for this one consumer. But the explicit ask driving
this revision is to plan for reuse beyond the current moment: if `simply-schema` or another command
package later grows its own editor-facing library surface, "does this package's `index.ts` export
real logic or is it a stub" stops being a reliable signal the moment any package mixes both — a
contributor has to open `package.json` and read `dependencies` to know whether importing it is cheap.
A dedicated `-core` package makes the boundary structural instead of conventional: if it's importable
as a library, it's a separate package with a library-shaped `package.json`; if it's a CLI plugin, its
`index.ts` is the stub. That's a clearer rule to hand a future contributor than "check whether this
particular `index.ts` happens to be a stub."

## Behavior

### `@simplysf/simply-aep-core` — new package

```ts
import type { AepConnection } from '@simplysf/simply-aep-core';

// AT4DX Application Factory bindings
import {
  scanLocalBindings,
  scanOrgBindings, // (connection: AepConnection, types: BindingType[]) => Promise<OrgScanResult>
  resolveBindings,
  type At4dxBindingRow,
  type BindingType,
} from '@simplysf/simply-aep-core';

// AT4DX domain-process (trigger routing) bindings
import {
  scanLocalDomainProcessBindings,
  scanOrgDomainProcessBindings,
  resolveDomainProcessBindings,
  type DomainProcessBindingRow,
} from '@simplysf/simply-aep-core';
```

No function is renamed, no return shape changes from what `simply-aep`'s `index.ts` exports today —
only the import specifier (`@simplysf/simply-aep-core` instead of `@simplysf/simply-aep`) and the
`Connection` → `AepConnection` parameter narrowing.

`package.json` shape:

```json
{
  "name": "@simplysf/simply-aep-core",
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
    "@salesforce/source-deploy-retrieve": "^12.37.2"
  }
}
```

No `oclif` block, no `bin/`, no `@oclif/core`, no `@salesforce/sf-plugins-core`, no `messages/`.

### `@simplysf/simply-aep` — CLI, slimmed

- `src/index.ts` → `export default {};` (the standard stub, matching every other command package).
- `src/commands/simply/aep/at4dx/binding/list.ts` and `.../domain-process-binding/list.ts` import
  scan/resolve/types from `@simplysf/simply-aep-core`.
- `package.json` dependencies gain `@simplysf/simply-aep-core: workspace:^0.1.0`, drop
  `@salesforce/source-deploy-retrieve` (no longer used directly).
- `messages/`, `oclif` config, `bin/`, and command behavior are unchanged — this is purely an import-path
  and dependency-list change from the command layer's point of view.

### Public-API test (in `simply-aep-core`)

`test/index.test.ts` imports the barrel as a namespace and asserts `Object.keys(api).sort()` against
an explicit literal array — the same discipline `command-snapshot.json` gives command flags, applied
to the library surface.

### Consumer requirements (documented in `simply-aep-core`'s README)

| Requirement                                                                      | Why                                                                                                                                             |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `"type": "module"` or dynamic `import()`                                         | `@simplysf/simply-aep-core` ships ESM only, same as every package in this monorepo.                                                             |
| Node.js `>=22` at run time (or a compatible extension-host Node)                 | Matches `engines.node`; VS Code's extension-host Node version varies by release — the consuming project's compatibility check, not solved here. |
| Own copy of `@salesforce/source-deploy-retrieve` if calling local-scan functions | `scanLocalBindings`/`scanLocalDomainProcessBindings` pull in `ComponentSet` — unavoidable for parsing local DX source directly.                 |

## Alternatives considered

**Keep one package, narrow the `Connection` type and add README/test discipline without splitting**
(the previous draft of this doc). Rejected on reconsideration: it fixes today's two commands but
leaves the "is this package's `index.ts` a stub or real" distinction as a convention someone has to
remember and check, rather than a structural fact visible from the package list. Given the explicit
intent to plan for reuse beyond `simply-aep`, paying the split cost now — while there are only two
commands and zero external consumers to migrate — is cheaper than paying it later with more commands
and a real consumer depending on the old shape.

**Name the new package `@simplysf/simply-aep-lib` or fold it into `@simplysf/simply-core`.**
Rejected: `-core` matches this monorepo's existing naming for a package's non-CLI half conceptually
(and is what the user asked for); folding into `simply-core` would make a generic, framework-agnostic
utility library (auth, CSV, bulk query — see its README) depend on AT4DX-specific domain knowledge
(binding resolution rules, Custom Metadata XML shapes) it has nothing to do with, and would force
every `simply-core` consumer to take on `@salesforce/source-deploy-retrieve` as a transitive
dependency whether or not they touch AT4DX.

**Keep `common/`'s subdirectory name and structure verbatim inside the new package (`src/common/*`)
instead of flattening to `src/*`.** Rejected as needless nesting: `common/` meant "shared within this
package, as opposed to `commands/`" — there's no `commands/` sibling anymore, so the qualifier no
longer distinguishes anything. Flattening is a zero-risk rename bundled into a move that's already
touching every import path.

**Leave `@salesforce/source-deploy-retrieve` as a `simply-aep` dependency too, in addition to
`simply-aep-core`'s.** Considered for "belt and suspenders" during the transition. Rejected: nothing
in `simply-aep`'s command files imports it directly (verified), so keeping it would just be an unused
dependency lying around — exactly the kind of drift this split is meant to prevent.

## Implementation plan

1. **Scaffold `packages/simply-aep-core`** — `package.json` per Behavior above (model:
   `packages/simply-core/package.json`, minus everything `simply-core` needs that this doesn't:
   `@jsforce/jsforce-node`, `csv-parse`/`csv-stringify`, `undici`, `@salesforce/kit`). Add
   `tsconfig.json` (same shape as `simply-aep`'s: `extends: "../../tsconfig.json"`, `outDir: "lib"`,
   `rootDir: "src"`), `.gitignore`, `CONTRIBUTING.md` stub, `vitest.config.ts` participation via the
   existing root `vitest.config.ts` (it auto-discovers every `packages/*` directory — no change
   needed there).
2. **Move source files**, flattening `common/` → `src/`:
   - `git mv packages/simply-aep/src/common/at4dxBindingTypes.ts packages/simply-aep-core/src/at4dxBindingTypes.ts`
     (and the same for `at4dxLocalScan.ts`, `at4dxOrgScan.ts`, `at4dxResolve.ts`,
     `at4dxDomainProcessBindingTypes.ts`, `at4dxDomainProcessLocalScan.ts`,
     `at4dxDomainProcessOrgScan.ts`, `at4dxDomainProcessResolve.ts`, `customMetadataXml.ts`).
   - Update each file's relative imports (they only reference each other, so paths shorten by one
     level — no cross-package references to fix here).
3. **Add `AepConnection`** to `at4dxBindingTypes.ts`; update `at4dxOrgScan.ts` and
   `at4dxDomainProcessOrgScan.ts` to accept it instead of `Connection`; drop their now-unused
   `Connection` value... they still need `import type { Connection }` only inside `at4dxBindingTypes.ts`
   where `AepConnection` is defined.
4. **`packages/simply-aep-core/src/index.ts`** — the barrel, moved from `simply-aep`, with the header
   comment rewritten to state the general public-API/semver policy (not the at4dx-specific "future VS
   Code extension" framing 0007 wrote it with) plus the new `AepConnection` export.
5. **Move tests**: `git mv packages/simply-aep/test/common/*.test.ts packages/simply-aep-core/test/`,
   updating each file's relative import (`../../src/common/at4dxLocalScan.js` →
   `../src/at4dxLocalScan.js`, one directory level shallower). Add `test/index.test.ts` (exported-keys
   assertion).
6. **`packages/simply-aep-core/README.md`** — model on `simply-core/README.md`: an `## API` section
   with an import snippet per binding family, `## Install`, `## Issues`, `## Contributing`. No
   `## Commands` section (nothing to generate — this package never runs `oclif readme`).
7. **Update `packages/simply-aep`**:
   - `src/index.ts` → `export default {};`.
   - `src/commands/simply/aep/at4dx/binding/list.ts` and `.../domain-process-binding/list.ts` —
     change imports to `@simplysf/simply-aep-core`.
   - `package.json` — add `@simplysf/simply-aep-core: workspace:^0.1.0` to `dependencies`, remove
     `@salesforce/source-deploy-retrieve`.
   - `README.md` — no `## API` section needed anymore (nothing library-shaped left to document); the
     package goes back to being pure command reference, like every other CLI package's README.
8. **`CONTRIBUTING.md`** — add `simply-aep-core` to the repository-structure table (four internal
   libraries now), phrased to flag it as externally-consumable rather than purely internal (see
   Decision).
9. **`docs/design/README.md`** — add the "library package meant for outside consumption" bullet to
   "When a design doc is required," and this doc's row to the index table.
10. **`pnpm-workspace.yaml`** — no change needed; `packages/*` already globs the new directory.
11. **Housekeeping per `CLAUDE.md`**: `pnpm run readme` in `packages/simply-aep` (command reference is
    unchanged, but confirms nothing library-related leaks into it now that the `## API` section is
    gone); `pnpm run build` at the root, which — because Lerna respects workspace-dependency order —
    builds `simply-aep-core` before `simply-aep` and regenerates both packages' `.d.ts` output and
    `simply-aep`'s (and `packages/simply`'s bundled) `command-snapshot.json`.
12. **Commit as a breaking change to `@simplysf/simply-aep`'s published surface** (its `index.ts` no
    longer exports anything, and the package's dependency list changes) — worth a `BREAKING CHANGE:`
    footer or `!` per this repo's conventional-commit convention, even though no known external
    consumer exists yet to be affected. `@simplysf/simply-aep-core` starts fresh at `0.1.0`.

## Testing

**Unit** — moves as described in step 5 above; no behavioral changes to the moved tests beyond import
paths. New: `packages/simply-aep-core/test/index.test.ts` (public-API-surface assertion).

**`simply-aep` command tests** (`test/commands/simply/aep/at4dx/**`) — unchanged in behavior; they
exercise the command classes end-to-end (mocked `Connection`/org auth via `@salesforce/core/testSetup`,
real local-scan fixtures written to a temp dir), so they continue to cover `scanOrgBindings`/
`scanLocalBindings` through the command layer even though those functions now live in a workspace
dependency — no test needs to know it moved.

**Manual verification** (outside this repo's automation, since the extension lives elsewhere): once
published, confirm from a scratch Node/TS project with `moduleResolution: "node16"` and one with the
classic `"node"` setting that `import { scanLocalBindings } from '@simplysf/simply-aep-core'` resolves
both the runtime module and its types in each.

## Open questions

- **Where the VS Code extension actually lives and when it starts consuming this** — outside this
  repo and this doc's control; this doc only commits to the library contract being sound, not to a
  consumption timeline.
- **VS Code extension-host Node/Electron version compatibility** with `simply-aep-core`'s
  `engines.node >=22` — the extension team's check to make, not resolved here.
- **Whether the extension's bundler/module format (CJS vs. ESM) needs a dynamic `import()` shim** to
  consume an ESM-only dependency — noted for their awareness, not addressed in this repo.
- **Whether other command packages (`simply-schema`, `simply-permissions`, ...) eventually want their
  own `-core` split** once they grow an editor-facing library surface of their own — this doc
  establishes the pattern (and the design-doc trigger for it) but doesn't pre-emptively apply it
  anywhere else.
