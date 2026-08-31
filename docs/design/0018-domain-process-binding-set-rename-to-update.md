# 0018 — Rename `domain-process-binding set` to `update`

**Status:** Implemented
**Package:** `packages/simply-aep-core`, `packages/simply-aep`
**Date:** 2026-08-30

## Problem

[0015](0015-at4dx-binding-validate-create-set.md) picked `update` over `set` for the new
`binding create`/`update` pair — "`update` is the more conventional SF CLI verb for 'edit an
existing record'" — but deliberately left `domain-process-binding set` (0012) and, at the time,
`field-set-inclusion set` alone, "to be reconciled in a later doc rather than as a side effect of
this one." [0016](0016-at4dx-selector-config-field-set-inclusion.md) then shipped
`field-set-inclusion update` directly (no `set` ever existed for it), and 0015 itself shipped
`binding update`. `domain-process-binding set` is now the **only** write command across the four
AT4DX CMDT families (`binding`, `domain-process-binding`, `field-set-inclusion`, and UnitOfWork
support layered onto `binding`) still using the old verb — an inconsistency a user moving between
`sf simply aep at4dx binding update ...` and `sf simply aep at4dx domain-process-binding set ...`
runs into directly.

The inconsistency isn't just the command name — it runs through the whole call stack:
`setDomainProcessBinding`, `SetDomainProcessBindingInput`/`Target`, `At4dxDomainProcessBindingSetResult`,
and the internal `scanSetContext` helper are all named after the old verb, where their `binding`/
`field-set-inclusion` counterparts (`updateBinding`/`UpdateBindingInput`/`Target`/
`At4dxBindingUpdateResult`/`scanUpdateContext`, `updateFieldSetInclusion`/... same shapes) already
use `update`.

## Decision

Rename `set` to `update` everywhere in the `domain-process-binding` write path — command, exported
core function, exported types, and the one internal helper — as a straight rename, not an
additive alias. No new behavior: same flags, same validation, same merge-on-partial-update
semantics as today's `set`.

Both affected packages are pre-1.0 (`simply-aep-core` 0.9.0, `simply-aep` 0.10.0), and this repo's
own conventions (`CLAUDE.md`) already reject compatibility shims in favor of just changing the
code — so this doc does **not** keep `domain-process-binding set` around as a deprecated alias. See
Alternatives considered.

## Behavior

No user-visible behavior changes besides the name itself:

| Before                                                    | After                                               |
| --------------------------------------------------------- | --------------------------------------------------- |
| `sf simply aep at4dx domain-process-binding set`          | `sf simply aep at4dx domain-process-binding update` |
| `setDomainProcessBinding()` (`simply-aep-core`)           | `updateDomainProcessBinding()`                      |
| `SetDomainProcessBindingInput`                            | `UpdateDomainProcessBindingInput`                   |
| `SetDomainProcessBindingTarget`                           | `UpdateDomainProcessBindingTarget`                  |
| `At4dxDomainProcessBindingSetResult`                      | `At4dxDomainProcessBindingUpdateResult`             |
| `scanSetContext` (internal, `at4dxDomainProcessWrite.ts`) | `scanUpdateContext`                                 |
| `messages/simply.aep.at4dx.domain-process-binding.set.md` | `.../domain-process-binding.update.md`              |

Flags, error codes (`DomainProcessBindingWriteErrorCode`), `DomainProcessBindingWriteError`, and
`createDomainProcessBinding`/`CreateDomainProcessBindingInput`/`Target` are unchanged — only the
`set`-named half of the pair moves.

## Alternatives considered

**Keep `set` as a deprecated alias (oclif `aliases`/`state: 'deprecated'`) pointing at the same
command class, removed in a later major.** Rejected: no command in this CLI uses that mechanism
today, both packages are pre-1.0 (where a breaking rename is exactly what minor-version churn is
for), and `CLAUDE.md` explicitly steers away from "backwards-compatibility shims when you can just
change the code." A deprecated alias would also have to fork at the type level
(`SetDomainProcessBindingInput` vs `UpdateDomainProcessBindingInput`) or silently keep the old type
names alive underneath the new command — extra surface for a rename this doc can otherwise make in
one pass.

**Leave the core function/type names as `Set*`/`set*` and rename only the CLI command.** Rejected:
that's the inconsistency this doc exists to close. `binding`/`field-set-inclusion` renamed both
layers together; doing only the CLI half here would leave `simply-aep-core`'s own public API
mismatched with its sibling functions (`updateBinding`, `updateFieldSetInclusion`), which is the
same problem one level down.

## Implementation plan

1. **`at4dxDomainProcessBindingTypes.ts`** — rename `SetDomainProcessBindingTarget` →
   `UpdateDomainProcessBindingTarget`, `SetDomainProcessBindingInput` →
   `UpdateDomainProcessBindingInput`, `At4dxDomainProcessBindingSetResult` →
   `At4dxDomainProcessBindingUpdateResult`; update the doc comments that reference `set`/
   `setDomainProcessBinding` by name.
2. **`at4dxDomainProcessWrite.ts`** — rename `scanSetContext` → `scanUpdateContext` and
   `setDomainProcessBinding` → `updateDomainProcessBinding`; update its doc comment's
   `docs/design/0012-...` cross-reference and the `writeAndDeploy` comment mentioning
   `setDomainProcessBinding` by name; update the two call sites (`mergeDomainProcessBindingRecord`'s
   `input` parameter type, `updateDomainProcessBinding`'s own signature).
3. **`src/index.ts`** (`simply-aep-core`) barrel — update the renamed exports;
   **`test/index.test.ts`** — update its exported-keys list to match.
4. **`packages/simply-aep/src/commands/simply/aep/at4dx/domain-process-binding/set.ts`** → rename
   file to `update.ts`; class `At4dxDomainProcessBindingSet` → `At4dxDomainProcessBindingUpdate`;
   update its `Messages.loadMessages(...)` key and the `setDomainProcessBinding`/type imports.
5. **`packages/simply-aep/messages/simply.aep.at4dx.domain-process-binding.set.md`** → rename to
   `domain-process-binding.update.md` (content unchanged beyond anything that literally says "set").
6. **`packages/simply-aep/src/common/domainProcessBindingWriteError.ts`** — update its doc comment's
   `createDomainProcessBinding`/`setDomainProcessBinding`/`create.ts`/`set.ts` references to
   `update`/`update.ts`.
7. **Tests** —
   `packages/simply-aep-core/test/at4dxDomainProcessWrite.test.ts`: rename the `setDomainProcessBinding`
   describe block/imports to `updateDomainProcessBinding`, no case changes (same behavior).
   `packages/simply-aep/test/commands/simply/aep/at4dx/domain-process-binding/set.test.ts` → rename
   file to `update.test.ts`, update the imported command class and CLI invocation strings
   (`at4dx:domain-process-binding:set` → `:update`).
8. **Housekeeping**, per `CLAUDE.md`: update
   `docs/design/0012-at4dx-domain-process-binding-create-set.md` and
   `docs/design/0015-at4dx-binding-validate-create-set.md` only where they describe _current_
   command names in prose (their historical "why we chose `set`/deferred the rename" narrative
   stays — these are records of what was decided when, not living specs); add this doc's row to
   `docs/design/README.md`. Run `pnpm run readme` for `simply-aep-core` and `simply-aep` (and the
   `simply` orchestrator, since `simply-aep` is bundled into it — watch for the recurring `oclif
readme` duplicate-`<!-- commandsstop -->`-block bug). Run `pnpm run build` to regenerate both
   packages' `command-snapshot.json`. Run `pnpm --filter site run sync`, keeping only the
   `simply-aep`/`simply` doc pages this touches.

## Testing

**Unit** (`simply-aep-core`): no new cases — `at4dxDomainProcessWrite.test.ts`'s existing `set`
coverage (happy path, merge-on-partial-update, force-bypass, org+source dual-write, each error code)
moves over unchanged under the renamed function/describe block. `index.test.ts`'s exported-keys
list is the one assertion that would actually fail if a rename were missed.

**Command** (`simply-aep`): `domain-process-binding/update.test.ts` (renamed from `set.test.ts`) —
same cases, invoking `at4dx:domain-process-binding:update`. Confirms the old
`at4dx:domain-process-binding:set` command id no longer resolves (implicit, since the class/file
is gone — no explicit "old command errors" test needed given no alias is kept).

**NUT**: none, matching every existing AT4DX command.

## Open questions

None — this is a same-behavior rename with a clear, already-established naming target
(`binding`/`field-set-inclusion`'s existing `update` shape).
