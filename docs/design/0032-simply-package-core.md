# 0032 — Splitting `simply-package-core` out of `simply-package`

**Status:** Implemented (PR #177) — published as `0.1.0` via `pnpm publish`. `simply-plugins`'
companion PR is not yet open.
**Package:** new `packages/simply-package-core` (in `simply-node`); `packages/simply-package` (CLI,
slimmed, in `simply-plugins`)
**Date:** 2026-09-02

## Problem

[0027](0027-core-extraction-round-1-post-split.md) put `simply-package` fifth in round 1.

Re-verified today (reading every file in full):

- **`common/packageUtils.ts`** (65 lines): `reducePackageInstallRequestErrors`,
  `isDependenciesPackagingDirectory`, plus a re-export of the package-ID-prefix
  helpers/predicates from `@simplysf/simply-core`. Imports `../schemas/sfdx-project/packageDirs.js`.
- **`common/packageVersionLookup.ts`** (193 lines): `splitPackageAlias`, `findPackageVersions`,
  plus supporting types. Pure `sfdx-project.json` parsing — no org access. Imports `./packageUtils.js`.
- **`common/packageVersionService.ts`** (515 lines, the largest single file moved by any round-1
  package so far): `buildVersionService` — loads Dev Hub packages/versions once and returns a
  queryable service (alias resolution, dependency enrichment, ranked version-choice building for
  the interactive `dependencies manage` flow). Despite "interactive" in its doc comments, it only
  _builds_ choice data (`VersionChoice[]`) — it never calls a prompt library itself; `manage.ts`
  is what feeds the choices to `@inquirer/prompts`. Imports `../schemas/manage/parsedDependency.js`.
- **`common/sfdxProjectService.ts`** (195 lines): `buildProjectService` — reads/writes
  `sfdx-project.json`'s package dependencies and plugin config
  (`plugins.simply.dependencies.ignore`, `plugins.simply.package.brancheswithreleasedversions`).
  Imports `../schemas/manage/dependencyChange.js`, `../schemas/manage/parsedDependency.js`,
  `./packageUtils.js`. Has the package's only existing test
  (`test/common/sfdxProjectService.test.ts`).
- **`schemas/sfdx-project/packageDirs.ts`** (zod schema): `BasePackageDirWithDependenciesSchema`,
  `PackageDirDependency`, `BasePackageDirWithDependencies`. Depended on by `packageUtils.ts`.
- **`schemas/manage/parsedDependency.ts`**: `ParsedDependency`, `parseDependency`. Depended on by
  `packageVersionService.ts` and `sfdxProjectService.ts`; itself imports `../../common/packageUtils.js`
  (schemas → common, the reverse direction of every other file here — see Decision).
- **`schemas/manage/dependencyChange.ts`**: `DependencyChange`, `PackageDependenciesManageResult`.
  Depended on by `sfdxProjectService.ts`; imports `./parsedDependency.js`.

None of the seven files import `@oclif/core` or `@salesforce/sf-plugins-core`. All seven are
mutually interdependent enough (`packageUtils` ↔ `parsedDependency` ↔ `dependencyChange`/
`packageVersionService`/`sfdxProjectService`, `packageDirs` → `packageUtils`) that splitting them
across packages would recreate the same graph with a version boundary in the middle of it — 0019's
criteria call for moving a cohesive unit, not slicing one open. Only 1 of 7 files has an existing
test (`sfdxProjectService.ts`); the rest are new coverage (see Testing).

### Dependency footprint (checked outside `common/`+`schemas/manage`+`schemas/sfdx-project`)

| Dependency                    | Also used elsewhere in `simply-package`?                  | Stays in `simply-package`'s `dependencies`? |
| ----------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| `@salesforce/core`            | Yes — every command file                                  | Yes                                         |
| `@salesforce/packaging`       | Yes — `install.ts`, `version/cleanup.ts`                  | Yes                                         |
| `@simplysf/simply-core`       | Yes — `install.ts` (`retryWithBackoff`), `version/get.ts` | Yes                                         |
| `zod`                         | No — only `schemas/sfdx-project/packageDirs.ts` (moving)  | No                                          |
| `@salesforce/kit`             | Used only in `install.ts` (a command, not moving)         | Yes (command-only use)                      |
| `@inquirer/prompts`           | No — only `manage.ts` (a command)                         | Yes (command-only use)                      |
| `@salesforce/ts-types`        | No — only `install.ts` (a command)                        | Yes (command-only use)                      |
| `@oclif/core`                 | Commands only                                             | Yes                                         |
| `@salesforce/sf-plugins-core` | Commands only                                             | Yes                                         |
| `@simplysf/simply-plugin-kit` | Commands only                                             | Yes                                         |

`zod` is the only dependency that drops from `simply-package`'s own `package.json` — every other
dependency the moved files use is also used directly by a command file that isn't moving.

## Decision

Extract all seven files verbatim into a new `simply-node` package, `@simplysf/simply-package-core`,
following 0028–0031's recipe (0027's corrected cross-repo mechanics). `packages/simply-package` (in
`simply-plugins`) keeps its commands and depends on the new package as a published npm dependency.

1. **New package, `packages/simply-package-core`** (in `simply-node`). Plain library shape.
   `dependencies`: `@salesforce/core` (`SfProject`, `Connection`, `isNamedPackagingDirectory` —
   `packageVersionService.ts`/`sfdxProjectService.ts`), `@salesforce/packaging` (`Package`,
   `Package2Fields`, `PackageVersionListResult`, `PackagingSObjects` — `packageVersionService.ts`,
   `PackageInstallRequest` type — `packageUtils.ts`), `@simplysf/simply-core` (re-exported
   prefix helpers — `packageUtils.ts`; `SfdxPackageDirectory`/`SfdxProject` types —
   `packageVersionLookup.ts` — `workspace:^1.5.1`, intra-repo now), `zod`
   (`schemas/sfdx-project/packageDirs.ts`). No `@oclif/core`, no `@salesforce/sf-plugins-core`, no
   `@simplysf/simply-plugin-kit`, no `@inquirer/prompts`, no `@salesforce/kit`, no
   `@salesforce/ts-types` — confirmed by inspection none of the seven moved files import them.
2. **Move all seven files** via 0027's corrected cross-repo recipe, split from `simply-package`'s
   pre-merge tip (`e1b09bc79a4c684ea95c9880e28d9385c1030616` — the second parent of `041d68c`
   `chore: add simply-package split history`, confirmed reachable with 10 commits touching
   `src/common` and 5 touching `src/schemas`), `--prefix=src`, so both `common/` and `schemas/`
   arrive together in one subtree-add — unlike prior packages, this one needs more than just
   `--prefix=src/common` since `schemas/manage/`+`schemas/sfdx-project/packageDirs.ts` move too.
   After the subtree-add, `git rm` everything under the arrived `schemas/` tree except
   `manage/dependencyChange.ts`, `manage/parsedDependency.ts`, and `sfdx-project/packageDirs.ts`
   (the split branch also carries `schemas/manage/parsedDependencyChange.test-adjacent` files, if
   any, and any other schema files not part of this move — confirmed at implementation time which
   ones those are, since `--prefix=src` pulls in the whole `src/` tree, including `commands/` and
   the rest of `schemas/`, which get `git rm`'d).
3. **Flatten `common/`'s four files up to `src/`**; keep `schemas/manage/` and
   `schemas/sfdx-project/` as their own subdirectories under `src/` (matching 0029's precedent of
   keeping a schema in its own subdir rather than flattening it in with everything else).
4. **Correction, caught by hand-tracing every import after the move (not by a build failure this
   time — both directions of this mistake still type-check and only fail at module resolution, so
   double-checking each path by counting directory levels mattered more than in 0029):** flattening
   `common/`'s four files up to `src/` breaks every one of _their_ imports that reached into
   `schemas/` with a `../` prefix — that prefix was correct while they lived one level down in
   `common/`, but now that they're siblings of `schemas/` directly under `src/`, the same target
   needs `./`, not `../`. Three fixes, not the one originally guessed here: `packageUtils.ts`'s
   `../schemas/sfdx-project/packageDirs.js` → `./schemas/sfdx-project/packageDirs.js`;
   `packageVersionService.ts`'s `../schemas/manage/parsedDependency.js` →
   `./schemas/manage/parsedDependency.js`; `sfdxProjectService.ts`'s two schemas imports, same
   fix. The other direction — `schemas/manage/parsedDependency.ts`'s import of `packageUtils.ts` —
   moves the opposite way: it was `../../common/packageUtils.js` (two levels up from
   `schemas/manage/` to `src/`, then into `common/`), and stays two levels up since neither
   `schemas/manage/`'s own depth nor the "two levels up" part changed — only the final segment
   drops `common/`, becoming `../../packageUtils.js` (an early edit here mistakenly wrote
   `../packageUtils.js`, one level short; caught before committing by re-deriving the directory
   distance rather than trusting the first guess). `packageVersionLookup.ts`'s `./packageUtils.js`
   and `schemas/manage/dependencyChange.ts`'s `./parsedDependency.js` are genuinely unaffected
   (same-directory siblings both before and after).
5. **`packages/simply-package-core/src/index.ts`** — new barrel, re-exporting everything each moved
   file already exports as public.
6. **`simply-package` (in `simply-plugins`) depends on `simply-package-core`** as a real semver
   range (`^0.1.0` once published). The three command files that import from `../../../../common/*.js`
   or `../../../../schemas/{manage,sfdx-project}/*.js` (`dependencies/install.ts`,
   `dependencies/manage.ts`, `version/get.ts`) change those specific imports to
   `@simplysf/simply-package-core`. `zod` drops from `simply-package`'s own `dependencies` (nothing
   else in the package imports it directly).
7. **Document like a library**: `README.md`'s `## API` section, `CONTRIBUTING.md` stub (copy
   `simply-data-core`'s, swap the package-specific paragraph), `test/index.test.ts` asserting the
   exported-key list.
8. **Same `"exports"`/`"main"`/`"types"` fallback shape** as every prior `-core` package.

## Behavior

### `@simplysf/simply-package-core` — new package

```ts
import { findPackageVersions, splitPackageAlias } from '@simplysf/simply-package-core';

const matches = findPackageVersions(project, 'MyPackage');
```

```ts
import { buildVersionService } from '@simplysf/simply-package-core';

const versionService = await buildVersionService(connection, sfProject);
const alias = versionService.getVersionAlias('04t000000000001AAA');
```

```ts
import { buildProjectService } from '@simplysf/simply-package-core';

const projectService = await buildProjectService(sfProject);
const dependenciesByDirectory = projectService.getDependenciesByDirectory();
```

```ts
import { parseDependency, isSubscriberPackageVersionId } from '@simplysf/simply-package-core';

const parsed = parseDependency('04t000000000001AAA');
```

Every function's signature and return shape is unchanged from what `simply-package`'s commands call
today — only the import specifier changes.

Full export list (barrel contents), by source file:

| File                                  | Exports                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packageUtils.ts`                     | `isPackage2Id`, `isPackage2VersionId`, `isSubscriberPackageId`, `isSubscriberPackageVersionId`, `PACKAGE_PREFIX_PACKAGE2`, `PACKAGE_PREFIX_PACKAGE2_VERSION`, `PACKAGE_PREFIX_SUBSCRIBER_PACKAGE`, `PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION`, `reducePackageInstallRequestErrors`, `isDependenciesPackagingDirectory` |
| `packageVersionLookup.ts`             | `splitPackageAlias`, `findPackageVersions`, `type PackageVersionSource`, `type PackageVersionMatch`, `type FindPackageVersionsOptions`                                                                                                                                                                                  |
| `packageVersionService.ts`            | `buildVersionService`, `type VersionChoice`, `type PackageVersionService`, `type VersionServiceFilterIds`                                                                                                                                                                                                               |
| `sfdxProjectService.ts`               | `buildProjectService`, `type SfdxProjectService`                                                                                                                                                                                                                                                                        |
| `schemas/manage/dependencyChange.ts`  | `type DependencyChange`, `type PackageDependenciesManageResult`                                                                                                                                                                                                                                                         |
| `schemas/manage/parsedDependency.ts`  | `type ParsedDependency`, `parseDependency`                                                                                                                                                                                                                                                                              |
| `schemas/sfdx-project/packageDirs.ts` | `BasePackageDirWithDependenciesSchema`, `type PackageDirDependency`, `type BasePackageDirWithDependencies`                                                                                                                                                                                                              |

Note: `packageUtils.ts`'s re-export of `@simplysf/simply-core`'s prefix helpers means
`isPackage2Id`/`PACKAGE_PREFIX_PACKAGE2`/etc. appear in `simply-package-core`'s barrel too, sourced
transitively — this mirrors the existing re-export, not a new decision.

`package.json` shape:

```json
{
  "name": "@simplysf/simply-package-core",
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
    "@salesforce/packaging": "^4.22.16",
    "@simplysf/simply-core": "workspace:^1.5.1",
    "zod": "^4.1.12"
  }
}
```

No `oclif` block, no `bin/`, no `@oclif/core`, no `@salesforce/sf-plugins-core`, no
`@simplysf/simply-plugin-kit`, no `@inquirer/prompts`, no `@salesforce/kit`, no
`@salesforce/ts-types`, no `messages/`.

### `@simplysf/simply-package` — CLI, slimmed (in `simply-plugins`)

- `dependencies/install.ts`, `dependencies/manage.ts`, `version/get.ts` import from
  `@simplysf/simply-package-core` instead of relative `common/`/`schemas/` paths.
- `package.json` gains `@simplysf/simply-package-core: "^0.1.0"`; drops `zod`.
- `messages/`, `oclif` config, `bin/`, and command behavior are unchanged.

### Public-API test (in `simply-package-core`)

`test/index.test.ts` asserts `Object.keys(api).sort()` against the runtime (non-type) exports, in
the order `Array.prototype.sort()`'s default (code-unit, uppercase-before-lowercase) comparison
actually produces:
`['BasePackageDirWithDependenciesSchema', 'PACKAGE_PREFIX_PACKAGE2', 'PACKAGE_PREFIX_PACKAGE2_VERSION', 'PACKAGE_PREFIX_SUBSCRIBER_PACKAGE', 'PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION', 'buildProjectService', 'buildVersionService', 'findPackageVersions', 'isDependenciesPackagingDirectory', 'isPackage2Id', 'isPackage2VersionId', 'isSubscriberPackageId', 'isSubscriberPackageVersionId', 'parseDependency', 'reducePackageInstallRequestErrors', 'splitPackageAlias']`.

## Alternatives considered

**Leave `schemas/manage/`+`schemas/sfdx-project/packageDirs.ts` behind, moving only `common/`.**
Rejected outright: `packageVersionService.ts` and `sfdxProjectService.ts` both take/return
`ParsedDependency`/`DependencyChange` as part of their public function signatures, and
`packageUtils.ts` takes `BasePackageDirWithDependencies` — leaving those types behind would mean
`simply-package-core`'s own exported functions reference types that don't exist without depending
back on `simply-package` (a plugin), which is exactly backwards (a library can't depend on the CLI
that consumes it). The types have to move with the functions that use them.

**Split `packageVersionService.ts` (515 lines) into its own package, separate from the smaller three
files.** Rejected: it depends on `schemas/manage/parsedDependency.ts`, which `sfdxProjectService.ts`
also depends on — splitting would either duplicate the schema across two packages or force one
package to depend on the other, neither of which is simpler than one package.

## Implementation plan

Per 0027's cross-repo recipe, using `simply-package`'s pre-merge tip
(`e1b09bc79a4c684ea95c9880e28d9385c1030616`):

1. **In `simply-plugins`**: `git subtree split --prefix=src <tip> -b split/simply-package-core`
   (whole `src/`, since both `common/` and parts of `schemas/` are needed — narrower than
   `--prefix=src/common` this time).
2. **In `simply-node`**: subtree-add into `packages/simply-package-core/src`, then `git rm`
   everything except `common/{packageUtils,packageVersionLookup,packageVersionService,sfdxProjectService}.ts`
   and `schemas/manage/{dependencyChange,parsedDependency}.ts` and `schemas/sfdx-project/packageDirs.ts`
   (i.e. remove `commands/`, `bin/` reference files if any leaked in via the `src` prefix, and every
   other `schemas/` subdirectory/file not listed above).
3. **Flatten**: move the four `common/*.ts` files up to `src/*.ts` directly; leave
   `schemas/manage/*.ts` and `schemas/sfdx-project/packageDirs.ts` where they land. Fix
   `schemas/manage/parsedDependency.ts`'s import per Decision point 4.
4. **Scaffold the rest**: `package.json` per Behavior above; `tsconfig.json`/`test/tsconfig.json`/
   `.gitignore` (copy `simply-data-core`'s); `vitest.config.ts` participation via the root config's
   auto-discovery.
5. **Move the one existing test**: `sfdxProjectService.test.ts` (shortened relative imports by one
   directory level; its `schemas/manage/dependencyChange.js` import path also needs the same
   flattening fix). **Write fresh tests** for `packageUtils.ts`, `packageVersionLookup.ts`,
   `packageVersionService.ts`, `schemas/manage/parsedDependency.ts` — none have existing coverage
   (see Testing).
6. **Write `packages/simply-package-core/src/index.ts`** — the barrel, per Behavior's export table.
7. **`packages/simply-package-core/README.md`**/**`CONTRIBUTING.md`** — model on
   `simply-data-core`'s.
8. **`simply-node`'s `eslint.config.mjs`** — add `packages/simply-package-core` to both
   `allPackages` and `libraryPackages`.
9. **`simply-node`'s `CONTRIBUTING.md`** — add a row to the repository structure table.
10. **`simply-node`'s `docs/design/README.md`** — add this doc's row.
11. **Open the PR against `simply-node`**, get it merged, confirm publish. Expect the same
    trusted-publisher first-publish constraint as every prior round-1 package — a one-time manual
    `pnpm publish --access public --no-git-checks` from `packages/simply-package-core` (not plain
    `npm publish`). Also expect a `minimumReleaseAgeExclude` entry for the freshly-published version
    in `simply-plugins`' `pnpm-workspace.yaml` before its companion PR's install succeeds.
12. **In `simply-plugins`**: update `dependencies/install.ts`, `dependencies/manage.ts`,
    `version/get.ts`'s imports, drop `zod` from `simply-package`'s own `package.json`, `git rm` the
    seven moved files, add this doc's duplicate to `docs/design/`.
13. **Housekeeping per `CONTRIBUTING.md`** (both repos): `pnpm run readme` in `simply-package`;
    `pnpm run build` at each repo's root.
14. **Not a breaking change to `@simplysf/simply-package`'s published surface** — its `index.ts` was
    already the stub. `@simplysf/simply-package-core` starts fresh at `0.1.0`.

## Testing

**Unit** — move `sfdxProjectService.test.ts` as-is (shortened relative imports). New tests:

- `packageUtils.ts`: `reducePackageInstallRequestErrors` (empty errors, one error, multiple errors —
  numbered-list formatting), `isDependenciesPackagingDirectory` (with/without a `dependencies` array,
  non-array `dependencies`).
- `packageVersionLookup.ts`: `splitPackageAlias` (name only, name@version, leading-`@` scoped-style
  name, trailing bare `@`), `findPackageVersions` (dependency-alias match, dependency-raw-ID-via-alias
  match, own-package-directory match, `directory` option scoping, no match).
- `packageVersionService.ts`: `buildVersionService` with a small fake `Connection`/`SfProject` —
  `knowsAboutVersion`/`knowsAboutPackage`/`getPackage2IdForVersion`/`getVersionAlias`/`getPackageAlias`/
  `findVersionById` against seeded fixture data; `enrichDependency` (fills in from a known
  `subscriberPackageVersionId`, no-ops when already enriched or unknown); `buildInteractiveChoices`/
  `buildReleasedChoices`/`buildLatestChoices` against a small single-branch, three-version fixture
  (a released build, a newer unreleased build at the same minor, and a newer unreleased minor),
  asserting choice order and dedup (`seen`) by hand-tracing the ranking logic against that fixture.
  The branch dimension (`findLatestForBranch`'s feature-branch/`branchesWithReleased` loops) isn't
  separately exercised — the ranking logic there is the same function called with a different
  branch argument, not new logic.
- `schemas/manage/parsedDependency.ts`: `parseDependency` (subscriber-version-ID input, Package2Id +
  numeric version, Package2Id + `X.Y.Z.LATEST`/`X.Y.Z-LATEST`, unrecognized prefix).

`test/index.test.ts` per the Public-API-test section above.

**`simply-package` command tests** — unchanged in behavior; re-run in full after the import-path
change.

**Manual verification**: not applicable — pure file-location and dependency-graph change.

## Open questions

None left for this doc — the dependency-footprint table above resolves the one question 0030 left
to implementation time (which shared dependencies also drop from the CLI package) up front, since
the answer was straightforward to check by inspection.
