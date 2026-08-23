# 0003 — `simply community url set`

**Status:** Draft
**Package:** `packages/simply-community`
**Date:** 2026-08-23

## Problem

Pointing an Experience Cloud site at a custom URL is environment-specific: the same branch deploys
to a sandbox as `uat-partners.acme.com` and to production as `partners.acme.com`. The domain lives in
committed metadata, so every pipeline that deploys a site ends up hand-scripting an edit to that
metadata just before the deploy — `sed` against `.site-meta.xml`, or a bespoke Node script per repo.

Those scripts are brittle for a specific reason: the value isn't in one place, and it isn't where
people expect. "Modify the network metadata" is the common shorthand, but the domain is not on
`Network` at all.

| What                       | File                                  | Element                             |
| -------------------------- | ------------------------------------- | ----------------------------------- |
| Custom domain              | `sites/<Site>.site-meta.xml`          | `customWebAddresses` → `domainName` |
| Primary-URL flag           | `sites/<Site>.site-meta.xml`          | `customWebAddresses` → `primary`    |
| URL path prefix            | `sites/<Site>.site-meta.xml`          | `urlPathPrefix`                     |
| URL path prefix (again)    | `networks/<Network>.network-meta.xml` | `urlPathPrefix`                     |
| Link between the two files | `networks/<Network>.network-meta.xml` | `site` → the CustomSite API name    |

A real `CustomSite` (`siteType` `ChatterNetwork`, i.e. an Experience Cloud site) carries:

```xml
<customWebAddresses>
    <domainName>helpdesk.example.com</domainName>
    <primary>false</primary>
</customWebAddresses>
<subdomain>examplepets</subdomain>
<urlPathPrefix>help</urlPathPrefix>
```

So a correct change touches two files that have to stay in agreement, and a script that only knows
about one of them silently half-works.

## Decision

Add `sf simply community url set` to `packages/simply-community`, under a new `url` subtopic beside
the existing `simply community publish`.

The command has two modes.

**Default — patch only.** It patches the working tree in place and stops. It does not deploy, and it
does not restore. This is a pre-deploy step that composes with whatever deploy command the pipeline
already runs:

```sh
sf simply community url set --site Partner_Portal --domain partners.acme.com --path-prefix partners
sf project deploy start --source-dir force-app --target-org prod
```

**With `--deploy` — patch, deploy, restore.** The command deploys only the files it changed and then
puts them back, so the sole lasting change is in the org. This is the ad-hoc and one-shot case:

```sh
sf simply community url set --site Partner_Portal --domain partners.acme.com \
  --deploy --publish --target-org prod
```

Restore is implied by `--deploy` rather than being a flag of its own. The point of the mode is that
the tree is untouched afterwards; a `--deploy` that quietly left the working tree dirty would set
exactly the trap the hand-rolled scripts already set today.

`simply-community` is the right home: it already owns the `simply community` topic vocabulary and
the Experience Cloud domain, and it's bundled into the `@simplysf/simply` orchestrator, so the
command ships to everyone rather than only to direct installs.

### Two constraints that shape the design

**Writing `customWebAddresses` is replace-all, not additive.** Per the CustomSite metadata reference:
"Saving or deploying a CustomSite replaces all root custom URLs in the site with the root custom
URLs in this list." The command therefore replaces the whole list with a single entry rather than
appending — appending would imply a merge that the deploy is going to discard anyway. Non-root path
custom URLs are unaffected.

**The domain must already exist in the target org.** `Domain` and `DomainSite` are not in the
`@salesforce/source-deploy-retrieve` metadata registry (verified against the copy in this repo's
`node_modules`), so the CLI cannot source-deploy them. Registering the domain is a one-time Setup
step (Setup → Custom URLs) plus a CNAME at the DNS provider. This command sets which domain the site
claims; it cannot create the domain.

## Behavior

```sh
sf simply community url set --site Partner_Portal --domain partners.acme.com
sf simply community url set --site Partner_Portal --domain partners.acme.com --path-prefix partners
```

### Flags

| Flag                      | Char | Required        | Purpose                                                                                                                           |
| ------------------------- | ---- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `--site`                  | `-s` | yes             | CustomSite API name — the basename of `sites/<name>.site-meta.xml`.                                                               |
| `--domain`                | `-d` | yes             | Fully qualified custom domain, e.g. `partners.acme.com`.                                                                          |
| `--path-prefix`           | `-p` | no              | URL path prefix. When given, written to **both** the site and network files.                                                      |
| `--primary`               | —    | no              | Whether the entry is the site's primary URL. Defaults to `true`.                                                                  |
| `--directory`             | —    | no              | Root to search. Defaults to the package directories in `sfdx-project.json`.                                                       |
| `--deploy`                | —    | no              | Deploy the changed files, then restore them. Defaults to `false`.                                                                 |
| `--publish`               | —    | no              | After a successful deploy, publish the site and wait for it. Requires `--deploy`.                                                 |
| `--target-org`            | `-o` | with `--deploy` | Org to deploy to, and the org the preflight queries. Supplied by the shared `targetOrgFlags` already used by `community publish`. |
| `--wait`                  | `-w` | no              | Minutes to wait for the deploy, matching `sf project deploy start`'s default of `33`.                                             |
| `--ignore-missing-domain` | —    | no              | Downgrade "domain is not registered in this org" from an error to a warning. Defaults to `false`.                                 |

**On `-d`:** the `sf` CLI convention is `-d` = `--source-dir`, and `simply project update api-version`
follows it with `--directory -d`. This command deliberately diverges: `--domain` is typed on every
invocation and `--directory` is almost always defaulted, so the short char goes to the flag that
earns it. `--directory` keeps its long form only.

### Preflight: is the domain registered in the org?

The single most likely failure is pointing a site at a domain the org has never heard of. As
established above, this command cannot create a domain — `Domain` and `DomainSite` aren't deployable
— so a typo or a domain that was only ever registered in one sandbox produces a deploy failure with
a Salesforce-side message that doesn't say much.

Both objects are read-only but SOQL-queryable (API 26.0+), so the check is one query. Note the field
holding the domain string is `Domain`, not `DomainName`, and the child relationship is `DomainSites`:

```sql
SELECT Id, Domain, DomainType, OptionsExternalHttps, CnameTarget,
       (SELECT Id, SiteId, PathPrefix FROM DomainSites)
FROM Domain
WHERE Domain = '<--domain>'
```

The literal is escaped with `escapeSoqlLiteral` from `@simplysf/simply-core`, as `community publish`
already does.

**The preflight runs before anything is written.** If it fails, no file has been touched — the
command must not leave a half-applied patch behind because a lookup failed.

**When it runs:** whenever a `--target-org` is available. In `--deploy` mode that's always, since the
org is required. In patch-only mode `--target-org` is optional, and supplying it opts into the check;
omitting it skips the check and keeps the default mode usable with no org at all, which matters for
running this on a build agent that hasn't authenticated yet.

| Query outcome                                 | Behavior                                                                                                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exactly one `Domain`, no `DomainSites`        | Proceed. The deploy will bind it.                                                                                                                               |
| One `Domain`, already bound to **this** site  | Proceed silently — the common re-run case.                                                                                                                      |
| One `Domain`, bound to a **different** site   | Warn, naming the other site id and its `PathPrefix`. Do not fail: this is legal, and it's also exactly what someone repointing a domain intends.                |
| No rows                                       | Error, unless `--ignore-missing-domain`, in which case warn and proceed.                                                                                        |
| Query itself fails (no permission, API error) | Warn that the preflight could not run, and proceed. `--ignore-missing-domain` is not needed for this — an inability to check is not the same as a failed check. |

That last row is the one worth arguing about. Treating an unrunnable check as fatal would make the
command depend on the caller having read access to `Domain`, which is a new permission requirement
for something that is a convenience. Treating it as a warning keeps the check advisory, which is
what it is.

`--ignore-missing-domain` deliberately does **not** suppress the other warnings, and does not skip
the query. The user still gets told what's wrong; they've just said they expect to fix it out of
band — most plausibly a pipeline that registers the domain in an earlier step, or a validate-only
run against an org that intentionally lags.

### Resolution rules

| Step              | Rule                                                                                                                                | On failure                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Find site file    | Glob `<directory>/**/sites/<--site>.site-meta.xml`. Exactly one match required.                                                     | Error naming the glob, or listing the ambiguous matches. |
| Find network file | Only when `--path-prefix` or `--publish` is given. Any `<directory>/**/networks/*.network-meta.xml` whose `<site>` equals `--site`. | Error if zero or more than one match.                    |

The network file is looked up **only** when `--path-prefix` or `--publish` is supplied —
`--path-prefix` because the prefix is written there, `--publish` because the file's basename is how
the Network's name is resolved. Setting a domain alone touches neither, so a missing or ambiguous
network file isn't an error in that case — which also means the command works for Salesforce Sites
that have no `Network` at all.

### What it writes

To `sites/<Site>.site-meta.xml`:

- Replaces every existing `customWebAddresses` element with exactly one, containing `domainName`
  (from `--domain`) and `primary` (from `--primary`, default `true`).
- Sets `urlPathPrefix` when `--path-prefix` is given.

To `networks/<Network>.network-meta.xml`, only when `--path-prefix` is given:

- Sets `urlPathPrefix` to the same value.

### `--deploy`: what gets deployed, and the restore contract

The deploy is built with `ComponentSet.fromSource()` over **only the files the command just
changed** — the site file, plus the network file when `--path-prefix` was given. It deploys one or
two components and nothing else. Widening it to the whole `--directory` would mean re-implementing
`sf project deploy start`'s flag surface (test levels, conflict handling, concise output) and then
permanently lagging it; the pipeline's own deploy still runs separately when it needs to.

This is the repo's first metadata **write** through SDR — `simply-document`, `simply-permissions`,
and `simply-schema` all use `ComponentSet.fromSource()` read-only. Deploying in-process rather than
shelling out to `sf` is the right call here: the command already holds a connection via
`requireConnection`, and `simply-cicd`'s `runSf` execa helper isn't reachable from this package (nor
should `simply-community` depend on `simply-cicd`).

**Restore runs in a `finally`, whether or not the deploy succeeded.** The contract is that `--deploy`
never leaves the working tree modified — a failed deploy that left a dirty tree would be the worst
of both worlds, since the caller would have neither the org change nor a clean checkout. The
originals are held in memory (two small files) and rewritten byte-for-byte.

The obvious objection is that a failed deploy is then harder to debug, because the metadata that
failed is gone. The answer is that **running the same command without `--deploy` reproduces the
patch exactly** and leaves it on disk for inspection — the patch is deterministic, and the
idempotency test below is what guarantees that. The error message says so.

If the restore itself fails, the command reports the deploy result _and_ the restore failure, and
exits non-zero naming the files left modified. That's the one path where a dirty tree is possible,
and it must be loud rather than silent.

### `--publish`

Site metadata changes generally need a publish before they take effect on the live site, so a
deployed URL that was never published is a plausible footgun. `--publish` is opt-in rather than
automatic because publishing is slow and many pipelines publish once at the end; it requires
`--deploy`, since publishing without deploying would publish whatever is already in the org.

It reuses `checkPublishStatus` and the Connect API call from `simply community publish` rather than
reimplementing them — that command already polls to a terminal state instead of returning as soon
as the request is accepted.

One wrinkle: `simply community publish` identifies a site by the **Network `Name`**, while this
command takes a **CustomSite API name**. The bridge is the network file — its basename is the
Network's full name, and its `<site>` element points at the CustomSite. So `--publish` forces the
network-file lookup even when `--path-prefix` was not given, and the "zero or ambiguous network
file" errors apply to it too. See the open question below about verifying that the file basename
really does equal the queryable `Network.Name`.

### Output

A table of files changed, and this JSON result:

```ts
export type CommunityUrlSetResult = {
  site: string;
  domain: string;
  primary: boolean;
  pathPrefix?: string;
  siteFile: string;
  networkFile?: string;
  previousDomains: string[];
  /** Absent when no --target-org was available to query. */
  domainCheck?: {
    /** 'found' | 'missing' | 'unavailable' — 'unavailable' means the query itself failed. */
    status: string;
    domainId?: string;
    /** Site ids this domain is already bound to, if any. */
    boundToSiteIds: string[];
    /** True when status was 'missing' and --ignore-missing-domain let the run continue. */
    ignored: boolean;
  };
  /** Absent when --deploy was not passed. */
  deploy?: {
    id: string;
    status: string;
    componentsDeployed: string[];
    restored: boolean;
  };
  /** Absent unless --publish was passed and the deploy succeeded. */
  publish?: {
    networkName: string;
    jobId: string;
    url: string;
  };
};
```

`previousDomains` records what the replace-all discarded, so a pipeline log shows what was dropped
rather than silently losing it. `deploy.restored` is `false` only when restore itself failed, which
is also an error exit — it exists so the JSON says which state the tree was left in.

### Errors

| Condition                                         | Behavior                                                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain not registered in the org                  | Error **before any file is written**, naming the domain and the org. Downgraded to a warning by `--ignore-missing-domain`.                            |
| `--ignore-missing-domain` with no `--target-org`  | Warn that the flag had no effect — there was no check to ignore.                                                                                      |
| No site file matches `--site`                     | Error, naming the glob that was tried.                                                                                                                |
| More than one site file matches                   | Error, listing the matched paths.                                                                                                                     |
| `--path-prefix` given, no network references site | Error naming the CustomSite API name that was searched for.                                                                                           |
| `--path-prefix` given, multiple networks match    | Error, listing the matched paths.                                                                                                                     |
| Site file isn't parseable XML                     | Error, naming the file.                                                                                                                               |
| `--publish` without `--deploy`                    | Error at parse time — publishing without deploying would publish stale org state.                                                                     |
| `--deploy` without `--target-org`                 | Error at parse time, from the standard org-flag handling.                                                                                             |
| `--publish` given, network file missing/ambiguous | Same errors as the `--path-prefix` cases — `--publish` needs the network file to resolve the Network name.                                            |
| Deploy fails                                      | Restore still runs, then error with the component failures and a note that re-running without `--deploy` reproduces the patch for inspection.         |
| Restore fails                                     | Error naming the files left modified, alongside the deploy result. The only path that leaves a dirty tree.                                            |
| Publish fails after a successful deploy           | Error, but the deploy is reported as succeeded — the org change is real and re-running `--publish` alone is not a supported retry, so say so plainly. |

## Alternatives considered

**Connect REST API instead of metadata.** Salesforce exposes Custom Domain resources in the Connect
REST API. Rejected for v1 on two grounds. First, I could not confirm write support — both reference
pages (`connect_resources_custom_domain_custom_urls_site` and the Custom Domain Resources section of
the Connect REST API core reference) returned 404, so the capability is unverified. Second, and more
decisively, it solves a different problem: it mutates org state, but the committed metadata still
carries the old domain, so the next deploy overwrites whatever the API set. The value has to be
right in the source for the deploy to be correct. Worth revisiting as a verification aid, not as the
mechanism.

**Deploy `Domain` / `DomainSite` metadata so the command can create the domain too.** Not possible.
Neither type is in the SDR metadata registry, so `sf project deploy start` can't handle them. The
domain stays a Setup prerequisite.

**Patch, deploy, then restore in one command.** Originally rejected in this doc, then **adopted** as
the opt-in `--deploy` mode. The reversal is worth recording, because what changed was the scope, not
the opinion.

The original objection was that such a command "would have to re-expose `sf project deploy start`'s
flag surface and reproduce its error handling." That objection holds when the command deploys the
whole source directory — it would inherit test levels, conflict handling, and everything else, and
lag the real command forever. It does **not** hold when the deploy is scoped to the one or two files
the command itself just wrote: the flag surface collapses to `--target-org` and `--wait`, and the
component list is known exactly rather than discovered.

The second objection — that a restore which doesn't run leaves an unexpectedly dirty tree — is
answered by making restore unconditional (`finally`, not on-success) and by making a restore failure
a loud, non-zero, file-naming error rather than a silent one. Restore is deliberately _not_ its own
flag: an opt-in `--restore` would leave `--deploy --restore` as the only sensible combination and
`--deploy` alone as a trap.

Patch-only remains the default, so nothing about the composable pre-deploy story changed.

**Patch into a temp copy and deploy from there.** Still rejected, and `--deploy` doesn't revive it.
Deploying from a temp directory would deploy a component set assembled outside the project, losing
`sfdx-project.json` context; patching in place, deploying, and restoring gets the same "originals
untouched" outcome without that.

**Patch plus a separate restore command.** Still rejected: the pipeline would have to guarantee the
restore runs even when the deploy fails, which is exactly the scripting this command exists to
delete. Folding restore into `--deploy`'s `finally` is that guarantee, made by the command instead
of the caller.

**Shell out to `sf project deploy start` for `--deploy`.** Rejected. It's the pattern `simply-cicd`
uses (`runSf` over execa), but that helper lives in a package `simply-community` must not depend on,
and a plugin spawning the CLI that is currently running it is a strange shape — it loses the
connection already in hand, the typed deploy result, and the ability to report per-component
failures.

**Always publish when `--deploy` is used.** Rejected in favour of opt-in `--publish`. It would
remove a real footgun, but publishing is slow and plenty of pipelines deliberately publish once at
the end of a run rather than per change.

**Name the escape hatch `--skip-domain-check` instead of `--ignore-missing-domain`.** Rejected,
because they are different behaviors and the narrower one is better. Skipping suppresses the query
entirely, so the user learns nothing; ignoring still runs the check, still prints what's wrong, and
merely declines to fail on it. The cost of the query is one SOQL call, so there's no performance
argument for skipping.

**Reuse the `--ignore-errors` name from `simply community publish`.** Rejected. That flag means "log
a warning and exit successfully if the operation fails", which is a blanket suppression. Giving the
same name a narrow meaning in a sibling command — ignore _only_ a missing domain, while a failed
deploy still fails — would be worse than an inconsistent name. If a blanket `--ignore-errors` is
wanted here later, the name is still free.

**Make an unrunnable preflight fatal.** Rejected. It would make the command require read access to
`Domain` for everyone, turning an advisory convenience into a new permission requirement. A warning
preserves the value for the common case without adding a way for the command to fail that has
nothing to do with what the user asked for.

**Check the domain by attempting a validate-only deploy instead of querying.** Rejected: it's far
slower, it requires `--target-org` in patch-only mode where the point is to work without an org, and
the resulting error is the same unhelpful Salesforce message the preflight exists to replace.

**Targeted regex surgery, as `simply project update api-version` does.** Genuinely attractive — it
keeps diffs minimal, which matters if someone runs this locally. Rejected because that command swaps
a scalar (`<apiVersion>`) whereas this one inserts and removes a repeated structured element.
Regexes over repeated blocks are where this class of tool breaks. Using `xmlbuilder2` (already a
dependency of `simply-permissions`) costs a possible one-time reformat of unrelated whitespace on
first run; acceptable given the in-place, CI-oriented use, but it is a real cost and is the thing to
revisit if local use turns out to be common.

**Home it in `simply-cicd`.** Rejected: `simply-cicd` is published standalone and deliberately not
bundled into the orchestrator, so the command would only reach people who install it directly.

## Implementation plan

Files added or changed, in the order they'd be written:

1. **`packages/simply-community/package.json`** — add the `url` subtopic under
   `oclif.topics.simply.subtopics.community.subtopics`, matching how `simply-package` nests
   `version`; add the `xmlbuilder2` and `@salesforce/source-deploy-retrieve` dependencies (both
   already used elsewhere in the monorepo, so pin to the versions in use).
2. **`src/common/siteMetadataXml.ts`** — parse, mutate, and serialize `CustomSite` and `Network`
   documents. Owns the replace-all semantics for `customWebAddresses` and the `urlPathPrefix` write.
3. **`src/common/resolveSiteFiles.ts`** — the glob and one-match rules above, including finding the
   `Network` whose `<site>` element matches. Uses `readSfdxProject` from `@simplysf/simply-core` to
   default `--directory` to the project's package directories.
4. **`src/common/verifyDomain.ts`** — the preflight query and its outcome mapping. Pure function over
   a connection plus a domain string, returning the `domainCheck` shape, so the command layer only
   decides whether an outcome is fatal.
5. **`src/common/deployChangedFiles.ts`** — build a `ComponentSet` from the changed paths, deploy
   against the connection, poll to a terminal state, and map component failures into a reportable
   shape. Kept separate from the command so the restore `finally` stays readable.
6. **Refactor `src/common/checkPublishStatus.ts`'s caller** — lift the publish request plus poll out
   of `commands/simply/community/publish.ts` into a shared helper both commands call, rather than
   duplicating the Connect API call. `publish.ts` keeps its behavior and flags exactly as they are.
7. **`src/commands/simply/community/url/set.ts`** — the command, including the `try`/`finally` that
   guarantees restore.
8. **`messages/simply.community.url.set.md`** — summary, description, flag summaries, examples.
9. **Tests** — `test/common/siteMetadataXml.test.ts`, `test/common/resolveSiteFiles.test.ts`,
   `test/commands/simply/community/url/set.test.ts`, plus a NUT (see below).
10. **`pnpm run readme`** in `packages/simply-community` — this package does not regenerate its README
    automatically, and there's no CI check for a stale one.
11. **`pnpm run build`** in the package to regenerate `command-snapshot.json`. Because
    `simply-community` is bundled into `@simplysf/simply`, a root build also regenerates the
    orchestrator's snapshot — commit both.

Step 6 is the only change to existing behavior in this plan, and it is a pure refactor: if
`publish.ts`'s tests need edits beyond imports, the extraction went too far.

## Testing

Unit tests against fixture XML written to a temp directory, plus one NUT now that `--deploy` touches
an org.

| Case                                                     | What it pins down                                                                                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Site file with 0, 1, and 3 existing `customWebAddresses` | Always exactly one entry afterwards; `previousDomains` reports what was dropped.                                                                |
| `--path-prefix` omitted                                  | Network file is not opened, let alone written.                                                                                                  |
| `--path-prefix` given                                    | Both files end up with the same prefix.                                                                                                         |
| 0, 1, and 2 networks whose `<site>` matches              | Error / success / error, with the paths named.                                                                                                  |
| Run the command twice                                    | Second run is a byte-identical no-op — the guard against reformat churn on every pipeline run.                                                  |
| Domain containing XML-significant characters             | Escaped via `xmlbuilder2`'s text handling, not hand-rolled escaping (matching the note in `simply-permissions`' `permissionSetXmlTemplate.ts`). |
| Site not found, ambiguous site match                     | Error messages name the glob and the matches.                                                                                                   |
| Site file that isn't valid XML                           | Error names the file rather than surfacing a parser stack trace.                                                                                |

Preflight cases, with the query stubbed:

| Case                                             | What it pins down                                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Domain missing, no `--ignore-missing-domain`     | Error, **and the site file on disk is unchanged** — the ordering guarantee, which is the whole point of running the check first. |
| Domain missing, with `--ignore-missing-domain`   | Warns, proceeds, patches; `domainCheck.ignored` is `true`.                                                                       |
| Domain bound to a different site                 | Warns naming the other site, but still proceeds and exits zero.                                                                  |
| Domain bound to this site                        | No warning — the re-run case must stay quiet or nobody will read the warnings that matter.                                       |
| Query throws                                     | Warns, proceeds, `domainCheck.status` is `unavailable`; `--ignore-missing-domain` not required.                                  |
| No `--target-org` in patch-only mode             | No query attempted, `domainCheck` absent, exit zero.                                                                             |
| `--ignore-missing-domain` with no `--target-org` | Warns that the flag did nothing.                                                                                                 |
| Domain containing a quote                        | SOQL literal escaped via `escapeSoqlLiteral`.                                                                                    |

Deploy-mode cases, with the deploy stubbed:

| Case                                    | What it pins down                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `--deploy` succeeds                     | Files are byte-identical to their pre-run contents afterwards; the component set contained exactly the changed files and nothing else. |
| `--deploy` fails                        | Restore still ran — this is the `finally`, and it's the case most likely to regress in a later refactor.                               |
| Restore throws                          | Non-zero exit, error names the modified files, `deploy.restored` is `false`.                                                           |
| `--deploy` without `--path-prefix`      | Exactly one component deployed, not two.                                                                                               |
| `--publish` without `--deploy`          | Rejected at parse time.                                                                                                                |
| `--publish` with a missing network file | Same error as the `--path-prefix` case, since the Network name can't be resolved.                                                      |
| Publish fails after a successful deploy | Deploy still reported as succeeded; exit is non-zero.                                                                                  |

The NUT must also run the preflight query unstubbed against a real org — that is the only way to
confirm the `Domain`/`DomainSites` field names, which were taken from generated sObject stubs rather
than from documentation, and which every stubbed preflight test above assumes.

One NUT, against a scratch org with a site: run with `--deploy --publish`, then confirm the org's
`customWebAddresses` reflects the new domain and the working tree is clean. This is the only way to
catch the thing unit tests structurally cannot — that Salesforce accepts a one-component CustomSite
deploy that replaces the root custom URL list.

## Open questions

- **Should `--primary false` be rejected when the result is a single entry?** A site whose only root
  custom URL is non-primary is probably invalid. Options: force `true` when there's one entry, warn,
  or pass it through and let the deploy fail. Undecided; leaning toward warn.
- **Multiple domains per site.** The replace-all semantics make a repeatable `--domain` flag the
  natural shape for v2 (e.g. `www.acme.com` primary plus an alias). Out of scope for v1, but the
  result type and the internal API should not assume exactly one.
- ~~**Optional `--target-org` preflight** that verifies the domain is registered.~~ **Resolved and
  adopted** — see "Preflight" above. `Domain` and `DomainSite` are both read-only but SOQL-queryable
  from API 26.0. Field names confirmed from generated sObject stubs rather than the docs (the
  reference pages render client-side and return only navigation): `Domain` has
  `Id, Domain, DomainType, OptionsExternalHttps, CnameTarget` plus a `DomainSites` child
  relationship, and `DomainSite` has `DomainId, SiteId, PathPrefix`. Note the domain string field is
  `Domain`, **not** `DomainName` — one search result claimed otherwise and was wrong. Worth
  re-confirming against a real org during implementation, since that's the one thing a stubbed unit
  test cannot catch.
- **`<certificate>`** on `SiteWebAddress`, for orgs terminating HTTPS with a named cert, is
  deliberately out of scope per the agreed decision. Revisit if anyone needs it.
- **Does the network file's basename actually equal the queryable `Network.Name`?** `--publish`
  depends on it: the file is `networks/<Name>.network-meta.xml` and `simply community publish` looks
  the site up with `WHERE Name = '<Name>'`. It holds for the samples I checked, but names containing
  characters that get escaped in filenames are the obvious risk. Verify against an org before
  building `--publish`; the fallback is to query `Network` by its `CustomSite` relationship instead
  of by name.
- **Should `--deploy` verify the domain is registered before deploying?** This is the same preflight
  as the `--target-org` question above, but `--deploy` makes it cheap — the connection is already
  open. Still blocked on confirming the `Domain` object is queryable.
- **Does a URL change actually require a publish?** Salesforce's guidance to publish after deploying
  site metadata is general; I did not find anything stating whether a `customWebAddresses` change
  specifically takes effect without one. If it doesn't need a publish, `--publish` is still useful
  for callers who changed the prefix too, but the footgun framing above is overstated and the flag's
  help text should be toned down accordingly.
