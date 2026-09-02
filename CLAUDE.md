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

## Before considering a public API change finished

See `CONTRIBUTING.md`'s "Pull Requests" checklist in full — it's not optional. The step most likely
to get skipped, because nothing forces it locally the way `pnpm test` forces test failures:

- **Update the package's README** (public API surface, examples) to describe the new/changed export.
- **Update its docs-site guide** (`site/src/content/docs/guides/<package>.md`) if the change affects
  an example shown there — the API reference under `site/src/content/docs/api/` regenerates
  automatically from JSDoc at build time, but the hand-written guides don't.
- **Check for a `simply-plugins` consumer.** Every package here except purely-internal changes to
  `simply-core`/`simply-report` is depended on by at least one plugin in the sibling
  [`simply-plugins`](https://github.com/SimplySF/simply-plugins) repo (see the table in
  `docs/design/0026-split-simply-node-simply-plugins-repos.md`). A breaking change to an exported
  function's signature, behavior, or return shape needs a coordinated version bump there — call it
  out explicitly in the PR description, since nothing here will catch it automatically.
