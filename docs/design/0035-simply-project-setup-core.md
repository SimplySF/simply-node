# 0035 — `@simplysf/simply-project-setup-core`

**Status:** Draft
**Package:** new `packages/simply-project-setup-core` (in `simply-node`)
**Date:** 2026-09-03

## Problem

`ProjectNotes.md` (not part of this repo) documents `@generic/project-configurator`, a CLI tool
built for one org that runs `<bin> project setup` to lay a standardized Salesforce DX project out —
copying template packs (ESLint, Prettier, Jest, UTAM, commitlint, lint-staged, VS Code, a `core`
pack of scripts/dotfiles), merging each pack's `dependencies.json` into `package.json`, and
rewriting `package.json`'s `scripts`/`wireit` block to match whichever packs are enabled. Which
packs run is resolved from CLI flags, a named preset, and a project-local `.sfdevrc.json` file's
`setup.include`/`setup.exclude` overrides.

The mechanics — "resolve an include/exclude/add feature list from flags + preset + local overrides,
then copy template packs into the project, merging customization-marked regions and per-pack
dependencies" — aren't specific to that one org. But the current implementation is: template
contents, preset names (`hrm`), the package.json defaults it writes (a `wireit`/`allure`/UTAM build
pipeline), the branch-naming convention baked into its pre-commit hook, and the `generic`/GitLab-
specific `.sfdevrc.json` fields are all one consumer's opinions, hardcoded into the engine that
walks template packs.

There's no way today to reuse the engine with a different set of packs, a different package.json
shape, or a different branch/customization convention without forking the whole CLI.

## Decision

Extract the engine — not most of the opinions — into `@simplysf/simply-project-setup-core`, a plain
library with no built-in templates, presets, or org-specific defaults. A consumer plugin (e.g. a
`setup` subcommand added to `simply-plugins`' existing `packages/simply-project`) supplies:

- a templates directory (one subdirectory per feature id, each optionally holding a
  `dependencies.json`),
- a base `SetupConfig` and named presets,
  its own `package.json` defaults (scripts/wireit/workspaces) and which scripts belong to which
  feature,
- and, only if it wants them, hooks for renaming a template's destination filename, protecting a
  file from being overwritten once it exists, and rewriting a copied file's content — the mechanism
  the original tool used, filename-special-cased, to template a branch-naming regex into a
  pre-commit hook.

The one deliberate exception: `.sfdevrc.json` — its schema, `zod` validation, and the
branch-naming-regex convention its `branchRegex`/`jiraProjectKey`/`jiraProjectKeys` fields drive —
stays part of this package, not a consumer's. Revised from this doc's first draft: it's purposely an
opinionated piece of the tool, not one more thing every consumer redefines for itself. See Behavior's
`.sfdevrc.json` subsection and Alternatives.

This package exposes that engine plus the `.sfdevrc.json` spec: `resolveSetupConfig`,
`standardizeFiles`, `standardizePackageJson`, `writeDependencies`, `sfdevrcSchema`/`loadSfdevrc`/
`findSfdevrcPath`/`buildBranchRegex`, plus the small utilities they're built from (`PackageJson`,
`exists`, `loadRootPath`, `log`, `orderMap`, `semverIsLessThan`) so a consumer can compose additional
feature-specific steps (e.g. UTAM's self-referential `"pkgName": "file:"` dependency, which is
dropped from this package as too narrow to bake in — see Alternatives) the same way it composes
everything else.

Out of scope: the source tool's `release` command (GitLab release/branch-bump automation) is a
separate concern — GitLab- and versioning-convention-specific, not part of "resolve a feature list
and standardize files/dependencies from it." Nothing here forecloses a future `simply-project-release-core`
if a consumer wants that logic reusable too.

## Behavior

### Templates-directory contract

A consumer's `templatesPath` is a directory of feature packs:

```
templates/
  core/                  # feature id "core"
    .editorconfig
    bin/...
    dependencies.json     # optional — merged into package.json when "core" is included
  eslint/
    eslint.config.mjs
    dependencies.json
  gitignore/
    base.gitignore        # always included
    eslint.gitignore       # appended when "eslint" is included
    utam.gitignore
```

`standardizeFiles`/`writeDependencies` only know the directory shape above — no feature id is
hardcoded.

### `.sfdevrc.json`

```ts
import {
  sfdevrcSchema,
  type Sfdevrc,
  loadSfdevrc,
  findSfdevrcPath,
  buildBranchRegex,
} from '@simplysf/simply-project-setup-core';

const sfdevrc = loadSfdevrc(); // walks up from cwd; undefined if no .sfdevrc.json exists
```

`sfdevrcSchema` (`zod`, `.strict()`) validates the same fields the source tool's
`schemas/sfdevrc.schema.ts` did — `$schema`, `gitlabProjectId`, `jiraProjectKey`, `jiraProjectKeys`,
`branchRegex`, `deploymentPlugins`, `setup.include`/`setup.exclude` — unchanged. `loadSfdevrc` finds
the nearest `.sfdevrc.json` (via `findSfdevrcPath`, also exported standalone), returning `undefined`
when none exists (every field is optional — a project without the file is valid) but **throwing**
when a file exists and fails to parse as JSON or fails schema validation, rather than the source
tool's swallow-and-warn: a library has no message channel of its own to warn through, and a
malformed config file is a mistake worth a consumer's command surfacing loudly, in whatever style
its own error handling uses. `buildBranchRegex` ports `copyHuskyPreCommit`'s regex-building block
unchanged (`branchRegex` wins outright; else `jiraProjectKey`/`jiraProjectKeys`, merged and folded
into both cases, build a JIRA-keyed regex; else a default `feature|bugfix|devops|release` pattern).

### `resolveSetupConfig`

```ts
import { resolveSetupConfig, type SetupConfig } from '@simplysf/simply-project-setup-core';

const baseConfig: SetupConfig = {
  include: ['core'],
  exclude: [],
  add: [],
  banned: ['.prettierrc.mjs'],
};

const config = resolveSetupConfig({
  flags, // this command's own Record<string, boolean | string | undefined>
  sfdevrc, // this package's own Sfdevrc type, from loadSfdevrc() — or undefined
  baseConfig,
  presets: { hrm: ['core', 'vscode', 'eslint', 'commitlint', 'lintstaged', 'prettier', 'utam', 'jest'] },
  booleanFeatures: ['prettier', 'utam', 'jest', 'eslint', 'commitlint', 'lintstaged', 'vscode'],
  dependentFeatures: ['eslint', 'prettier', 'utam', 'jest', 'commitlint', 'lintstaged'],
  packageJsonFeatureId: 'package-json',
});
```

Resolution order (unchanged from the source tool): start from `baseConfig` → apply
`sfdevrc.setup.include`/`exclude` → apply a named preset if `flags[presetFlagName]` (default flag
name `"preset"`) is set, else apply each of `booleanFeatures` as an add/remove toggle from
`flags[feature] === true / false` → add or remove `packageJsonFeatureId` depending on whether any of
`dependentFeatures` ended up included. Same precedence, same shape (`SetupConfig`), fully
parameterized — no `PRESETS` map, no feature list, is hardcoded in the library.

### `standardizeFiles`

```ts
import { standardizeFiles } from '@simplysf/simply-project-setup-core';

const actions = standardizeFiles({
  config,
  templatesPath: path.join(dirname, '..', 'templates'),
  projectPath: process.cwd(), // optional — defaults to the nearest package.json's directory
  gitignoreHeader: "# This file is auto-generated by 'myapp project setup'. Do not edit manually.\n\n",
  renameFile: (destRelativePath) =>
    destRelativePath === '.prettier.config.mjs' ? 'prettier.config.mjs' : destRelativePath,
  protectedFiles: ['.sfdevrc.json'],
  transformFile: ({ destRelativePath, content }) =>
    destRelativePath.endsWith('pre-commit')
      ? content.replace('REPLACE_WITH_BRANCH_REGEX', `"${buildBranchRegex(sfdevrc)}"`)
      : content,
});
```

Unchanged from the source tool: pack-file resolution order (`include` packs → `add` extra files →
`exclude` removals → banned-glob deletion), the `# -- START CUSTOMIZATION` / `# -- END CUSTOMIZATION`
block-preserving merge for a file that already exists at the destination and carries that marker in
the template, and `.gitignore` composition (`gitignore/base.gitignore` + one `gitignore/<feature>.gitignore`
per included feature, wrapped with the same customization-block footer). Returns the same
`FileAction[]` (`{ file, action: 'CREATE' | 'UPDATE' | 'MERGE' | 'DELETE' | 'ERROR' }`) shape.

Generalized out of the engine, now consumer hooks: the gitignore header text (was a hardcoded
`"generic project setup"` string), the `.prettier.config.mjs` → `prettier.config.mjs` rename (was an
`if` checked against that literal filename in two places), the `.sfdevrc.json` no-clobber rule (was
an `if` checked against that literal filename — still a `protectedFiles` entry a consumer opts into,
since this package doesn't assume `.sfdevrc.json` is even one of the files a given template pack
copies), and the pre-commit branch-regex substitution (was an `if` checked against the literal
filename `pre-commit`). Only _which file_ gets transformed, and whether it's copied at all, stays a
consumer/template-layout decision (`transformFile` still takes a callback) — but the regex-building
logic behind it is `buildBranchRegex`, not something a consumer has to reimplement. All four hooks
are optional; omitting them reproduces "copy every resolved file verbatim, never protect any of
them."

### `standardizePackageJson`

```ts
import { standardizePackageJson } from '@simplysf/simply-project-setup-core';

const changed = standardizePackageJson({
  config,
  projectPath,
  defaults: {
    private: true,
    type: 'module',
    workspaces: ['./'],
    scripts: { prepare: 'husky', format: 'wireit', 'test:unit': 'wireit' /* ... */ },
    wireit: {/* ... */},
    featureScripts: {
      prettier: ['format', 'format:verify'],
      utam: ['test:ui', 'test:ui:report', 'build:ts', 'build:utam', 'report:build', 'report:open'],
      jest: ['test:unit', 'test:unit:coverage', 'test:unit:watch'],
    },
  },
});
```

Same algorithm as `standardize-pjson.ts`'s `resolveConfig`/default-export pair, but the entire
`SfConfig`/`PACKAGE_DEFAULTS` object (that org's wireit/allure/UTAM build pipeline) and the
`prettierScripts`/`utamScripts`/`jestScripts` arrays move to the `defaults` argument — nothing about
a specific build pipeline is hardcoded in this package. `featureScripts` generalizes the three
hardcoded arrays into one map keyed by feature id, checked against `config.include`.

### `writeDependencies`

```ts
import { writeDependencies } from '@simplysf/simply-project-setup-core';

const changed = await writeDependencies({ config, templatesPath, projectPath });
```

Unchanged algorithm: for each included feature, read `<templatesPath>/<feature>/dependencies.json`
if present, merge its `dependencies`/`devDependencies` into `package.json`, upgrading a version only
when the existing one doesn't meet the template's minimum (semver-aware via `semverIsLessThan`, with
pinned-version and non-semver-range escape hatches preserved from the source tool). The UTAM
self-referential `"<pkgName>": "file:"` dependency step is **not** carried over — see Alternatives.

### Supporting exports

`PackageJson` (read/mutate/write a project's `package.json`, ordering `scripts`/`dependencies`/
`devDependencies` keys on write), `exists`, `loadRootPath` (walk up from `cwd` for a named file),
`log`, `orderMap`, `semverIsLessThan` — unchanged from the source tool's `utils/`, exported so a
consumer can write the feature-specific steps (like UTAM's self-dependency) that don't belong in a
generic engine, using the same primitives the engine itself uses.

`package.json` shape (mirrors `simply-schema-core`'s, the most recent `-core` package):

```json
{
  "name": "@simplysf/simply-project-setup-core",
  "type": "module",
  "main": "./lib/index.js",
  "types": "./lib/index.d.ts",
  "exports": { ".": { "types": "./lib/index.d.ts", "default": "./lib/index.js" } },
  "dependencies": {
    "glob": "^13.0.6",
    "zod": "^4.1.12"
  }
}
```

No `@oclif/core`, no `@salesforce/*`, no `messages/`, no `oclif` block — this package never touches
an org connection or a CLI framework. `glob` (banned-file pattern matching in `standardizeFiles`) and
`zod` (`.sfdevrc.json` validation — the same version other `-core` packages in this repo already
depend on) are its only two runtime dependencies.

## Alternatives considered

**Ship a built-in `core` template pack and `hrm`-style preset, letting consumers extend rather than
fully supply their own.** Rejected: the user's own framing is "the customizations and setups would
be provided by that consumer implementation, this would only provide the backend functionality" —
any bundled template immediately becomes an opinion this package has to maintain and version
independently of the consumer that actually uses it, for zero engine benefit (the engine doesn't
care whether a template pack exists).

**Leave `.sfdevrc.json`'s schema and validation to each consumer, with `resolveSetupConfig`'s
`sfdevrc` parameter typed as the minimal `{ setup?: { include?: string[]; exclude?: string[] } }`
shape it actually reads.** This doc's own first draft, reversed at explicit direction: `.sfdevrc.json`
is called out as _purposely_ an opinionated part of this tool, not one more thing every consumer
redefines for itself — unlike templates and presets, where every consumer genuinely wants its own.
Treating it as generic would mean re-deriving and re-validating the same file shape (and the
JIRA-key-to-branch-regex logic riding on it) in every consumer that wants it, with no guarantee two
consumers agree on what `.sfdevrc.json` even means. Keeping the schema here also means
`gitlabProjectId`/`deploymentPlugins` — not read by anything in this package, only by a consumer's
own commands (a release command, a deploy command) — are still validated against the one schema a
project's `.sfdevrc.json` has to satisfy, rather than left unvalidated because no single package owns
the whole file.

**Keep the UTAM self-referential dependency step (`dependencies[pkgName] = "file:"` when `"utam"` is
included) in `writeDependencies`, gated by a `utamFeatureId` option.** Rejected: it's the one place
the source tool's dependency-merge logic branches on a specific feature _name_ rather than treating
every feature uniformly via its `dependencies.json`. Generalizing it to "an optional feature-id string
that gets this one special treatment" only serves the one consumer who happens to also call their UTAM
feature `"utam"`; a consumer needing this now has `PackageJson` exported and can add
`if (config.include.includes('utam')) pjson.get('dependencies', {})[pjson.contents.name] = 'file:'`
next to their own `writeDependencies` call in three lines, using the same class the engine itself uses
— no engine hook needed.

**Fold `release`'s logic in too, as a second export group.** Rejected (see Problem) — different
inputs (git/GitLab, not template packs), different failure modes, and no shared code with the setup
path beyond "reads `.sfdevrc.json`." Bundling it would make this package's dependency footprint and
API surface answer a question ("does this project also want GitLab release automation?") unrelated
to "does this project want its files/dependencies standardized?"

## Implementation plan

1. **New package `packages/simply-project-setup-core`**, scaffolded like `simply-schema-core`:
   `package.json` (Behavior section above), `tsconfig.json`/`test/tsconfig.json` extending the root
   configs, `.gitignore`, `README.md`, `CONTRIBUTING.md`.
2. **`src/types.ts`** — `SetupConfig`, `SetupFlags`, `ResolveSetupConfigOptions` (its `sfdevrc` field
   typed as `Sfdevrc`, from `sfdevrcSchema.ts`), `FileAction`, `PackageJsonDefaults`.
3. **`src/sfdevrcSchema.ts`** — `sfdevrcSchema`/`Sfdevrc`, ported verbatim from
   `schemas/sfdevrc.schema.ts`.
4. **`src/loadSfdevrc.ts`** — `findSfdevrcPath` (built on `loadRootPath`) and `loadSfdevrc`
   (find + read + `JSON.parse` + `sfdevrcSchema.safeParse`, throwing with the file path on either
   failure — see Behavior for why this throws instead of the source tool's warn-and-continue).
5. **`src/buildBranchRegex.ts`** — ported from `copyHuskyPreCommit`'s JIRA-key regex-building block
   (`standardize-files.ts`), unchanged, minus the file-copying it used to be embedded in.
6. **`src/exists.ts`, `src/loadRootPath.ts`, `src/log.ts`, `src/orderMap.ts`, `src/semver.ts`** —
   ported verbatim from `utils/exists.ts`/`load-root-path.ts`/`log.ts`/`order-map.ts`/`semver.ts`
   (already framework-agnostic; only the license header and camelCase filenames change to match this
   repo's convention).
7. **`src/packageJson.ts`** — ported from `utils/package-json.ts`, same behavior.
8. **`src/resolveSetupConfig.ts`** — generalized from `setup/index.ts`'s `resolveConfig`/
   `applySfdevrc`/`applyPreset`/`applyBooleanFlags`, parameterized per Behavior above; `applySfdevrc`
   takes the real `Sfdevrc` type now, not a narrowed local shape.
9. **`src/standardizeFiles.ts`** — generalized from `utils/standardize-files.ts`: `TEMPLATES_PATH`
   becomes the `templatesPath` argument; `.prettier.config.mjs` rename becomes `renameFile`;
   `.sfdevrc.json` no-clobber becomes a `protectedFiles` entry; the `pre-commit`-named branch-regex
   substitution becomes a `transformFile` callback that calls this package's own `buildBranchRegex`
   (the regex-building logic doesn't move out of this package, only the "which file, if any, gets
   this treatment" decision does); the hardcoded gitignore header string becomes `gitignoreHeader`.
10. **`src/standardizePackageJson.ts`** — generalized from `utils/standardize-pjson.ts` +
    `utils/sf-config.ts`: `PACKAGE_DEFAULTS`/`resolveConfig` (the `sf-config.ts` one, distinct from
    `resolveSetupConfig`) become the `defaults` argument; `prettierScripts`/`utamScripts`/
    `jestScripts` become `defaults.featureScripts`.
11. **`src/writeDependencies.ts`** — generalized from `utils/write-dependencies.ts`: `dirname`-relative
    `../../src/templates` path becomes the `templatesPath` argument; the UTAM `file:` step is dropped
    (see Alternatives).
12. **`src/index.ts`** — barrel, re-exporting everything above; header comment matching
    `simply-schema-core`'s (semver-covered surface, pinned by `test/index.test.ts`).
13. **Tests** — see Testing.
14. **`simply-node`'s `eslint.config.mjs`** — add `packages/simply-project-setup-core` to both
    `allPackages` and `libraryPackages`.
15. **`simply-node`'s root `CONTRIBUTING.md`** — add a row to the repository-structure table.
16. **`docs/design/README.md`** — add this doc's row.

This package has no `simply-plugins` companion PR to coordinate in this change — nothing in
`simply-plugins` depends on it yet. A consumer command (e.g. `simply project setup` added to
`packages/simply-project`) is a separate follow-up, not part of this doc.

## Testing

**Unit**, one file per module, run with the monorepo's `vitest` project auto-discovery (no config
change needed — `vitest.config.ts` globs `packages/*`):

- `sfdevrcSchema.test.ts`: accepts an empty object and the full field set; rejects an unknown
  top-level field (`.strict()`) and a wrong-typed known field.
- `loadSfdevrc.test.ts`: `undefined` with no file found; finds/reads/validates an existing file;
  walks up through ancestor directories; throws on invalid JSON; throws on a schema violation.
- `buildBranchRegex.test.ts`: default regex with `undefined` and with an empty `Sfdevrc`;
  `branchRegex` wins outright over JIRA keys when both are set; a JIRA-keyed regex from
  `jiraProjectKeys`; `jiraProjectKey` + `jiraProjectKeys` merged without duplicates (both cases).
- `resolveSetupConfig.test.ts`: base config only; `sfdevrc.setup.include`/`exclude` applied before a
  preset; a preset short-circuiting `booleanFeatures`; boolean flags adding/removing features when no
  preset flag is set; `packageJsonFeatureId` added when a `dependentFeatures` member is included and
  removed when none are.
- `standardizeFiles.test.ts` (ported/extended from `standardize-files.test.ts`): pack copy from
  `include`, `add`, `exclude` removal, banned-glob deletion, gitignore composition, customization-block
  merge (balanced/unbalanced-marker `"ERROR"` case), `renameFile`, `protectedFiles`, `transformFile`,
  and the no-hooks-supplied default behavior.
- `standardizePackageJson.test.ts` (ported/extended from `standardize-pjson.test.ts`): scripts/wireit
  filtered by `featureScripts` against `config.include`; unchanged-content no-write case.
- `writeDependencies.test.ts` (ported/extended from `write-dependencies.test.ts`): new dependency
  added, existing range-satisfying version left alone, pinned version below minimum replaced with an
  unpinned minimum, non-semver version left alone, missing `dependencies.json` for a feature
  tolerated.
- `packageJson.test.ts`: constructs from an existing file vs. a missing one, `get` default-fill,
  `write` no-ops when unchanged, key ordering on write.
- `exists.test.ts`, `loadRootPath.test.ts`, `orderMap.test.ts`, `semver.test.ts`: small, direct.
- `index.test.ts`: pins the exported-key list, per `simply-schema-core`'s convention.

**Manual verification**: not applicable — this package has no CLI surface to run; correctness is
exercised entirely through the unit suite above and, later, whatever `simply-plugins` command
consumes it.

## Open questions

- Should a future `simply project setup` command (in `simply-plugins`) also want the `release`
  command's logic pulled into a sibling `-core` package? Left for whoever writes that command's own
  design doc — nothing here depends on the answer.
- The customization-block marker strings (`# -- START CUSTOMIZATION` / `# -- END CUSTOMIZATION`) stay
  fixed constants rather than a configurable option — no consumer need for a different marker has
  come up, and the two-line comment convention costs nothing to keep fixed until one does.
