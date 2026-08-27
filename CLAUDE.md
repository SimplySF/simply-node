# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Before writing code for a new feature

Every new feature gets a design document in `docs/design/` **before** it gets an implementation.
Read `docs/design/README.md` for the process, the template, and the list of changes that require a
doc (new commands, user-visible flag/output/error changes, new shared modules). In short:

1. Write `docs/design/NNNN-short-slug.md` from the template, using the next free number.
2. Get the design agreed on before implementing — decisions are cheapest to change there.
3. Implement, then correct the doc wherever the implementation taught you something better; a doc
   that silently disagrees with the shipped behavior is worse than no doc.
4. Add the row to the index table in `docs/design/README.md` and update the doc's `Status` line when
   the work lands.

The point is that the reasoning behind the system's shape — why a command lives in one package and
not another, what was rejected — stays recoverable later, instead of dying in PR threads. The doc
records the reasoning; `messages/*.md` records the user-facing behavior. Neither substitutes for the
other.

## Before considering a command/flag change finished

See `CONTRIBUTING.md`'s "Pull Requests" checklist in full — it's not optional. The two steps most
likely to get skipped, because nothing forces them locally the way `pnpm test` forces test failures:

1. **Update `messages/*.md`** for the command (summaries, descriptions, examples) to describe the new/changed flags.
2. **Regenerate the package's README command reference**: run `pnpm run readme` in that package's
   directory and commit the result. `simply-data` is the only package that does this automatically
   (via its `version` lifecycle script) — every other package needs the manual run.
3. **Run `pnpm run build`** for the affected package(s) so `command-snapshot.json` regenerates, and
   commit whatever changes. If the changed package is bundled into the `@simplysf/simply` orchestrator
   (see its `oclif.plugins` list), a root or `packages/simply` build also regenerates _its_
   `command-snapshot.json` automatically — no separate step needed.

CI's `git diff --exit-code` after `pnpm run build` catches a stale `command-snapshot.json`, but there
is no equivalent check for a stale README — it fails silently (published, just wrong) unless you
regenerate it yourself. This includes `packages/simply`'s own README when the changed package is
bundled into the orchestrator: unlike `command-snapshot.json`, its README does **not** regenerate
automatically — run `pnpm run readme` there too whenever a bundled package's commands change.

The docs site (`site/`) rebuilds its command-reference pages from each package's README on every
`docs.yml` run, so the _deployed_ site is never stale. The tracked `.md` files under
`site/src/content/docs/` are not regenerated as part of that CI run, though — run
`pnpm --filter site run sync` locally and commit the result, or the repo's own copies keep drifting
from what's actually live. Adding a brand-new package additionally needs two manual registrations
nothing regenerates for you: an entry in `OTHER_PLUGIN_DIRS` in
`site/scripts/sync-command-reference.mjs`, and a sidebar entry in `site/astro.config.mjs`.
