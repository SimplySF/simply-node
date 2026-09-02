# 0030 — Splitting `simply-community-core` out of `simply-community`

**Status:** Draft
**Package:** new `packages/simply-community-core` (in `simply-node`); `packages/simply-community`
(CLI, slimmed, in `simply-plugins`)
**Date:** 2026-09-02

## Problem

[0019](0019-plugin-core-library-extraction.md) marked `simply-community` a **candidate**: its
`src/common/` holds seven CLI-independent modules (~640 lines total), none importing `@oclif/core`
or `@salesforce/sf-plugins-core` (confirmed by inspection), each with a plausible non-CLI consumer.
[0027](0027-core-extraction-round-1-post-split.md)/[0028](0028-simply-permissions-core.md) put it
third in round 1.

Re-verified today (reading every file in full):

- **`publishCommunity.ts`** (69 lines): `publishCommunity` — triggers a community publish via the
  Connect REST API and polls to completion. No existing test (the one gap in otherwise-good
  coverage — 6 of 7 files have tests).
- **`checkPublishStatus.ts`** (62 lines): `checkPublishStatus` — builds the `PollingClient`-compatible
  poll function `publishCommunity` uses.
- **`deployChangedFiles.ts`** (86 lines): `deployChangedFiles` — deploys a specific file list and
  polls to completion.
- **`retrieveCustomSite.ts`** (61 lines): `retrieveCustomSite` — retrieves a single `CustomSite`
  component by name.
- **`resolveSiteFiles.ts`** (157 lines): `resolveSearchRoots`, `resolveRetrieveDestination`,
  `resolveSiteFile`, `resolveNetworkFile` — locates `sites/*.site-meta.xml`/`networks/*.network-meta.xml`
  files on disk. Imports `siteMetadataXml.ts`'s `readNetworkSiteName`.
- **`siteMetadataXml.ts`** (126 lines): `patchCustomSiteXml`, `patchNetworkXml`, `readNetworkSiteName`
  — pure XML template functions, `xmlbuilder2`-based, no org access.
- **`verifyDomain.ts`** (79 lines): `verifyDomain` — checks whether a custom domain is registered
  in the target org via SOQL (`Domain`/`DomainSite` aren't in the metadata registry).

All seven take a `Connection`/plain data as arguments, same shape as every other `-core` package's
functions — no flag-builder or `ux`/prompt concerns anywhere.

## Decision

Extract `packages/simply-community/src/common/*` verbatim into a new `simply-node` package,
`@simplysf/simply-community-core`, following 0028's/0029's recipe (0027's corrected cross-repo
mechanics). `packages/simply-community` (in `simply-plugins`) keeps its commands and depends on the
new package as a published npm dependency.

1. **New package, `packages/simply-community-core`** (in `simply-node`). Plain library shape.
   `dependencies`: `@salesforce/core` (`Connection`, `SfError`, `PollingClient` —
   `checkPublishStatus.ts`/`publishCommunity.ts`/`deployChangedFiles.ts`/`retrieveCustomSite.ts`/`verifyDomain.ts`),
   `@salesforce/kit` (`Duration` type — `publishCommunity.ts`/`deployChangedFiles.ts`),
   `@salesforce/source-deploy-retrieve` (`ComponentSet`, `ComponentStatus` —
   `deployChangedFiles.ts`/`retrieveCustomSite.ts`), `@simplysf/simply-core`
   (`retryWithBackoff`/`getDefaultPackageDirectory`/`readSfdxProject`/`escapeSoqlLiteral` — `workspace:^1.5.1`,
   intra-repo now, both packages live in `simply-node`), `glob` (`resolveSiteFiles.ts`), `xmlbuilder2`
   (`siteMetadataXml.ts`). No `@oclif/core`, no `@salesforce/sf-plugins-core`, no
   `@simplysf/simply-plugin-kit` — confirmed by inspection that no moved file imports any of them.
2. **Move the seven files** via 0027's corrected cross-repo recipe, split from `simply-community`'s
   pre-merge tip (`4c7e376a979937d92e6e8e1bbcbb0b817cce6d1e` — its second parent off
   `chore: add simply-community split history`, confirmed reachable with 5 commits touching
   `src/common`), `--prefix=src/common`, subtree-add into
   `packages/simply-community-core/src/common`, then flatten. **No relative-import fix needed**
   this time (unlike 0029): `resolveSiteFiles.ts`'s import of `./siteMetadataXml.js` is a same-directory
   sibling within `common/` — flattening moves both files together, so their relative position to
   each other is unchanged (the 0029 bug only applies to imports crossing into a _different_
   subdirectory that isn't also being flattened, which doesn't happen here since everything lives
   directly in `common/`, not nested further).
3. **`packages/simply-community-core/src/index.ts`** — new barrel, re-exporting everything each
   moved file already exports as public.
4. **`simply-community` (in `simply-plugins`) depends on `simply-community-core`** as a real semver
   range (`^0.1.0` once published). Command files that import from `../../common/*.js` change to
   `@simplysf/simply-community-core`. `@salesforce/kit`, `@salesforce/source-deploy-retrieve`,
   `glob`, `xmlbuilder2` drop from `simply-community`'s own `dependencies` only if nothing else in
   the package imports them directly — checked below (Decision's Behavior section resolves this,
   not left open).
5. **Document like a library**: `README.md`'s `## API` section, `CONTRIBUTING.md` stub (copy
   `simply-sobject-core`'s, swap the package-specific paragraph), `test/index.test.ts` asserting the
   exported-key list.
6. **Same `"exports"`/`"main"`/`"types"` fallback shape** as every prior `-core` package.

### Whether each dependency also drops from `simply-community`

Checked by grepping `packages/simply-community/src` outside `common/` for each:

| Dependency                           | Used elsewhere in `simply-community`? | Stays in `simply-community`'s `dependencies`? |
| ------------------------------------ | ------------------------------------- | --------------------------------------------- |
| `@salesforce/kit`                    | to be checked at implementation time  | —                                             |
| `@salesforce/source-deploy-retrieve` | to be checked at implementation time  | —                                             |
| `glob`                               | to be checked at implementation time  | —                                             |
| `xmlbuilder2`                        | to be checked at implementation time  | —                                             |

This table is intentionally left for implementation time (per 0019's own rule about not
pre-committing to specifics best checked close to implementation) rather than guessed here.

## Behavior

### `@simplysf/simply-community-core` — new package

```ts
import { publishCommunity } from '@simplysf/simply-community-core';

const result = await publishCommunity({ connection, networkId: '0DM...', wait: 10 });
```

```ts
import { deployChangedFiles } from '@simplysf/simply-community-core';

const result = await deployChangedFiles({ connection, filePaths: ['force-app/.../mysite.site-meta.xml'], wait });
```

```ts
import { resolveSiteFile, resolveNetworkFile, resolveSearchRoots } from '@simplysf/simply-community-core';

const roots = await resolveSearchRoots(undefined, projectDir);
const siteFile = await resolveSiteFile('MySite', roots);
```

```ts
import { patchCustomSiteXml } from '@simplysf/simply-community-core';

const { xml, previousDomains } = patchCustomSiteXml(currentXml, { domain: 'my.example.com', primary: true });
```

```ts
import { verifyDomain } from '@simplysf/simply-community-core';

const check = await verifyDomain(connection, 'my.example.com');
```

Every function's signature and return shape is unchanged from what `simply-community`'s commands
call today — only the import specifier changes.

Full export list (barrel contents), by source file:

| File                    | Exports                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `checkPublishStatus.ts` | `checkPublishStatus`                                                                                                              |
| `deployChangedFiles.ts` | `deployChangedFiles`, `type DeployChangedFilesOptions`, `type DeployComponentFailure`, `type DeployChangedFilesResult`            |
| `publishCommunity.ts`   | `publishCommunity`, `type PublishCommunityOptions`                                                                                |
| `resolveSiteFiles.ts`   | `resolveSearchRoots`, `resolveRetrieveDestination`, `resolveSiteFile`, `resolveNetworkFile`                                       |
| `retrieveCustomSite.ts` | `retrieveCustomSite`                                                                                                              |
| `siteMetadataXml.ts`    | `patchCustomSiteXml`, `type PatchCustomSiteXmlOptions`, `type PatchCustomSiteXmlResult`, `patchNetworkXml`, `readNetworkSiteName` |
| `verifyDomain.ts`       | `verifyDomain`, `type DomainCheckStatus`, `type DomainCheckResult`                                                                |

`package.json` shape:

```json
{
  "name": "@simplysf/simply-community-core",
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
    "@salesforce/core": "^8.30.0",
    "@salesforce/kit": "^3.2.6",
    "@salesforce/source-deploy-retrieve": "^12.37.2",
    "@simplysf/simply-core": "workspace:^1.5.1",
    "glob": "^13.0.6",
    "xmlbuilder2": "^4.0.3"
  }
}
```

No `oclif` block, no `bin/`, no `@oclif/core`, no `@salesforce/sf-plugins-core`, no
`@simplysf/simply-plugin-kit`, no `messages/`.

### `@simplysf/simply-community` — CLI, slimmed (in `simply-plugins`)

- Command files import from `@simplysf/simply-community-core` instead of relative `common/*.js`
  paths.
- `package.json` gains `@simplysf/simply-community-core: "^0.1.0"`; drops whichever of
  `@salesforce/kit`/`@salesforce/source-deploy-retrieve`/`glob`/`xmlbuilder2` nothing else imports
  directly (checked at implementation time per the table above).
- `messages/`, `oclif` config, `bin/`, and command behavior are unchanged.

### Public-API test (in `simply-community-core`)

`test/index.test.ts` asserts `Object.keys(api).sort()` against:
`['checkPublishStatus', 'deployChangedFiles', 'patchCustomSiteXml', 'patchNetworkXml', 'publishCommunity', 'readNetworkSiteName', 'resolveNetworkFile', 'resolveRetrieveDestination', 'resolveSearchRoots', 'resolveSiteFile', 'retrieveCustomSite', 'verifyDomain']`.

## Alternatives considered

**Split `resolveSiteFiles.ts`/`siteMetadataXml.ts` (file-lookup and XML-patching) into their own
package, separate from the org-interacting functions.** Rejected: all seven functions serve the same
overall "manage a Community's custom site/domain" story a single non-CLI consumer would want as one
unit (an editor extension resolving, patching, and deploying a site file), and 0019's criteria don't
call for splitting a cohesive feature area into multiple packages when nothing about the boundary is
contested the way `simply-cicd`'s was.

## Implementation plan

Per 0027's cross-repo recipe, using `simply-community`'s pre-merge tip
(`4c7e376a979937d92e6e8e1bbcbb0b817cce6d1e`):

1. **In `simply-plugins`**: `git subtree split --prefix=src/common <tip> -b
split/simply-community-core`.
2. **In `simply-node`**: subtree-add into `packages/simply-community-core/src/common`, flatten.
3. **Scaffold the rest**: `package.json` per Behavior above; `tsconfig.json`/`test/tsconfig.json`/`.gitignore`
   (copy `simply-sobject-core`'s); `vitest.config.ts` participation via the root config's
   auto-discovery.
4. **Move existing tests**: `checkPublishStatus.test.ts`, `deployChangedFiles.test.ts`,
   `resolveSiteFiles.test.ts`, `retrieveCustomSite.test.ts`, `siteMetadataXml.test.ts`,
   `verifyDomain.test.ts` (shortened relative imports by one directory level). Add fresh coverage
   for `publishCommunity.ts` — no existing test to move.
5. **Write `packages/simply-community-core/src/index.ts`** — the barrel, per Behavior's export
   table.
6. **`packages/simply-community-core/README.md`**/**`CONTRIBUTING.md`** — model on
   `simply-sobject-core`'s.
7. **`simply-node`'s `eslint.config.mjs`** — add `packages/simply-community-core` to both
   `allPackages` and `libraryPackages`.
8. **`simply-node`'s `CONTRIBUTING.md`** — add a row to the repository structure table.
9. **`simply-node`'s `docs/design/README.md`** — add this doc's row.
10. **Open the PR against `simply-node`**, get it merged, confirm publish. Given 0028/0029 both hit
    npm's trusted-publisher first-publish constraint, expect the same here — a one-time manual
    `pnpm publish --access public --no-git-checks` from `packages/simply-community-core` (not
    plain `npm publish`, which doesn't rewrite the `workspace:` reference — see 0028's follow-up).
    Also expect to need a `minimumReleaseAgeExclude` entry for the freshly-published version in
    `simply-plugins`' `pnpm-workspace.yaml` before its companion PR's install succeeds (same gotcha
    0028's companion hit).
11. **In `simply-plugins`**: update `packages/simply-community`'s command files' imports, resolve
    the dependency table above by grepping for each package outside `common/`, `git rm` the moved
    files, update `package.json`, add this doc's duplicate to `docs/design/`.
12. **Housekeeping per `CONTRIBUTING.md`** (both repos): `pnpm run readme` in `simply-community`;
    `pnpm run build` at each repo's root.
13. **Not a breaking change to `@simplysf/simply-community`'s published surface** — its `index.ts`
    was already the stub. `@simplysf/simply-community-core` starts fresh at `0.1.0`.

## Testing

**Unit** — move the six existing test files as-is (shortened relative imports). New test for
`publishCommunity`: success path (polling completes), failure path (`checkPublishStatus`'s poll
throws), and the retry-on-initial-request-failure path (`retryWithBackoff` with `retryAttempts > 0`
succeeding on a later attempt). `test/index.test.ts` per the Public-API-test section above.

**`simply-community` command tests** — unchanged in behavior; re-run in full after the import-path
change.

**Manual verification**: not applicable — pure file-location and dependency-graph change.

## Open questions

None left for this doc — the one deliberately deferred question (which of the four shared
dependencies also drop from `simply-community`'s own `package.json`) is Implementation-plan work,
not a design decision.
