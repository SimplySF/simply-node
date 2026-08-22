# 0001 — `simply package version get`

**Status:** Implemented
**Package:** `packages/simply-package`
**Date:** 2026-08-22

## Problem

`sfdx-project.json` is the source of truth for which package versions a project depends on and which
version the project's own package is at, but there's no supported way to read one of those values
out of it from a script. Today a pipeline that needs "what version of `test-package` are we on?"
either hand-rolls `jq` over `packageDirectories[].dependencies[].package` and splits the alias
itself, or duplicates the alias-parsing rules that already exist in this repo (in `simply-cicd`'s
`sfdxDependabot/updater.ts` and `simply-package`'s `parseDependency`). Both copies drift, and
neither handles the full set of ways a dependency can be declared.

Concretely: given a dependency declared as `"test-package@0.1.0+2"`, the user wants `0.1.0+2` back.

## Decision

Add `sf simply package version get` to `packages/simply-package`, under the existing
`simply package version` subtopic (which already hosts `cleanup`). It reads `sfdx-project.json`
only — no org, no Dev Hub, no auth — and resolves a package name to its declared version, whether
that package is a **dependency** of a package directory or the **project's own package**.

`simply-package` is the right home: it already owns `sfdx-project.json` dependency reading
(`src/common/sfdxProjectService.ts`, `src/schemas/manage/parsedDependency.ts`), it already owns the
`package`/`version` topic vocabulary, and it's bundled into the `@simplysf/simply` orchestrator, so
the command ships to everyone rather than only to CI installs.

## Behavior

```sh
sf simply package version get --package test-package
# 0.1.0+2
```

`requiresProject = true`. No org flags — usable in a CI job before any auth step runs.

### Flags

| Flag          | Char | Required | Purpose                                                                 |
| ------------- | ---- | -------- | ----------------------------------------------------------------------- |
| `--package`   | `-p` | yes      | The package name or alias to look up, e.g. `test-package`.              |
| `--directory` | `-d` | no       | Restrict the search to one package directory's `path`, to disambiguate. |

### Resolution

Every package directory is searched, in this order, for a match on `--package`:

| Declaration in `sfdx-project.json`                                                                    | Version returned                                     | `source`           |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------ |
| `dependencies: [{ "package": "test-package@0.1.0+2" }]`                                               | `0.1.0+2`                                            | `dependency`       |
| `dependencies: [{ "package": "test-package", "versionNumber": "1.2.3.LATEST" }]`                      | `1.2.3.LATEST`                                       | `dependency`       |
| A package directory with `"package": "test-package"`                                                  | that directory's `versionNumber`, e.g. `57.0.0.NEXT` | `packageDirectory` |
| `dependencies: [{ "package": "04t..." }]` and a `packageAliases` key `test-package@X` maps to that ID | `X`, plus the `04t` ID in JSON output                | `dependency`       |

The alias is split on its **last** `@`, matching what `sfdxDependabot/updater.ts` already does, so
namespaced or `@`-containing names keep working. The version portion is returned verbatim — this
command does not normalize `0.1.0+2`, `57.0.0-3`, and `1.2.3.LATEST` into a common shape, because
each is meaningful to the tool that consumes it.

Including the project's own package (row 3) is deliberate: it's the same lookup over the same file,
and "what version is my package at?" is at least as common in a pipeline as the dependency question.

### Output

Human-readable output is the bare version string via `this.log(version)` and nothing else, so both
of these work:

```sh
VERSION=$(sf simply package version get -p test-package)
VERSION=$(sf simply package version get -p test-package --json | jq -r .result.version)
```

JSON result:

```ts
type PackageVersionGetResult = {
  package: string;
  version: string;
  source: 'dependency' | 'packageDirectory';
  packageDirectory: string;
  subscriberPackageVersionId?: string;
};
```

### Errors

| Condition                                                                                                | Behavior                                                           |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| No package directory declares `--package`                                                                | `errors.packageNotFound` — names the package and the dirs searched |
| Declared, but no version resolvable (bare alias, no `versionNumber`, no matching `packageAliases` entry) | `errors.noVersionFound`                                            |
| Declared at differing versions in more than one directory                                                | `errors.ambiguousMatch` — lists the directories, suggests `-d`     |

Erroring on ambiguity rather than picking the first match keeps the command safe to wire into a
pipeline: a silent "first one wins" would ship the wrong version the day someone adds a second
package directory.

## Alternatives considered

**`simply package version retrieve`** (the verb originally asked for). Rejected: in the `sf` CLI,
"retrieve" means pulling metadata from an org (`sf project retrieve start`). This command never
contacts an org, and reusing the verb would suggest it does.

**`simply-cicd`.** Rejected: `simply-cicd` is deliberately excluded from the `@simplysf/simply`
bundle and installed on its own for pipeline use. Reading your own project file is generally useful,
not CI-specific, so it belongs where every `simply` user already has it.

**`simply-project`.** Rejected: that package is about mutating project files and metadata
(`project update api-version`). The package/version vocabulary lives in `simply-package`.

**`simply package dependencies version`.** Rejected once the project's own package version came into
scope — the command answers a question about packages generally, not only about dependencies.

**Reusing `SfdxProjectService.getDependenciesByDirectory()`.** Not viable as-is: it resolves aliases
to IDs via `SfProject.getPackageIdFromAlias`, discarding the alias's version suffix, which is exactly
the value this command needs. Hence the new lookup module below.

## Implementation plan

1. **`src/common/packageVersionLookup.ts`** (new) — pure functions, no `SfProject` dependency so
   they're directly unit-testable:
   - `splitPackageAlias(value): { name: string; version?: string }` — splits on the last `@`.
   - `findPackageVersions(contents, packageName, { directory }): PackageVersionMatch[]` — implements
     the resolution table over the parsed `sfdx-project.json` contents.
2. **`src/commands/simply/package/version/get.ts`** (new) — `SfCommand<PackageVersionGetResult>`.
   Reads `this.project.retrieveSfProjectJson().getContents()`, calls `findPackageVersions`, applies
   the error rules, and logs the bare version.
3. **`messages/simply.package.version.get.md`** (new) — `summary`, `description`, `flags.package.*`,
   `flags.directory.*`, `examples`, and the three `errors.*` keys.
4. **Housekeeping**, per `CLAUDE.md`: `pnpm run readme` and `pnpm run build` in
   `packages/simply-package`, then a `packages/simply` build so the orchestrator's
   `command-snapshot.json` regenerates. No `schemas/` entry is needed — this package has no root
   `schemas/` directory.

## Testing

**Unit** — `test/commands/simply/package/version/get.test.ts`, using `TestContext` with `sinon`
passed in explicitly (the convention established in `dependencies/manage.test.ts`):

| Case                                         | What it pins down                                     |
| -------------------------------------------- | ----------------------------------------------------- |
| `test-package@0.1.0+2`                       | `+build` aliases, the motivating case                 |
| `ESObjects@57.0.0-3`                         | `-build` aliases, the format already in the repo      |
| `{ package, versionNumber: '1.2.3.LATEST' }` | Non-pinned dependencies                               |
| Package directory's own `versionNumber`      | The project's own package version                     |
| `04t`-only dependency with a matching alias  | Reverse `packageAliases` lookup, and the ID in output |
| Same package, two directories, two versions  | `errors.ambiguousMatch`                               |
| `--directory` filter over that same project  | Ambiguity is resolvable, not fatal                    |
| Unknown package / bare alias with no version | `errors.packageNotFound`, `errors.noVersionFound`     |

**NUT** — `test/commands/simply/package/version/get.nut.ts` against a new
`test/reference-projects/version-project`, whose `sfdx-project.json` carries one dependency of each
declaration form. `TestSession` runs with `devhubAuthStrategy: 'NONE'` and no scratch org, since the
command needs neither.

## What changed during implementation

- **A new reference project instead of extending `package-project`.** The plan was to add a
  `test-package@0.1.0+2` dependency to the existing `package-project`, but `dependencies/install.nut.ts`
  installs everything that project declares and asserts on the exact set — a fictional package would
  have broken it. `version-project` carries all four declaration forms without disturbing that suite.
- **`subscriberPackageVersionId` is populated whenever it's resolvable**, not only for the
  raw-ID-dependency case: if a matched alias maps to an `04t` in `packageAliases`, the JSON output
  carries it. Strictly more information, at no extra cost.
- **The lookup module reads `simply-core`'s `SfdxProject`/`SfdxPackageDirectory` types** rather than
  defining its own structural types, which is what those types exist for.

## Discovered along the way

`packages/simply-package/README.md` had its generated command reference duplicated — one
`<!-- commands -->` marker against two `<!-- commandsstop -->` markers, with the whole block repeated
in between. `oclif readme` replaces only up to the _first_ stop marker, so each run appended another
copy rather than replacing. Regenerating for this command produced a third copy; the duplicates were
removed as part of this change. Worth a look at whether other packages' READMEs have the same
double-marker problem.

## Open questions

None outstanding. The verb (`get`) and the inclusion of the project's own package version were both
settled before this document was written.
