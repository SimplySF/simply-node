# 0022 — AT4DX `update` commands preserve existing `.md-meta.xml` shape

**Status:** Draft
**Package:** `packages/simply-aep-core`
**Date:** 2026-09-01

## Problem

`simply aep at4dx binding update`, `domain-process-binding update`, and `field-set-inclusion
update` all locate an existing `CustomMetadata` record's `.md-meta.xml` file, merge the caller's
changed fields onto the scanned record, then call `writeAndDeploy` with a document built from
scratch by `buildBindingXml`/`buildDomainProcessBindingXml`/`buildFieldSetInclusionXml`
(`at4dxBuildXml.ts`/`at4dxDomainProcessBuildXml.ts`/`at4dxFieldSetInclusionBuildXml.ts`, all built
on `customMetadataXml.ts`'s `buildCustomMetadataXml`/`buildValuesXml`). That full-document rebuild
uses one fixed field order, one fixed indentation (`buildValuesXml`'s `  <values>...</values>`, one
line per field), and knows nothing about any content the file might have beyond the fields these
three commands model.

The result: updating a _single_ field (e.g. `--priority 5`) overwrites the _entire_ file — every
field's exact `<value>` markup, whatever order the fields were originally in, any blank lines or
comments, and whatever indentation the file used before (Salesforce's own metadata retrieve, for
one, emits multi-line, deeper-indented `<values>` blocks — not this tool's compact one-liner). A
`git diff` after running `update` shows the whole file rewritten, obscuring the one field that
actually changed and fighting whatever formatting convention the file already had.

`create` doesn't have this problem — there's no existing file, so there's no shape to preserve, and
regenerating from scratch is the only option.

## Decision

Add a text-level, in-place patch path in `customMetadataXml.ts` — `patchCustomMetadataXml` — that
takes the existing file's raw text and only the `CustomMetadataValueInput` entries whose rendered
value actually differs from what's already in the file, and returns the file with **only those
`<values>` blocks' `<value>` elements replaced** (locating each by its `<field>` marker) plus
`<label>` if it changed. Every other byte — untouched fields' exact `<value>` markup (attribute
order/quoting, self-closing vs not), field order, indentation, blank lines, comments, the XML
declaration, `<protected>` — passes through unmodified, because the patch never reparses and
re-serializes the document; it only splices specific substrings.

`updateBinding`/`updateDomainProcessBinding`/`updateFieldSetInclusion` (`at4dxWrite.ts`/
`at4dxDomainProcessWrite.ts`/`at4dxFieldSetInclusionWrite.ts`) each already know whether they're
targeting local source (`scan.isLocal`, meaning `existing.filePath` is set) — the branch that
matters here already exists as `localFilePath: scan.isLocal ? existing.filePath : undefined` in
each command's `writeAndDeploy` call. They now compute the write body two ways depending on it:

- **`scan.isLocal` (an existing local file)**: read the file's current text, diff `merged` against
  `existing` field-by-field, and call `patchCustomMetadataXml` with only the changed entries.
- **Org-only update (no local file)**: unchanged — `build*Xml(merged, ...)` full-document
  generation, same as today, since there's nothing on disk to preserve (the "document" only exists
  as a temp file for the deploy).

`create` is entirely unaffected — it always calls `build*Xml`, same as today.

This is a text-surgery approach, not a DOM reparse/reserialize (`xmlbuilder2`, used elsewhere in
this repo for `simply-community`'s `patchCustomSiteXml`/`patchNetworkXml`). See Alternatives
considered for why: a DOM round-trip's own serializer reformats the _whole_ document (indentation,
self-closing-tag style) even when only mutating one node, which reintroduces exactly the shape
churn this doc exists to eliminate — plus `xsi:nil`/`xsi:type`'s namespaced attributes add real
complexity `customMetadataXml.ts` doesn't have today. Text surgery, scoped to only the spans that
actually changed, is the only approach that guarantees zero impact on anything else.

## Behavior

| Update kind                                                   | Before                                                                                        | After                                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Local file, one field changed                                 | Whole file rewritten to canonical shape                                                       | Only that field's `<value>` span changes; everything else byte-identical      |
| Local file, `--label` changed                                 | Whole file rewritten                                                                          | Only `<label>` text changes                                                   |
| Local file, no fields actually changed in value               | Whole file rewritten to canonical shape (no-op values still rewritten in the old fixed order) | File untouched byte-for-byte (patch has nothing to do)                        |
| Local file, one field's `<value>` is in an unrecognized shape | Whole file rewritten (same as every field, every time)                                        | Whole file rewritten (patch falls back to full generation for this file only) |
| Org-only update (`--target-org`, no local source)             | Full document generated for the temp deploy file                                              | Unchanged — still full document generation, nothing local to preserve         |
| `create` (new file)                                           | Full document generated                                                                       | Unchanged — no existing shape to preserve                                     |

**Which fields count as "changed."** `updateBinding`/etc. already compute `merged` (existing record
with `input`'s given fields applied) before this doc's change. The patch step additionally computes
`existingEntries = xxxValueEntries(existing)` and `mergedEntries = xxxValueEntries(merged)` (the
same per-type entry list `build*Xml` already builds internally — extracted into a shared
`xxxValueEntries(record): CustomMetadataValueInput[]` helper both the full-build and patch paths
call, so the two can never drift on field order/type), and diffs them positionally (same field name
at each position, since both lists come from the same deterministic builder) — only entries whose
`field`/`value`/`type` differ from the corresponding `existingEntries` entry go into the patch. A
binding's `sobjectAlternate` toggle is the case that touches two entries at once
(`BindingSObject__c` and `BindingSObjectAlternate__c` swap which one is nil) — both differ, so both
get patched; the label field is compared and patched the same way, separately from the `<values>`
entries.

**Locating a `<values>` block to patch.** By its `<field>NAME</field>` marker (exact text match,
case-sensitive, matching how these API names are always literally rendered by every tool that
writes them). The `<value>` element that follows — self-closing (`<value xsi:nil="true"/>`) or not
(`<value xsi:type="xsd:string">Account</value>`), on the same line or spread across several with
arbitrary internal whitespace (Salesforce's own retrieve format) — is replaced with this doc's
canonical single-line rendering for that entry (the same string `buildValuesXml` already produces
per entry, just written directly into the located span instead of through a full-document rebuild).
Everything before and after that specific `<value>...</value>`/`<value .../>` span — including the
block's own `<field>` line, its indentation, and the surrounding `<values>`/`</values>` tags — is
untouched.

**A field with no existing `<values>` block at all** (the file predates that field, e.g. a
UnitOfWork binding hand-migrated before `BindingSequence__c` existed): patch appends a new
`  <values>...</values>` line immediately before the closing `</CustomMetadata>` tag, indented to
match whatever indentation an existing `<values>` line in the file already uses (falling back to
two spaces, `buildValuesXml`'s own convention, if the file has no `<values>` blocks to sample from
— shouldn't happen in practice, since `update` requires an already-scanned record, but the code
doesn't assume it can't).

**A field whose `<values>` block exists but whose `<value>` element doesn't match the expected
self-closing-or-not pattern at all** (some XML construct genuinely outside what any tool writing
this schema produces — an XML comment spliced mid-element, for instance): `patchCustomMetadataXml`
throws a dedicated `UnpatchableValueShapeError`, and the calling `update*` function catches
specifically that error and falls back to full-document generation (`build*Xml`) for this one write
— the same behavior every update had before this doc, scoped to only the rare file it can't safely
patch instead of every file. `update` therefore never fails outright because of this — it degrades
to "reformats this one file" exactly on the files this patcher doesn't recognize, and stays
byte-preserving on every file it does. No separate signal is surfaced when the fallback fires (no
warning entry, no log line) — keeping the result shape identical whether a write was patched or
regenerated was judged not worth a new signaling path for how rare this fallback should be in
practice (every file this tool or a normal Salesforce retrieve produces matches the recognized
shape); revisit if that assumption turns out wrong.

**Missing `<label>`** (a malformed-by-this-tool's-standards file that still parsed as a record,
since local scan doesn't require `label` — see `at4dxLocalScan.ts`'s `label:
xml.CustomMetadata?.label ?? developerName` fallback): patch inserts `<label>` as the document's
first child, matching where `buildCustomMetadataXml` places it on a fresh document.

## Alternatives considered

**DOM-based patch via `xmlbuilder2`** (`simply-community`'s `patchCustomSiteXml`/`patchNetworkXml`
precedent — parse the existing document, mutate only the changed nodes, `doc.end({ prettyPrint:
true })`). Rejected: `xmlbuilder2`'s serializer reformats indentation for the _entire_ document on
every `.end()` call, not just the nodes that were mutated — re-running it on an existing file with
different indentation than `xmlbuilder2`'s own default output would still rewrite every line's
whitespace, which is the same class of problem this doc exists to eliminate, just one layer more
subtle (content stays right, whitespace still churns). `xsi:nil`/`xsi:type` are also namespaced
attributes tied to `xmlns:xsi`/`xmlns:xsd` declared on the root element — `xmlbuilder2`'s namespace
handling for setting/removing them cleanly (toggling a field between nil and a typed value, which
`update` does whenever a `keyField` flips) adds real complexity `customMetadataXml.ts` doesn't carry
today, for a library `simply-aep-core` doesn't currently depend on.

**Always full-rewrite, but preserve indentation by detecting the file's existing style first**
(sniff 2-space vs 4-space, single-line-per-block vs multi-line, then generate matching output).
Rejected: still reorders fields to the canonical order, still drops comments/unknown fields, and
"detect a handful of common styles and hope the file matches one of them" is strictly weaker than
"never touch what wasn't asked to change" for the same implementation cost.

**Patch every field `build*Xml` knows about (today's full entry list), not just the ones that
changed.** Rejected: still churns every _other_ field's `<value>` markup to this tool's canonical
rendering (attribute quoting/order, self-closing style) even when its value didn't change — smaller
diffs than a full-document rewrite, but not the "genuinely nothing else changed" guarantee this doc
is going for, and the positional-diff mechanism to get there is barely more code than building the
full entry list already is.

**New opt-in flag (`--preserve-format`) instead of making this the default.** Rejected: nothing
about "don't rewrite fields you weren't asked to touch" is a tradeoff a caller should have to
opt into — it's what `update` should already mean, and `CLAUDE.md` steers away from flags for
something the code can just do correctly by default. `simply-aep-core` is pre-1.0 (0.10.0), so
there's no compatibility surface a behavior-only fix like this needs to preserve.

## Implementation plan

1. **`customMetadataXml.ts`** —
   - Extract `buildValuesXml`'s per-entry rendering into a `valueMarkup(entry: CustomMetadataValueInput): string` helper (the `<value xsi:nil="true"/>`/`<value xsi:type="xsd:...">text</value>` fragment for one entry); `buildValuesXml` becomes a thin `entries.map(valueMarkup).join('\n')` wrapper — no behavior change, just sharing the fragment with the new patch path.
   - Add an exported `UnpatchableValueShapeError extends Error` class, and `patchCustomMetadataXml(existingXml: string, label: string, changedEntries: CustomMetadataValueInput[]): string`: patches `<label>` if `label` differs from what's currently there, then for each `changedEntries` item locates its `<values>` block by `<field>` marker and replaces the `<value>` span (regex-based: `<field>${escaped}</field>\s*` anchors the block, a second pattern matches the self-closing-or-not `<value>` element that follows), appending a new block before `</CustomMetadata>` when no block for that field exists. Throws `UnpatchableValueShapeError` if a block exists but its `<value>` element doesn't match the expected shape.
   - Add `diffValueEntries(before: CustomMetadataValueInput[], after: CustomMetadataValueInput[]): CustomMetadataValueInput[]`: positional compare (same field at each index in both arrays, since both come from the same deterministic builder), returning only entries from `after` whose `field`/`value`/`type` differ from `before`'s entry at that position.
2. **`at4dxBuildXml.ts`** — extract `buildBindingXml`'s entry-building into an exported `bindingValueEntries(record: BindingXmlFields): CustomMetadataValueInput[]`; `buildBindingXml` becomes `buildCustomMetadataXml(meta.label, buildValuesXml(bindingValueEntries(record)))`. Add `patchBindingXml(existingXml: string, existing: BindingXmlFields, merged: BindingXmlFields, meta: { label: string }): string` — computes both entry lists, diffs them (plus a `<label>` compare against the caller's `meta.label` vs. whatever it needs for comparison), calls `patchCustomMetadataXml`.
3. **`at4dxDomainProcessBuildXml.ts`**, **`at4dxFieldSetInclusionBuildXml.ts`** — same extraction/addition pattern (`domainProcessBindingValueEntries`/`patchDomainProcessBindingXml`, `fieldSetInclusionValueEntries`/`patchFieldSetInclusionXml`).
4. **`at4dxWrite.ts`**, **`at4dxDomainProcessWrite.ts`**, **`at4dxFieldSetInclusionWrite.ts`** — in each `update*` function, after `merged`/validation, branch: `scan.isLocal` → `await fs.readFile(existing.filePath!, 'utf-8')` then the type's `patch*Xml(existingText, existing, merged, { label: merged.label })`, wrapped in a `try`/`catch` that, on `UnpatchableValueShapeError` specifically (rethrow anything else), falls back to `build*Xml(merged, { label: merged.label })`; else (org-only) → today's `build*Xml(merged, { label: merged.label })` directly. `create*` functions unchanged.
5. **Tests** (`simply-aep-core`) — for each of the three `update*` functions: write a hand-crafted existing `.md-meta.xml` directly (not via `create*`) with a non-canonical shape — different field order than the canonical one, multi-line indented `<values>` blocks (Salesforce-retrieve style), an XML comment, and one field this tool doesn't model (an unrelated custom field) — then call `update*` changing one field, and assert on the raw file text: the changed field's value updated, every other line is byte-identical to the original (including the comment and the unmodeled field), and a re-scan still parses correctly. Additional cases: `--label` change patches only `<label>`; a `keyField` flip patches both SObject-reference entries and nothing else; a field missing its `<values>` block entirely gets one appended, not silently dropped; updating a field to the value it already has leaves the file byte-identical (nothing in `changedEntries`); the "value element in an unrecognized shape" case throws.
6. **Housekeeping**, per `CONTRIBUTING.md`: this is `simply-aep-core`-only — no CLI-visible flag/output/error change in `simply-aep` (its commands already just call these functions), so no `messages/*.md`, README, or `command-snapshot.json` changes needed in either package. Run `pnpm run build`/`pnpm test` for `simply-aep-core` (and `simply-aep`, since it depends on it, to confirm nothing there breaks). Set this doc's `Status` to `Implemented (PR #N)` and add its row to `docs/design/README.md`'s index.

## Testing

**Unit** (`simply-aep-core`): see step 5 above — this doc's coverage is almost entirely new
`patchCustomMetadataXml`/`diffValueEntries` unit tests plus per-command shape-preservation tests for
`updateBinding`/`updateDomainProcessBinding`/`updateFieldSetInclusion`. Existing `update*` test
cases (merge semantics, validation, error codes) are unaffected — they scan the _result_ of an
update, not its exact bytes, and the merge/validation logic this doc doesn't touch stays identical;
they continue passing against a file that's now patched instead of rebuilt (its content, if not its
literal on-disk bytes, is unchanged) since `createBinding`'s own generated file already matches
`patchBindingXml`'s canonical rendering, so patched output for those specific tests is unchanged
from before this doc. **Org-only update paths, and `create`, keep whatever generation-based tests
already exist — unaffected by this doc.**

**NUT**: none — matches the existing AT4DX command convention (no NUTs for `binding`/
`domain-process-binding`/`field-set-inclusion` write commands).

## Open questions

None — the one open call (throw vs. fall back to full rewrite when a `<value>` element is in an
unrecognized shape) was resolved in favor of falling back: `update` should never fail outright over
a formatting quirk in one field of one file, even at the cost of reformatting that one file the same
way every update did before this doc. See Behavior.
