# 0037 — Splitting `simply-cicd-core` out of `simply-cicd`

**Status:** Draft
**Package:** new `packages/simply-cicd-core` (in `simply-node`); `packages/simply-cicd` (CLI, slimmed,
in `simply-plugins`)
**Date:** 2026-09-03

## Problem

[0019](0019-plugin-core-library-extraction.md) surveyed every `simply-*` plugin's `common/` directory
for `-core`-split candidacy and sequenced the work, but explicitly deferred `simply-cicd`: its
`common/` (~7,000 lines across `alm/`, `build/`, `deploy/`, `notify/`, `vcs/`, `sfdxDependabot/`, and a
handful of top-level utility files) doesn't reduce to "extract `common/` wholesale" the way the other
eleven packages did. 0019 sketched a likely narrower cut — `alm/` and `vcs/` only — but left the actual
boundary, the dependency check, and the file-by-file plan to `simply-cicd`'s "own scoping doc,"
i.e. this one. [0027](0027-core-extraction-round-1-post-split.md) confirmed `simply-cicd` stayed out of
round 1 for the same reason and closed round 1 without it.

Re-verified today (reading every file in `common/` and checking every cross-import):

| Directory / file(s)                                                                                                                   | Lines | Imports outside itself (besides node builtins)                                                                                                        | Oclif/`sf-plugins-core` coupling                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `alm/` (5 files: `index.ts`, `registry.ts`, `types.ts`, `jira.ts`, `gitlabIssues.ts`)                                                 |   241 | none                                                                                                                                                  | none                                                                                                                      |
| `vcs/` (5 files: `index.ts`, `registry.ts`, `types.ts`, `github.ts`, `gitlab.ts`)                                                     | 1,028 | none (native `fetch`, no HTTP library)                                                                                                                | none                                                                                                                      |
| `build/` (18 files), `deploy/` (7 files)                                                                                              | 3,029 | `execa` (shells to `sf`/`git`), `../vcs/`, `../logger.js`, `@simplysf/simply-core`                                                                    | `build/flags.ts`, `deploy/flags.ts`, `deploy/stageCommand.ts` import `@oclif/core`/`@salesforce/sf-plugins-core` directly |
| `notify/` (7 files)                                                                                                                   |   790 | `../alm/`, `../vcs/`, `../sfConfig.js`, `../deploy/deployCommon.js`, `../happySoup/`, `../env.js`, `../exec/sfCli.js`, `@simplysf/simply-core`        | none directly, but entangled with `deploy/` (see below)                                                                   |
| `sfdxDependabot/` (2 files)                                                                                                           |   604 | `../vcs/`, `../exec/sfCli.js`, `../logger.js`                                                                                                         | none                                                                                                                      |
| `happySoup/resolveOriginProject.ts`                                                                                                   |    79 | `../vcs/`, `../sfConfig.js`                                                                                                                           | none                                                                                                                      |
| `schemas/` (3 files, zod)                                                                                                             |   162 | none                                                                                                                                                  | none                                                                                                                      |
| `flags/env.ts`                                                                                                                        |    96 | none — takes already-parsed flag values as plain parameters, no `@oclif/core` import                                                                  | none directly, but exists solely to resolve _flag_ precedence against env vars — no non-CLI caller has flags to resolve   |
| Top-level: `logger.ts`, `env.ts`, `git.ts`, `sfAuth.ts`, `sfConfig.ts`, `sfPackages.ts`, `sfPlugins.ts`, `sfApex.ts`, `exec/sfCli.ts` |   992 | `execa`, `@simplysf/simply-core`; **`logger.ts` alone is imported by 34 of the other 38 files in `common/`**, including every `build/`/`deploy/` file | none directly                                                                                                             |

`alm/` and `vcs/` are the clean cut 0019 expected — cleaner, in fact: neither imports `logger.ts`,
`exec/sfCli.ts`, or anything else from the shared-kernel top-level files, so extracting them requires
no "what else has to come with it" negotiation. Everything else in `common/` either fails 0019's
criterion 2 (oclif coupling, directly or via `logger.ts`'s pervasive use inside `build/`/`deploy/`) or
criterion 3 (no plausible non-CLI consumer today — see "Candidates considered and rejected" below).

## Decision

Extract only `alm/` and `vcs/` (10 files, 1,269 lines) into a new `simply-node` package,
`@simplysf/simply-cicd-core`, following 0009/0027's established recipe. `packages/simply-cicd` (in
`simply-plugins`) keeps `build/`, `deploy/`, `notify/`, `sfdxDependabot/`, `happySoup/`, `schemas/`,
and the top-level utility files, and depends on the new package as a published npm dependency for the
17 files inside it that currently import `alm/`/`vcs/` by relative path (listed in Implementation
plan).

This confirms 0019's own guess rather than overturning it, but on firmer evidence: 0019 reasoned from
"what's CLI-process orchestration vs. API-client logic"; this doc adds the dependency-graph check
(nothing in `alm/`/`vcs/` reaches into the shared kernel) that makes the boundary mechanical rather
than judgment-based.

### Why `alm/` and `vcs/` specifically

Both are provider-registry libraries (`registerAlmProvider`/`createAlmProvider`,
`registerVcsProvider`/`createVcsProvider`) with a real shape independent of any CLI:

- **`alm/`** — `JiraProvider` and `GitLabIssuesProvider` implement `AlmProvider`: `extractIssues(commitLog,
projectKeys)` regex-matches issue keys (`PROJECT-123` for Jira, GitLab's own issue-reference syntax)
  out of a block of commit-message text, and `render(issues, baseUrl)` turns them into plain-text or
  HTML links. Pure string processing — no network calls, no filesystem access, no environment reads.
  Zero non-relative imports.
- **`vcs/`** — `GitHubProvider` and `GitLabProvider` implement `VcsProvider`: list branches, open/find
  merge requests, read/write CI project variables, build clone URLs, read `GITHUB_REPOSITORY`/
  `CI_PROJECT_PATH`-style CI-context env vars. Each makes REST calls via the platform `fetch` — no
  `octokit`, no `@gitbeaker/*`, no HTTP client dependency to carry into the new package.

Both are exactly 0019's "plausible non-CLI consumer" case: a bot or script that wants to link commits
to Jira tickets, or open/query a GitLab merge request, the same way `simply-cicd` does today — without
installing the CLI and shelling out to `sf simply cicd ... --json`. Combined test coverage moves too:
746 lines across `alm/gitlabIssues.test.ts` (78), `alm/jira.test.ts` (75), `vcs/github.test.ts` (364),
`vcs/gitlab.test.ts` (229) — no `registry.ts`/`index.ts`/`types.ts` tests exist today for either
directory (consistent with other `-core` splits' "pure barrel/registry, no independent behavior to
pin down" pattern).

### Dependency footprint (checked outside `alm/`/`vcs/`)

Neither directory imports anything beyond its own files and Node builtins — no `execa`, no
`@simplysf/simply-core`, no `handlebars`, no `zod`, no HTTP client. `@simplysf/simply-cicd-core`'s
`package.json` needs **zero runtime dependencies**.

## Candidates considered and rejected

The user's original framing for this doc was broader than `alm`/`vcs`: whether other pieces of
`simply-cicd` are generic enough to belong in the existing `@simplysf/simply-core`, or in a new
library of their own, rather than a `simply-cicd`-flavored package. Each candidate below was checked
against actual file contents, not assumed:

- **`sfApex.ts` (204 lines: `hasApexTests`, `runApexTests`) vs. `simply-apex-core`'s
  `apexExecute.ts`.** These look like they might overlap — both packages run Apex against an org. Read
  in full: `simply-apex-core`'s `executeApex` runs an anonymous-Apex snippet and returns its result.
  `simply-cicd`'s `runApexTests` runs `sf apex test run` as a deploy-pipeline gate: it writes JUnit/JSON
  results to `./test-results/apex`, parses them, and prints a chalk-formatted failure report via
  `logger.raw()` before throwing to fail the pipeline. Different operation (execute vs. test-run),
  different output contract (a CLI-flavored console report vs. a typed result object). **Not a
  duplicate** — no consolidation to make here. `sfApex.ts` stays in `simply-cicd`.
- **`exec/sfCli.ts` (`runSf`/`runSfJson`, a thin `execa` wrapper around the `sf` binary) → `simply-core`.**
  This was the strongest candidate: zero `simply-cicd`-specific concepts, and it's the one piece of the
  shared kernel every other kernel file (`sfAuth.ts`, `sfPackages.ts`, `sfPlugins.ts`, `sfApex.ts`,
  `sfdxDependabot/dependabotRun.ts`) depends on. Checked whether any other `simply-*` package has grown
  its own copy of this pattern (a duplication signal that would justify moving it proactively) — none
  has; `grep`ing every package in `simply-plugins` for `execa('sf'` finds only `simply-cicd`'s own
  usages. Rejected for now on 0019's criterion 3: "shell out to the installed `sf` binary and parse its
  `--json` output" is a CI-pipeline-shaped way of talking to Salesforce, not a general one — a script or
  editor-extension consumer (`simply-core`'s actual audience: see its `auth/`, `query/`, `bulk/`
  modules, all built on `@jsforce/jsforce-node`/`@salesforce/core`'s `Connection` directly) would use
  the SDK, not spawn a CLI subprocess and parse its stdout. There's no consumer today asking for "spawn
  `sf`" as a library call. Revisit if `notify/` or `sfdxDependabot/` (both depend on it) ever grow a
  real non-CLI consumer of their own — that's the scenario that would also pull `exec/sfCli.ts` out, and
  `simply-core` is the obvious destination if that day comes, precisely because it has no
  `simply-cicd`-specific concepts baked in.
- **`env.ts` (`appendToEnvFile`, 60 lines) → `simply-core`.** Writing CI-provider env files
  (`$GITHUB_ENV`/`$GITLAB_ENV`-style) so a later pipeline step can read a value this one computed is a
  CI/CD-domain concept specifically — none of `simply-core`'s other consumers (`simply-schema`,
  `simply-data`, `simply-permissions`, ...) run inside a CI pipeline step sequence where this would ever
  apply. Belongs with `simply-cicd`'s pipeline-orchestration code if it ever moves anywhere, not with
  the general-purpose library every plugin depends on regardless of context.
- **`notify/sendNotification.ts` + `renderTemplate.ts` + `templates.ts` (186 lines) split out from the
  rest of `notify/`.** These three are themselves decoupled (Handlebars template rendering, a generic
  webhook POST) — the entanglement is in the other four `notify/` files
  (`happySoupNotification.ts`, `projectNotification.ts`, `getCommitStories.ts`,
  `getRemoteCommitStories.ts`), which pull in `deploy/deployCommon.ts` (reads on-disk deploy-progress
  state written by the CLI's own deploy stages) to build their report payloads. Splitting the
  notification-sending primitives out while leaving the report-building code behind is possible in
  principle, but there's no consumer asking for "send an adaptive-card webhook" as a library call today,
  independent of `simply-cicd`'s own deploy-report use of it — this is 0019's criterion 3 again, not a
  dependency-graph problem. Left whole in `simply-cicd` for this doc; worth its own follow-up if that
  changes.
- **`sfdxDependabot/` (604 lines) as a second `-core` candidate alongside `alm`/`vcs`.** Depends on
  `exec/sfCli.ts` and `logger.ts` (the shared kernel staying behind) plus `vcs/` types (moving). Once
  `vcs/` moves, `dependabotRun.ts` would import `VcsProject`/`VcsProvider` from
  `@simplysf/simply-cicd-core` instead of a relative path — a small mechanical update covered in
  Implementation plan below — but the file itself isn't moving; it still needs the CLI-side `runSf`/
  `logger`.
- **`flags/env.ts` (`parseBooleanString`/`resolveString`/`resolveOptionalString`/`resolveBoolean`,
  96 lines) → `simply-core`.** Doesn't import `@oclif/core` — it takes already-parsed flag values as
  plain function parameters, so it clears criterion 2 on a strict reading. Rejected on criterion 3
  anyway: its entire purpose is resolving _CLI flag_ precedence (flag value beats env var beats
  fallback) against `SIMPLY_CICD_`-prefixed and CI-provider env vars. A non-CLI consumer has no flags
  to resolve in the first place — this is oclif-flag-shaped even without the import. Used by exactly
  one file (`commands/simply/cicd/sfdx-dependabot.ts`) today; stays put.
- **`build/`, `deploy/`, `schemas/`, and the rest of the top-level utility files wholesale.** This is
  0019's original conclusion, unchanged: these are CI-process orchestration in the literal sense (shell
  to `sf`/`git`, read flag-derived config objects, write files the `sf` CLI itself expects to find,
  format colored console output for a pipeline log) rather than a library boundary with an external
  consumer. `build/flags.ts`/`deploy/flags.ts`/`deploy/stageCommand.ts` fail criterion 2 outright
  (direct `@oclif/core`/`@salesforce/sf-plugins-core` imports); the rest fails criterion 3 today. None
  of this moves in this doc.

## Alternatives considered

**Extract all of `common/` in one cut, including `build/`/`deploy/`.** Rejected — same reasoning 0019
already gave: `build/flags.ts`/`deploy/flags.ts`/`deploy/stageCommand.ts` are directly coupled to
`@oclif/core`/`@salesforce/sf-plugins-core`, and the rest of `build/`/`deploy/` is CI-process
orchestration with no non-CLI consumer, not a "core" in the sense every other `-core` package is.

**Extract `alm/`/`vcs/` together with `notify/`'s four report-building files, treating "everything that
isn't `build`/`deploy`/kernel" as the cut.** Rejected: those four `notify/` files import
`deploy/deployCommon.ts` directly (on-disk deploy-progress state), so including them would either pull
a chunk of `deploy/` along too (reopening the question just closed above) or require designing a new
seam inside `deploy/deployCommon.ts` to hand progress data to `notify/` without a direct import —
real design work with no consumer driving it yet, exactly what 0019's criterion 3 exists to gate against.

**Move `exec/sfCli.ts` into `simply-core` proactively, since it's the one piece of shared kernel with
zero `simply-cicd` concepts.** Rejected in "Candidates considered and rejected" above — no consumer
asking for it, and 0019's own rejected-alternatives section already rejected speculative extraction
across the board for the same reason.

**Wait for `alm`/`vcs` to get a real non-CLI consumer before extracting them, matching how 0009 was
motivated by an already-existing VS Code extension.** Rejected for the same reason 0019 rejected it at
the survey level: the criteria (decoupled module, no oclif coupling, plausible consumer) are met today,
and 0019 already decided proactive extraction is worth doing once a package clears them — `simply-cicd`
was deferred only for its harder scoping question, not exempted from the policy.

## Behavior

### `@simplysf/simply-cicd-core` — new package

```ts
import { createAlmProvider, listAlmProviderKinds } from '@simplysf/simply-cicd-core';

const jira = createAlmProvider('jira');
const issues = jira.extractIssues(commitLog, ['PROJ']);
const { html } = jira.render(issues, 'https://example.atlassian.net/browse');
```

```ts
import { createVcsProvider } from '@simplysf/simply-cicd-core';

const gitlab = createVcsProvider('gitlab', { token: process.env.GITLAB_TOKEN });
const mr = await gitlab.findMergeRequest({ sourceBranch: 'feature/x' });
```

Every function's signature and return shape is unchanged from what `simply-cicd`'s commands call
today — only the import specifier changes.

Full export list (barrel contents), by source file:

| File                  | Exports                                                                                                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `alm/registry.ts`     | `registerAlmProvider`, `listAlmProviderKinds`, `createAlmProvider`                                                                                                                                                                                                                                     |
| `alm/jira.ts`         | `JiraProvider`                                                                                                                                                                                                                                                                                         |
| `alm/gitlabIssues.ts` | `GitLabIssuesProvider`                                                                                                                                                                                                                                                                                 |
| `alm/types.ts`        | `type AlmProviderKind`, `type AlmIssueRef`, `type AlmIssueRendering`, `type AlmProvider`, `type AlmProviderFactory`                                                                                                                                                                                    |
| `vcs/registry.ts`     | `registerVcsProvider`, `listVcsProviderKinds`, `createVcsProvider`                                                                                                                                                                                                                                     |
| `vcs/github.ts`       | `GitHubProvider`                                                                                                                                                                                                                                                                                       |
| `vcs/gitlab.ts`       | `GitLabProvider`                                                                                                                                                                                                                                                                                       |
| `vcs/types.ts`        | `type VcsProviderKind`, `type VcsProject`, `type VcsProjectRef`, `type VcsBranch`, `type VcsCommit`, `type VcsCommitLogEntry`, `type VcsMergeRequest`, `type VcsProjectVariable`, `type VcsTerminology`, `type VcsCiContext`, `type VcsProviderOptions`, `type VcsProvider`, `type VcsProviderFactory` |

`alm/index.ts` and `vcs/index.ts` each register their built-in providers as a side effect of import
(unchanged behavior) and re-export the above — the new package's `src/index.ts` barrel does the same
at one more level up, per every prior `-core` package's shape.

`package.json` shape:

```json
{
  "name": "@simplysf/simply-cicd-core",
  "type": "module",
  "main": "./lib/index.js",
  "types": "./lib/index.d.ts",
  "exports": {
    ".": {
      "types": "./lib/index.d.ts",
      "default": "./lib/index.js"
    }
  },
  "dependencies": {}
}
```

No `oclif` block, no `bin/`, no `@oclif/core`, no `@salesforce/sf-plugins-core`, no
`@simplysf/simply-core`, no `messages/`, no runtime dependencies at all.

### `@simplysf/simply-cicd` — CLI, slimmed (in `simply-plugins`)

17 files currently import `alm/`/`vcs/` by relative path and switch to `@simplysf/simply-cicd-core`:

- `commands/simply/cicd/notify/happy-soup.ts`, `commands/simply/cicd/notify/project.ts`,
  `commands/simply/cicd/sfdx-dependabot.ts`
- `common/build/createFallbackTag.ts`, `createPackageVersion.ts`, `deltaRunner.ts`, `flags.ts`
- `common/deploy/deployCommon.ts`, `deployHappySoup.ts`, `deployProject.ts`, `flags.ts`
- `common/git.ts`, `common/sfConfig.ts`
- `common/happySoup/resolveOriginProject.ts`
- `common/notify/getCommitStories.ts`, `happySoupNotification.ts`, `projectNotification.ts`,
  `getRemoteCommitStories.ts`
- `common/sfdxDependabot/dependabotRun.ts`

`package.json` gains `@simplysf/simply-cicd-core: "^0.1.0"` (once published); no dependency drops from
`simply-cicd`'s own `package.json` — `alm`/`vcs` didn't introduce any dependency not already used
elsewhere in the package. `messages/`, `oclif` config, `bin/`, and command behavior are unchanged.

### Public-API test (in `simply-cicd-core`)

`test/index.test.ts` asserts `Object.keys(api).sort()` against the runtime (non-type) exports:
`['GitHubProvider', 'GitLabIssuesProvider', 'GitLabProvider', 'JiraProvider', 'createAlmProvider', 'createVcsProvider', 'listAlmProviderKinds', 'listVcsProviderKinds', 'registerAlmProvider', 'registerVcsProvider']`.

## Implementation plan

Per 0027's cross-repo recipe:

1. **In `simply-plugins`**: find `simply-cicd`'s pre-merge tip (the second parent of its
   `chore: add simply-cicd split history` commit, per 0027 step 1's method), confirm reachable commit
   count for `src/common/alm` and `src/common/vcs` combined, then `git subtree split
--prefix=src/common <tip> -b split/simply-cicd-core` (splitting the whole `common/` history, since
   `git subtree split` operates on a path prefix, not an arbitrary file set — `alm/`/`vcs/` are
   subdirectories of that prefix).
2. **In `simply-node`**: subtree-add into `packages/simply-cicd-core/src/common`, then `git mv
packages/simply-cicd-core/src/common/alm packages/simply-cicd-core/src/alm && git mv
packages/simply-cicd-core/src/common/vcs packages/simply-cicd-core/src/vcs`, then `git rm -r` every
   other directory/file the split brought in (`build/`, `deploy/`, `notify/`, `sfdxDependabot/`,
   `happySoup/`, `schemas/`, the top-level utility files) — this package moves only two of `common/`'s
   subdirectories, unlike every prior `-core` split which moved all of `common/`.
3. **Scaffold the rest**: `package.json` per Behavior above (zero dependencies);
   `tsconfig.json`/`test/tsconfig.json`/`.gitignore` (copy `simply-schema-core`'s); `vitest.config.ts`
   participation via the root config's auto-discovery.
4. **Move the four existing test files** (`alm/gitlabIssues.test.ts`, `alm/jira.test.ts`,
   `vcs/github.test.ts`, `vcs/gitlab.test.ts`), shortening relative imports by one directory level.
5. **Write `packages/simply-cicd-core/src/index.ts`** — the barrel, per Behavior's export table,
   re-exporting `alm/index.js` and `vcs/index.js`'s existing contents.
6. **`packages/simply-cicd-core/README.md`/`CONTRIBUTING.md`** — model on `simply-schema-core`'s.
7. **`simply-node`'s `eslint.config.mjs`** — add `packages/simply-cicd-core` to both `allPackages` and
   `libraryPackages`.
8. **`simply-node`'s `CONTRIBUTING.md`** — add a row to the repository structure table.
9. **`simply-node`'s `docs/design/README.md`** — add this doc's row.
10. **Open the PR against `simply-node`**, get it merged, confirm publish (expect the same
    trusted-publisher first-publish manual `pnpm publish --access public --no-git-checks` step every
    prior round-1 package needed). Add a `minimumReleaseAgeExclude` entry in `simply-plugins`'
    `pnpm-workspace.yaml` for the published version.
11. **In `simply-plugins`**: update the 17 files listed in Behavior to import from
    `@simplysf/simply-cicd-core`; add it to `simply-cicd`'s `package.json` `dependencies`; `git rm -r
src/common/alm src/common/vcs` and their test directories (already moved in step 4); add this doc's
    duplicate to `docs/design/`.
12. **Housekeeping per `CONTRIBUTING.md`** (both repos): `pnpm run readme` in `simply-cicd`; `pnpm run
build` at each repo's root.
13. **Not a breaking change to `@simplysf/simply-cicd`'s published surface** — its `index.ts` is
    already the stub. `@simplysf/simply-cicd-core` starts fresh at `0.1.0`.

## Testing

**Unit** — the four existing test files (746 lines) move with their subject files, imports shortened
by one directory level; no new coverage needed, no behavior changes.

`test/index.test.ts` per the Public-API-test section above.

**`simply-cicd` command/build/deploy tests** — unchanged in behavior; re-run in full after the
17 import-path changes.

**Manual verification**: not applicable — pure file-location and dependency-graph change.

## Open questions

- **`sfdxDependabot/`, `notify/`'s report-building files, and the shared-kernel top-level files**
  (`logger.ts`, `exec/sfCli.ts`, `env.ts`, `sfAuth.ts`, `sfConfig.ts`, `sfPackages.ts`, `sfPlugins.ts`,
  `sfApex.ts`) — deliberately left in `simply-cicd` per "Candidates considered and rejected" above.
  Revisit each independently if a real non-CLI consumer shows up; don't re-litigate as a batch the way
  this doc's "Alternatives considered" already declined to.
- **`build/`/`deploy/` never extracting** — 0019's own conclusion, reaffirmed here with the added
  evidence that `logger.ts` (used by all of `build/`/`deploy/`) and direct `@oclif/core` imports in
  three files make this a CLI package through and through, not a library with a CLI wrapper around it.
