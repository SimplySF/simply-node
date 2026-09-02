# 0028 — Splitting `simply-permissions-core` out of `simply-permissions`

**Status:** Implemented (PR #173) — published as `0.2.0`, then republished as `0.2.2` after the
initial bootstrap publish went out via plain `npm publish` and didn't rewrite its `workspace:`
dependency (see the package's own `CHANGELOG.md`). `simply-plugins`' companion PR (#8) is open,
not yet merged.
**Package:** new `packages/simply-permissions-core` (in `simply-node`); `packages/simply-permissions`
(CLI, slimmed, in `simply-plugins`)
**Date:** 2026-09-02

## Problem

[0019](0019-plugin-core-library-extraction.md) marked `simply-permissions` a **candidate**: its
`src/common/` already holds two CLI-independent modules (`permissionSetXmlTemplate.ts`,
`permissionsReportTemplate.ts`, 350 lines total), neither imports `@oclif/core` or
`@salesforce/sf-plugins-core`, and each has a plausible non-CLI consumer — "render this permission
set's metadata XML" and "render this permissions report" are both things a script or CI job could
want without shelling out to the CLI. [0027](0027-core-extraction-round-1-post-split.md) put it
first in round 1 (tied with `simply-sobject-core`, both smallest/lowest-risk) and worked out the
cross-repo mechanics this doc uses: the CLI package lives in `simply-plugins`, the new library
package belongs in `simply-node`, and they're joined only by a published npm dependency.

Re-verified today, both files (confirmed by reading them in full):

- **`permissionSetXmlTemplate.ts`** (172 lines): `buildPermissionSetXml(data)`, pure — takes a typed
  `PermissionSetTemplateData` object, returns a `.permissionset-meta.xml` document via `xmlbuilder2`.
  No org access, no flags.
- **`permissionsReportTemplate.ts`** (178 lines): `buildPermissionsReportHtml(options)`, pure —
  takes already-queried permission set/group records grouped by package, returns a self-contained
  HTML report via `@simplysf/simply-report`'s `createReportHandlebars`/`renderReportPage`.

Neither file has an existing unit test today (0019's "light existing test coverage" undersold it —
there's none to move, only new coverage to add).

## Decision

Extract `packages/simply-permissions/src/common/*` verbatim into a new `simply-node` package,
`@simplysf/simply-permissions-core`, following 0009's/0020's/0023's template, moved across repos per
0027's recipe. `packages/simply-permissions` (in `simply-plugins`) keeps its commands and depends on
the new package as a published npm dependency instead of a relative import.

1. **New package, `packages/simply-permissions-core`** (in `simply-node`). Plain library shape
   modeled on `simply-document-core`: no `oclif` block, no `bin/`, no `messages/`.
   `dependencies`: `xmlbuilder2` (`^4.0.3`, matching what `simply-permissions` already pins),
   `@simplysf/simply-report` (`workspace:^1.0.4` — intra-repo now, since both packages live in
   `simply-node`). No `@oclif/core`, no `@salesforce/sf-plugins-core`, no
   `@simplysf/simply-plugin-kit`, no `@simplysf/simply-core` — confirmed by inspection that neither
   moved file imports any of them (unlike `simply-schema`/`simply-sobject`, which do import
   `@simplysf/simply-core` — that's a difference for their own follow-up docs, not this one).
2. **Move the two files** via the cross-repo recipe (0027): `git subtree split
--prefix=packages/simply-permissions/src/common -b split/simply-permissions-core` from a
   `simply-plugins` checkout, `git subtree add
--prefix=packages/simply-permissions-core/src/common <remote> split/simply-permissions-core`
   into a `simply-node` checkout, then `git mv packages/simply-permissions-core/src/common/*
packages/simply-permissions-core/src/` to flatten — matching every existing `-core` package's
   flat `src/`. No relative-import fixes needed: `permissionsReportTemplate.ts`'s import of
   `@simplysf/simply-report` is already a package-specifier import, not a relative path, so it's
   unaffected by the move.
3. **`packages/simply-permissions-core/src/index.ts`** — new barrel (this package never had one;
   `common/` was reached via direct relative imports from the command files), re-exporting
   everything each moved file already exports as public. Same semver-policy header comment
   convention as every prior `-core` package's `index.ts`.
4. **`simply-permissions` (in `simply-plugins`) depends on `simply-permissions-core`** as a real
   semver range (`^0.1.0` once published — not `workspace:^`, there's no workspace link across
   repos). The command files that currently import from `../../common/*.js` (or the equivalent
   relative depth) change to `@simplysf/simply-permissions-core`. `xmlbuilder2` **and**
   `@simplysf/simply-report` both drop from `simply-permissions`'s own `dependencies` — confirmed by
   inspection (`grep -rl simply-report packages/simply-permissions/src/commands` returns nothing)
   that no command imports either directly; both were only ever reached through the two moved
   files.
5. **Document like a library**: `README.md`'s `## API` section (import snippets + a row per exported
   function/type, modeled on `simply-document-core/README.md`'s table), `CONTRIBUTING.md` stub
   (copy `simply-document-core/CONTRIBUTING.md`, swap the package-specific paragraph),
   `test/index.test.ts` asserting the exported-key list.
6. **Same `"exports"`/`"main"`/`"types"` fallback shape** as every prior `-core` package's
   `package.json`, for classic `moduleResolution` consumers.

## Behavior

### `@simplysf/simply-permissions-core` — new package

```ts
import { buildPermissionSetXml, type PermissionSetTemplateData } from '@simplysf/simply-permissions-core';

const xml = buildPermissionSetXml({
  label: 'My Permission Set',
  hasActivationRequired: false,
  objectPermissions: [],
  fieldPermissions: [],
  tabSettings: [],
  recordTypeVisibilities: [],
  userPermissions: [],
});
```

```ts
import { buildPermissionsReportHtml } from '@simplysf/simply-permissions-core';

const html = buildPermissionsReportHtml({
  username: 'user@example.com',
  reportDate: new Date().toISOString(),
  groupedData: new Map(),
});
```

Every function's signature and return shape is unchanged from what `simply-permissions`'s commands
call today — only the import specifier changes.

Full export list (barrel contents), by source file:

| File                           | Exports                                                                                                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissionSetXmlTemplate.ts`  | `buildPermissionSetXml`, `type ObjectPermission`, `type FieldPermission`, `type TabSetting`, `type RecordTypeVisibility`, `type UserPermission`, `type PermissionSetTemplateData`             |
| `permissionsReportTemplate.ts` | `buildPermissionsReportHtml`, `type ObjectPermissionEntry`, `type FieldPermissionEntry`, `type PermissionSetReportEntry`, `type PermissionSetGroupReportEntry`, `type GroupedPermissionsData` |

`package.json` shape:

```json
{
  "name": "@simplysf/simply-permissions-core",
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
    "xmlbuilder2": "^4.0.3",
    "@simplysf/simply-report": "workspace:^1.0.4"
  }
}
```

No `oclif` block, no `bin/`, no `@oclif/core`, no `@salesforce/sf-plugins-core`, no
`@simplysf/simply-plugin-kit`, no `@simplysf/simply-core`, no `messages/`.

### `@simplysf/simply-permissions` — CLI, slimmed (in `simply-plugins`)

- Command files import from `@simplysf/simply-permissions-core` instead of relative `common/*.js`
  paths.
- `package.json` gains `@simplysf/simply-permissions-core: "^0.1.0"` (real semver, published from
  `simply-node`); drops `xmlbuilder2` and `@simplysf/simply-report`.
- `messages/`, `oclif` config, `bin/`, and command behavior are unchanged.

### Public-API test (in `simply-permissions-core`)

`test/index.test.ts` imports the barrel as a namespace and asserts `Object.keys(api).sort()` against
an explicit literal array containing every function in the table above (types are erased at
runtime and aren't in this list — same caveat every prior `-core` package's test documents):
`['buildPermissionSetXml', 'buildPermissionsReportHtml']`.

## Alternatives considered

**Fold this into `@simplysf/simply-report`** (since `permissionsReportTemplate.ts` already depends
on it for its page shell/Handlebars environment). Rejected for the same reason 0009/0020/0023 gave
for their own libraries: `simply-report` is generic cross-plugin report scaffolding (page shell, base
stylesheet, Handlebars environment) consumed by several packages' reports, not permissions-specific
domain logic. A consumer who wants "render this permission set's XML" has no reason to also pull in
report-rendering machinery, and vice versa for a consumer who only wants the report.

**Extract only one of the two files** (e.g. just the XML builder, leaving the report template
behind). Rejected: both are equally CLI-independent (neither imports `@oclif/core`/
`@salesforce/sf-plugins-core`), both are small, and there's no scoping question here the way there
was for `simply-cicd`'s `build/`/`deploy/` (0019) — nothing about either file is CLI-process
orchestration.

## Implementation plan

Per 0027's cross-repo recipe:

1. **In `simply-plugins`**: `git subtree split --prefix=packages/simply-permissions/src/common -b
split/simply-permissions-core`.
2. **In `simply-node`**: add the `simply-plugins` checkout as a local remote, fetch the split
   branch, `git subtree add --prefix=packages/simply-permissions-core/src/common <remote>
split/simply-permissions-core`, then `git mv packages/simply-permissions-core/src/common/*
packages/simply-permissions-core/src/` to flatten.
3. **Scaffold the rest**: `package.json` per Behavior above; `tsconfig.json` (`extends:
"../../tsconfig.json"`, `outDir: "lib"`, `rootDir: "src"`, matching every sibling `-core`
   package's); `.gitignore` (copy `simply-document-core`'s); `vitest.config.ts` participation via
   the root config's auto-discovery (no change needed — it globs `packages/*`).
4. **Write `packages/simply-permissions-core/src/index.ts`** — the barrel, per Behavior's export
   table, with the standard semver-policy header comment.
5. **`packages/simply-permissions-core/README.md`** — model on `simply-document-core/README.md`:
   `## API` section with the two import snippets from Behavior above, `## Install`, `## Issues`,
   `## Contributing`.
6. **`packages/simply-permissions-core/CONTRIBUTING.md`** — copy `simply-document-core/CONTRIBUTING.md`,
   replacing the package-specific paragraph.
7. **Add fresh unit tests** for both moved functions in `packages/simply-permissions-core/test/` —
   there's no existing coverage to move (see Problem).
8. **`simply-node`'s `CONTRIBUTING.md`** — add a `simply-permissions-core` row to the repository
   structure table.
9. **`simply-node`'s `eslint.config.mjs`** — add `packages/simply-permissions-core` to both
   `allPackages` and `libraryPackages` (0019's/0027's warning: a package left off either array
   silently falls back to plain-JS parsing and fails lint with `Parsing error: Unexpected token
type` on its first `export type`). Fold in pruning the stale plugin-package entries `allPackages`
   still carries from before the repo split (0027's noted housekeeping item), in this same PR since
   it's the first one to touch this array post-split.
10. **`simply-node`'s `docs/design/README.md`** — add this doc's row.
11. **Open the PR against `simply-node`**, get it merged, confirm `release.yml` publishes
    `@simplysf/simply-permissions-core` — note the published version.
12. **In `simply-plugins`**: update `packages/simply-permissions`'s command files' imports, `git rm`
    the moved `common/` files, update `package.json` (`@simplysf/simply-permissions-core: "^<published-version>"`,
    drop `xmlbuilder2` and `@simplysf/simply-report`), add this doc's duplicate to `docs/design/`
    there too.
13. **Housekeeping per `CONTRIBUTING.md`** (both repos): `pnpm run readme` in `simply-permissions`
    (confirms no `## API` section leaks back in); `pnpm run build` at each repo's root.
14. **Not a breaking change to `@simplysf/simply-permissions`'s published surface** — its `index.ts`
    was already the stub, so this move changes nothing an external consumer could have been
    depending on. `@simplysf/simply-permissions-core` starts fresh at `0.1.0`.

## Testing

**Unit** (new, in `simply-permissions-core`) — `buildPermissionSetXml`: at least one case per
permission array (object/field/tab/record-type-visibility/user permissions), covering the boolean
`String()` coercion and the tab-visibility `'Visible'`/`'Hidden'` mapping. `buildPermissionsReportHtml`:
empty `groupedData`, a single package with one permission set and one permission set group (covering
the `componentsDisplay` join and the `fieldName` helper's `Object.Field` split), and multiple packages
(covering the sort-by-key ordering). `test/index.test.ts` per the Public-API-test section above.

**`simply-permissions` command tests** — unchanged in behavior; re-run in full after the import-path
change to confirm nothing broke crossing the package boundary.

**Manual verification**: not applicable — no user-facing behavior change to verify beyond a pure
file-location and dependency-graph change.

## Open questions

None — checked at doc-writing time (see Decision step 4): no command in `simply-permissions` imports
`@simplysf/simply-report` or `xmlbuilder2` directly, so both cleanly drop from its `dependencies`.
