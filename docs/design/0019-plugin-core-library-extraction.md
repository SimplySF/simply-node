# 0019 — Extracting `-core` library packages from the other `simply-*` plugins

**Status:** Draft
**Package:** policy doc; concrete new packages are `packages/simply-*-core` per the phased plan below, each
introduced by its own follow-up design doc
**Date:** 2026-08-30

## Problem

[0009](0009-aep-library-consumption.md) split `@simplysf/simply-aep-core` out of `@simplysf/simply-aep` so a
non-CLI consumer (a companion VS Code extension) could import AT4DX scan/resolve logic directly instead of
shelling out to `sf simply aep at4dx ... --json`. That split fixed a specific, already-existing problem:
`simply-aep`'s `index.ts` had organically grown into a real barrel (per
[0007](0007-at4dx-binding-list.md)/[0008](0008-at4dx-domain-process-binding-list.md)), and it needed to be
turned into a proper, independently-versioned library.

The other twelve `simply-*` command packages don't have that problem — every one of their `src/index.ts`
files is already the standard `export default {};` stub (verified by inspection). But most of them have the
same _shape_ of reusable logic sitting behind that stub: a `src/common/` directory holding scan/parse/build
logic that a command's `run()` method calls into. That logic is currently reachable only by installing the
whole CLI plugin and invoking a command (`--json` and parse stdout), which is exactly the friction 0009
identified for AT4DX. Nothing has asked for that logic outside a CLI yet — this doc is proactive, not
reactive — but 0009's own "Open questions" section already flagged this: _"Whether other command packages
(`simply-schema`, `simply-permissions`, ...) eventually want their own `-core` split once they grow an
editor-facing library surface of their own."_ The goal now is to decide, package by package, whether that
day has come, and if so, in what order.

## Decision

Adopt the `simply-aep-core` shape as the standard recipe (plain library `package.json`, flattened `src/`,
`## API` README section, exported-keys test — see 0009's Behavior/Implementation sections for the exact
template) and apply it **one package at a time**, not as a single sweeping change. Each package that
qualifies gets its own short follow-up design doc (numbered after this one) that does for that package what
0009 did for `simply-aep`: enumerate the exact files moved, name the new package, and record what stays
behind. This doc is the policy layer — the survey and the ordering — not a substitute for those.

### Candidacy criteria

A package's `common/` (or `schemas/`) content is worth extracting when **all** of the following hold:

1. **CLI-independent logic already exists as a distinct module**, not inlined into a command's `run()`. If
   nothing has been pulled out of the command layer yet, there's no "core" to name — extracting one
   preemptively means guessing at a boundary nobody has needed yet.
2. **The logic doesn't fundamentally depend on `@oclif/core` or `@salesforce/sf-plugins-core` types**
   (`Flags`, `Command`, `ux`, `Messages` catalogs keyed to a specific command's messages file). Files that do
   — flag-builder helpers, base command classes — stay in the CLI package exactly as 0009 left
   `at4dxBindingTypes.ts`-adjacent command code behind. A `-core` split moves the CLI-independent remainder,
   not the whole directory.
3. **A plausible non-CLI consumer exists for the specific logic**, not for the package in the abstract. "Scan
   this org and return rows," "parse this file and return a typed result," and "render this template to a
   string" all plausibly interest an editor extension or a script. "Print this ux.table," "prompt for
   confirmation," and "write this file to disk with these flag-derived defaults" don't — those are properly
   CLI concerns and have no reason to move.

### Package survey

| Package                                             | `common/` size                                                                              | Files coupled to oclif/sf-plugins-core (stay behind)                                                                              | Verdict                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `simply-aep`                                        | — (already split)                                                                           | —                                                                                                                                 | Done — `simply-aep-core` exists                          |
| `simply-cicd`                                       | ~7,000 lines across `alm/`, `build/`, `deploy/`, `notify/`, `vcs/`, `sfdxDependabot/`, etc. | `build/flags.ts`, `deploy/flags.ts`, `deploy/stageCommand.ts` (imports `Messages`/`Flags` directly to build a shared flag schema) | **Candidate, but needs scoping** — see below             |
| `simply-community`                                  | ~640 lines, 7 files (site publish/retrieve/verify logic)                                    | none                                                                                                                              | **Candidate**                                            |
| `simply-data`                                       | ~550 lines, 6 files (ContentVersion/CSV/multipart helpers)                                  | `apiBudgetFlag.ts` (defines an oclif flag)                                                                                        | **Candidate**, minus that one file                       |
| `simply-document`                                   | ~1,670 lines, 2 files — pure Handlebars templates, only import is `handlebars` itself       | none                                                                                                                              | **Candidate** — smallest-risk of the batch               |
| `simply-package`                                    | ~970 lines, 4 files (package-version lookup/service, sfdx-project parsing)                  | none                                                                                                                              | **Candidate**                                            |
| `simply-permissions`                                | ~350 lines, 2 files (XML template, report template)                                         | none                                                                                                                              | **Candidate**                                            |
| `simply-schema`                                     | ~640 lines, 4 files (Excel parsing, schema generation, report template)                     | none                                                                                                                              | **Candidate**                                            |
| `simply-sobject`                                    | ~450 lines, 3 files (field history, relationship-field logic)                               | none                                                                                                                              | **Candidate**                                            |
| `simply-apex`                                       | no `common/` — logic lives inline in `src/commands/**` (828 total command lines)            | n/a                                                                                                                               | **Not applicable yet** — nothing factored out to extract |
| `simply-flow`                                       | no `common/` (323 total command lines)                                                      | n/a                                                                                                                               | **Not applicable yet**                                   |
| `simply-project`                                    | no `common/`, single command                                                                | n/a                                                                                                                               | **Not applicable yet**                                   |
| `simply-report`, `simply-plugin-kit`, `simply-core` | already libraries, not CLI plugins                                                          | n/a                                                                                                                               | n/a                                                      |

`simply-cicd` is the one package where "extract `common/` wholesale" doesn't apply cleanly. A meaningful
chunk of it (`build/`, `deploy/`) is CLI-process orchestration in the literal sense — it shells out to `sf`
and `git` via `execa`, reads flag-derived config, and is built around oclif's `Flags`/`Messages` conventions
even outside the three files flagged above (`deployCommon.ts`, `runDeployStage.ts`, and friends take
flag-shaped option objects as input). Other parts — `alm/` (Jira/GitLab issue linking), `vcs/` (GitHub/GitLab
API registries), `sfdxDependabot/` — are genuinely CLI-independent API-client logic with an obvious non-CLI
consumer (a bot or script that wants to open a GitLab issue the same way `simply-cicd` does, without
shelling out to the CLI). Rather than one `simply-cicd-core` covering all of it, `simply-cicd` likely wants a
narrower first cut — `alm/` and `vcs/` only — with `build/`/`deploy/` left for a later doc once there's a
concrete consumer to design the boundary around. That narrower scope is a decision for `simply-cicd`'s own
follow-up doc, not this one.

## Alternatives considered

**Do every extraction in one PR.** Rejected: eight candidate packages, several hundred to several thousand
lines each, each with its own dependency footprint and edge cases (`simply-cicd`'s scoping question above
being the sharpest one). A single PR would be unreviewable and would force every package's rollout to block
on the slowest one (`simply-cicd`).

**Extract everything in `common/` verbatim, including the oclif-coupled files.** Rejected — this is the same
mistake 0009 explicitly avoided with `Connection` → `AepConnection`: a "core" package that still imports
`@oclif/core` isn't actually free of CLI dependencies for an external consumer, it's just relocated. The
`stageCommand.ts`/`flags.ts`/`apiBudgetFlag.ts` files identified above stay put.

**Wait until a real external consumer asks for each package's logic, one at a time, reactively.** This is
what 0009 did for `simply-aep` (a consumer already existed) and is the safer default in general — a doc
written against a real integration catches contract problems a speculative one can't. It's rejected as the
_only_ mode here because the user has already decided this is worth doing proactively across the board,
having seen the shape work once; the criteria above exist so "proactive" doesn't mean "extract things nobody
will use" — packages with no factored-out logic (`simply-apex`, `simply-flow`, `simply-project`) are
explicitly left alone until they have some.

**Name the new packages after their consumer instead of their source package** (e.g. `simply-vscode-shared`
instead of per-plugin `-core` packages). Rejected: couples the library's name and scope to one hypothetical
consumer, and abandons the naming convention `simply-aep-core` already established — a contributor scanning
`packages/*` should be able to tell which CLI plugin a `-core` package's logic came from by name alone.

## Implementation plan

Sequencing, easiest/lowest-risk first, so the recipe gets proven on small packages before `simply-cicd`'s
harder scoping call:

1. **`simply-document-core`** — smallest (~1,670 lines, 2 files), zero `@simplysf/simply-core` or
   `@oclif/core` coupling today (only dependency is `handlebars`), zero existing common-level tests to
   migrate. Good first proof that the recipe generalizes beyond `simply-aep-core`.
2. **`simply-permissions-core`** and **`simply-sobject-core`** — small, no oclif coupling, light existing
   test coverage.
3. **`simply-community-core`**, **`simply-data-core`** (minus `apiBudgetFlag.ts`), **`simply-package-core`**,
   **`simply-schema-core`** — moderate size, no-to-one file staying behind, more existing tests to move
   (`simply-community` has 6, `simply-data` has 4).
4. **`simply-cicd`** — deferred to its own doc that resolves the `alm/`/`vcs/`-only-vs-everything scoping
   question above before any code moves; `build/`/`deploy/`'s CLI-process-orchestration content likely never
   moves.

Each package in steps 1–3 gets its own numbered design doc (0020+) written immediately before that package's
implementation, following 0009's template exactly: enumerate the moved files, the `package.json` shape
(deps limited to what the moved code imports — checked per package the same way 0009 verified `common/`
touched none of `@oclif/core`/`@salesforce/sf-plugins-core`/`@simplysf/simply-core`), the README `## API`
section, and the `test/index.test.ts` exported-keys assertion. This doc does not pre-commit to those
packages' exact export lists or `package.json` dependency arrays — that's each follow-up doc's job, written
close enough to implementation that "what does this file actually import" is still fresh instead of guessed
here.

Two repo-wide updates land once, now, rather than being repeated in every follow-up doc:

- **`CONTRIBUTING.md`'s repository-structure table** gains a row per new `-core` package as it lands (not
  pre-emptively for all eight) — same "not a CLI plugin" phrasing the four existing library rows use, with
  the `simply-aep-core` row's "meant for direct use outside this monorepo too" qualifier.
- **`docs/design/README.md`'s index table** gains this doc's row now, plus one row per follow-up doc as
  written. The existing "extracting or growing a library package meant for consumption outside this
  monorepo" trigger bullet already covers every package in the plan below — no wording change needed there.

## Testing

No tests in this doc — it introduces no code. Each follow-up doc inherits 0009's testing section verbatim:
moved unit tests get their relative imports shortened by one directory level, and each new package gets a
`test/index.test.ts` asserting `Object.keys(api).sort()` against an explicit literal array so an accidental
export removal fails a test instead of shipping silently in a patch release.

## Open questions

- **Whether any external consumer actually exists yet** for packages other than `simply-aep-core`'s VS Code
  extension. This doc proceeds without one, on the reasoning in "Alternatives considered" above — but it
  means there's no integration test pinning the contract the way a real consumer would. Worth revisiting if
  three or four of these ship and none gets imported by anything outside this monorepo.
- **`simply-cicd`'s exact `alm/`/`vcs/` boundary** — deferred to that package's own doc, as noted above.
- **Whether `simply-apex`/`simply-flow`/`simply-project` ever grow a `common/`** worth extracting — nothing
  to decide now; revisit if/when one of them factors logic out of its commands for its own reasons.
