# 0027 — Continuing the `-core` extraction under the two-repo split (round 1, excludes `simply-cicd`)

**Status:** Implemented, fully. All six packages merged and published on the `simply-node` side
(PRs #173–#178), and all six `simply-plugins` companion PRs (#8, #10–#14) merged and published —
every plugin now consumes its `-core` package as a real npm dependency, no `common/`-relative
imports left except `simply-data`'s untouched `apiBudgetFlag.ts` (0027's own decision to keep it
behind). `simply-cicd` remains explicitly out of scope for this round.
**Package:** repo-wide across `simply-node` and `simply-plugins`; concrete new packages are
`packages/simply-permissions-core`, `packages/simply-sobject-core`, `packages/simply-community-core`,
`packages/simply-data-core`, `packages/simply-package-core`, `packages/simply-schema-core` in
`simply-node`, each introduced by its own follow-up design doc
**Date:** 2026-09-02

## Problem

[0019](0019-plugin-core-library-extraction.md) surveyed every `simply-*` plugin, set candidacy
criteria for a `-core` split, and sequenced the work: `simply-document-core` first (done, 0020),
then `simply-permissions-core`/`simply-sobject-core`, then
`simply-community-core`/`simply-data-core`/`simply-package-core`/`simply-schema-core`, with
`simply-cicd` deferred to its own scoping doc. `simply-apex-core` (0023) also landed, outside that
original sequence.

0019 was written on 2026-08-30, three days before [0026](0026-split-simply-node-simply-plugins-repos.md)
split this monorepo into `simply-node` (libraries) and `simply-plugins` (CLI plugins). Its
Implementation Plan assumed a single repo: `git mv packages/simply-apex/src/common/apexExecute.ts
packages/simply-apex-core/src/apexExecute.ts` is how 0023 actually did it, and it works precisely
because both the source and destination were in one repo's history. That's no longer true — the six
remaining candidate plugins now live in `simply-plugins`, and every `-core` package they'd spawn
belongs in `simply-node` (confirmed instruction: "core packages in simply-node"). A same-repo `git
mv` can't reach across that boundary; every remaining extraction is now a cross-repo move.

Separately, the user has asked that `simply-cicd` be excluded from this round — consistent with
0019's own deferral of it (its `alm/`/`vcs/`-only-vs-everything boundary needs its own scoping call),
so this doc doesn't need to relitigate that, just confirm it stays out of scope here.

## Decision

**Round 1 scope** (unchanged from 0019's own ordering, `simply-document-core` now done and
`simply-apex-core` already landed via its own doc):

1. `simply-permissions-core`
2. `simply-sobject-core`
3. `simply-community-core`
4. `simply-data-core` (minus `apiBudgetFlag.ts`, which stays — it defines an oclif flag)
5. `simply-package-core`
6. `simply-schema-core`

`simply-cicd` is explicitly out of scope for this round. `simply-apex`, `simply-flow`, and
`simply-project` remain not-applicable (confirmed today: neither `simply-flow/src` nor
`simply-project/src` has grown a `common/` directory since 0019's survey — still nothing
CLI-independent to extract).

Re-verified today (all six match 0019's counts, nothing has drifted):

| Package              | `common/` files | Lines | Stays behind                            |
| -------------------- | --------------- | ----- | --------------------------------------- |
| `simply-permissions` | 2               | 350   | —                                       |
| `simply-sobject`     | 3               | 449   | —                                       |
| `simply-community`   | 7               | 640   | —                                       |
| `simply-data`        | 6               | 547   | `apiBudgetFlag.ts` (defines oclif flag) |
| `simply-package`     | 4               | 966   | —                                       |
| `simply-schema`      | 4               | 644   | —                                       |

Each package still gets its own numbered follow-up doc, written immediately before its
implementation (0019's own rule, unchanged) — this doc supplies the sequence and the cross-repo
recipe those docs will each follow, not their exact export lists or file-by-file moves.

## Behavior

Nothing user-facing changes — same as 0019. What's new is entirely mechanical: where the code
physically lives and how a change gets published.

### The cross-repo recipe (replaces 0019's `git mv`-based steps for every remaining package)

For each package, in order:

1. **Extract history for just the moved files.** `git subtree split --prefix=packages/<plugin>/src/common
-b split/<plugin>-core` from `simply-plugins`' `main` **does not work correctly** — discovered
   implementing `simply-permissions-core` (0028): every plugin package already crossed one
   subtree-add merge boundary during 0026's whole-repo split (its own `chore: add <plugin> split
history` commit), and splitting a sub-path from _after_ that boundary only finds commits on the
   default (simplified) side of it — for `simply-permissions/src/common` this found 1 commit where
   the real count, confirmed via the pre-merge branch tip, is 10. The fix: find that commit
   (`git log --oneline main -- packages/<plugin>` — the _earliest_ one touching the package, its
   `git log --format='%P' -s <that-commit>`'s second parent is the pre-merge tip), then split from
   _that_ commit with the prefix relative to _its_ tree (`src/common`, not
   `packages/<plugin>/src/common` — that commit's tree already starts at the package root): `git
subtree split --prefix=src/common <pre-merge-tip-sha> -b split/<plugin>-core`. Verify by
   comparing `git log --oneline split/<plugin>-core | wc -l` against
   `git log --oneline <pre-merge-tip-sha> -- src/common | wc -l` — they must match.
2. **Bring it into a `simply-node` checkout**: add the `simply-plugins` checkout as a local remote,
   fetch the split branch, then `git subtree add --prefix=packages/<plugin>-core/src/common
<remote> split/<plugin>-core`, followed by `git mv packages/<plugin>-core/src/common/* 
packages/<plugin>-core/src/` to flatten it — every existing `-core` package (`simply-aep-core`,
   `simply-apex-core`, `simply-document-core`) has a flat `src/`, not a `src/common/`, and this
   round should match. (`apiBudgetFlag.ts` gets excluded from `simply-data`'s subtree split entirely
   — pass only the files that move as separate `--path`-equivalents, or split the whole directory
   and `git rm` the one file that stays behind before merging.)
3. **Scaffold the rest of the package** per 0009's template (verbatim, unchanged): `package.json`,
   `tsconfig.json` extending the root, `README.md` with an `## API` section, `CONTRIBUTING.md` copied
   from the nearest sibling `-core` package, `src/index.ts` barrel with the semver-policy header
   comment, and a `test/index.test.ts` pinning `Object.keys(api).sort()`.
4. **Add the package to `simply-node`'s `eslint.config.mjs`**: both `allPackages` and
   `libraryPackages` (0019's own warning about this applies unchanged — a package left off either
   array silently falls back to plain-JS parsing instead of failing loudly). While touching this
   file: `allPackages` still lists every plugin package that moved to `simply-plugins` in 0026
   (`packages/simply-aep`, `packages/simply-cicd`, etc.) — these are harmless no-op globs now (the
   directories don't exist here), but pruning them in the same PR that adds a new entry is a
   reasonable piece of housekeeping to fold in, not a separate change.
5. **Open the PR against `simply-node`**, get it merged. `release.yml` publishes the new package to
   npm automatically — note the version it published as.
6. **Open the companion PR against `simply-plugins`**: update the plugin's command files' imports to
   `@simplysf/<plugin>-core`, add it to the plugin's `package.json` `dependencies` as a real semver
   range (`"^<published-version>"` — _not_ `workspace:^`, there's no workspace link across repos
   anymore), `git rm` the moved `common/` files, move their tests the same way 0023 did (shortening
   the relative import by one directory level), and add a row to `simply-plugins`' own
   `CONTRIBUTING.md` if the "internal library" table there needs one (it currently only lists
   `simply-plugin-kit`; check whether a "consumes a `simply-node` library" mention is clearer there
   or covered already by the generic paragraph added in 0026).
7. **This doc's own row, and each follow-up doc's row**, go in `docs/design/README.md`'s index in
   _both_ repos — this is a cross-boundary story like 0009/0019/0020/0023, so it's duplicated the
   same way those are (see 0026's "Resolved" section for why).

Two PRs per package, in two repos, in a fixed order (`simply-node` merged and released _before_
`simply-plugins`' companion PR is opened) — a real change from 0019's single-commit `git mv`, and
the reason this doc exists rather than just reusing 0019's steps verbatim.

## Alternatives considered

- **Skip history preservation for these small moves** (plain copy instead of `git subtree
split`/`add`). Considered, since each package is only 2-7 files. Rejected for consistency with
  established practice — 0026 already proved the subtree recipe out at much larger scale this
  session, so there's no remaining operational-risk argument for skipping it here, and every
  existing `-core` package's history traces back through its original commits.
- **Batch several packages' `simply-node`-side PRs together before starting any `simply-plugins`-side
  PR.** Rejected: multiplies what one PR touches for no benefit, and 0019 already rejected doing
  every extraction in one PR for the same reason at single-repo scale — cross-repo makes a batched
  PR strictly worse, not better, since a bad batch now blocks two repos' `main` branches instead of
  one.
- **Include `simply-cicd` in this round after all**, since 0019's own scoping question (`alm`/`vcs`
  only, vs. everything) could in principle be resolved now. Rejected — out of scope per explicit
  instruction for this round; nothing here blocks doing it as its own doc later.
- **Rewrite 0019 in place instead of writing this as a follow-up.** Considered. Rejected: 0019's
  candidacy criteria, per-package survey, and rejected alternatives are all still correct and worth
  keeping intact as-written; only the mechanics section assumed a monorepo that no longer exists.
  Superseding the whole doc would lose the reasoning behind decisions this doc doesn't need to
  redo.

## Implementation plan

Work through the six packages **one at a time, both PRs before starting the next**, in the order
listed under Decision. For each: write its own numbered follow-up doc (0028+, duplicated into both
repos per the boundary-crossing convention) immediately before starting, following 0009's template
and this doc's cross-repo recipe; then execute the seven steps under Behavior above.

## Testing

Inherits 0019's testing section: moved unit tests get their relative imports shortened by one
directory level; each new package gets a `test/index.test.ts` asserting the exported-keys list.
Additionally, per the two-repo split: `simply-node`'s CI must be green (and the release actually
published) before the companion `simply-plugins` PR is opened — that PR's own CI will fail to
resolve the new dependency otherwise.

## Open questions

- **Per-package exact export lists, `package.json` dependencies, and file-by-file moves** — deferred
  to each package's own follow-up doc, same as 0019 already deferred these.
- **Whether `simply-plugins`' `CONTRIBUTING.md` needs a per-package mention** of each new
  `simply-node`-published dependency, or whether the existing generic paragraph (added in 0026)
  already covers it well enough. Worth revisiting once the first package (`simply-permissions-core`)
  actually lands, when there's real prose to react to instead of guessing.
- **`eslint.config.mjs`'s stale `allPackages` entries** for packages that moved to `simply-plugins`
  in 0026 — harmless today, but worth pruning as housekeeping in the same PR that next touches this
  array (see Behavior step 4), rather than as a separate cleanup change.
