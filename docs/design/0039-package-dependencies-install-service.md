# 0039 — `simply-package-core`: `installPackageDependencies` service

**Status:** Draft
**Package:** `packages/simply-package-core` (in `simply-node`); `packages/simply-package` and
`packages/simply-cicd` (consumers, in `simply-plugins`)
**Date:** 2026-09-09

## Problem

`simply-cicd` installs a project's packaged dependencies in three places — `build install-dependencies`,
`deploy project`'s `install-packaged` stage, and `deploy happy-soup`'s `install-packaged` stage — and
all three go through `common/sfPackages.ts`'s `installPackageDependencies()`, which shells out:

```
sf simply package dependencies install --apex-compile package --wait 120 --install-type Upgrade --no-prompt [--target-org …] [--output-file …]
```

That costs the pipeline three things:

- **An extra install step.** The `@simplysf/simply` plugin has to be present on the runner for the
  command to exist (`DEFAULT_DEPLOYMENT_PLUGINS` installs it), and every `sf` invocation pays oclif's
  start-up and plugin-discovery cost.
- **A file as the return channel.** `deploy happy-soup` needs to know which installs were upgrades of
  an already-installed package (to notify about them later). Today it passes a temp path as
  `--output-file`, then reads the JSON report back off disk — an indirection that only exists
  because the process boundary is there.
- **No type-checking across the boundary.** `sfPackages.ts` re-declares the report entry's shape as
  a local `InstallReportEntry` type that has to be kept in sync with the command's `PackageToInstall`
  by hand.

The engine itself — resolving dependencies from `sfdx-project.json`, comparing against the org's
installed packages, installing one at a time with retries — lives entirely inside
`simply-package`'s `dependencies/install.ts` command class (~450 lines), interleaved with flag
parsing, spinner control, prompts, and message lookups. [0032](0032-simply-package-core.md) moved
the pure helpers that command uses into `simply-package-core`, but not the install loop, because at
the time nothing else needed it. `simply-cicd` does.

## Decision

Extract the install engine from `simply-package`'s command into a new
`installPackageDependencies(options)` function in `@simplysf/simply-package-core`, with the
CLI-specific concerns (flags, spinner, prompts, `--output-file`, `messages/`) staying behind in the
command as thin adapters. Then:

1. **`simply-package`'s `dependencies install` command** becomes a wrapper: parse flags, build a
   `Connection` (and a lazy Dev Hub connection factory), map the flags onto options, map the spinner
   and `this.info`/`this.warn`/`this.confirm` onto the `progress`/`prompts` callbacks, write
   `--output-file` from the returned array. Command behavior, flags, and `--json` output shape are
   unchanged.
2. **`simply-cicd`'s `common/sfPackages.ts`** calls the library directly with `Org.create()` /
   `SfProject.resolve()` instead of `runSf([...])`, maps `progress` onto its `logger`, and returns
   the `PackageToInstall[]` result. `resolveUpgradedPackages()` takes that array instead of a report
   file path, and `deploy happy-soup` drops its temp-file plumbing.

Why `simply-package-core` and not `simply-cicd-core`: the engine is package logic — it already
depends on `simply-package-core`'s `isDependenciesPackagingDirectory`/`reducePackageInstallRequestErrors`
and the `PackageDirDependency` schema, and on `@salesforce/packaging`, which `simply-cicd-core`
(currently dependency-free — it's ALM/VCS HTTP clients) has no reason to take on.
[0037](0037-simply-cicd-core.md) deliberately left `sfPackages.ts` behind in `simply-cicd` as
"shells out to `sf`"; this doc is what replaces that shell-out.

## Behavior

### `@simplysf/simply-package-core` — new export

```ts
export async function installPackageDependencies(
  options: InstallPackageDependenciesOptions,
): Promise<PackageToInstall[]>;
```

| Option                   | Type                                                   | Default      | Replaces (CLI flag)                        |
| ------------------------ | ------------------------------------------------------ | ------------ | ------------------------------------------ |
| `project`                | `SfProject`                                            | required     | `this.project` (`requiresProject`)         |
| `targetOrgConnection`    | `Connection`                                           | required     | `--target-org`                             |
| `targetDevHubConnection` | `Connection \| (() => Promise<Connection>)`            | none         | `--target-dev-hub`                         |
| `branch`                 | `string`                                               | `''`         | `--branch`                                 |
| `installType`            | `'All' \| 'Delta' \| 'Upgrade'`                        | `'Upgrade'`  | `--install-type`                           |
| `installationKeys`       | `Record<aliasOrId, key>`                               | `{}`         | `--installation-key` (after parsing)       |
| `apexCompile`            | `'all' \| 'package'`                                   | none         | `--apex-compile`                           |
| `securityType`           | `'AllUsers' \| 'AdminsOnly'`                           | `AdminsOnly` | `--security-type`                          |
| `upgradeType`            | `'DeprecateOnly' \| 'Mixed' \| 'Delete'`               | `Mixed`      | `--upgrade-type`                           |
| `skipHandlers`           | `string[]`                                             | none         | `--skip-handlers`                          |
| `publishWait`            | `Duration`                                             | 0            | `--publish-wait`                           |
| `wait`                   | `Duration`                                             | 30 min       | `--wait`                                   |
| `retryAttempts`          | `number`                                               | `0`          | `--retry-attempts`                         |
| `retryBackoff`           | `number`                                               | `2`          | `--retry-backoff`                          |
| `packageRetryAttempts`   | `Record<aliasOrId, number>`                            | `{}`         | `--package-retry-attempts` (after parsing) |
| `progress`               | `{ info?, warn?, stepStart?, stepStatus?, stepStop? }` | no-ops       | `this.info`/`this.warn`/`this.spinner`     |
| `prompts`                | `{ confirmUpgradeTypeDelete, confirmEnableRss }`       | auto-approve | `this.confirm` (omitted = `--no-prompt`)   |

Lookup rules that moved with the engine, unchanged:

| Situation                                             | Result                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| Dependency has `package` + `versionNumber`            | Resolved via the Dev Hub (`SubscriberPackageVersion.resolveId`) |
| Dependency has only `package`                         | Resolved via `project.getPackageIdFromAlias`, must be a `04t`   |
| Same `04t` declared twice                             | First occurrence kept                                           |
| `installType: 'All'`                                  | Everything installed; existing version still reported           |
| `installType: 'Delta'`, same `04t` already installed  | `Skipped`                                                       |
| `installType: 'Upgrade'`, installed version ≥ target  | `Skipped`                                                       |
| Install request `SUCCESS`                             | `Installed`                                                     |
| Install request `IN_PROGRESS`/`UNKNOWN` after polling | `Installing`, throws, **never retried**                         |
| Install request any other status                      | `Failed`, throws, retried per `retryAttempts`/override          |

Errors are `SfError`s with stable names instead of `messages.createError(...)` keys:
`ApiVersionTooLowError`, `InvalidSubscriberPackageVersionIdError`, `InvalidPackage2IdError`,
`TargetDevHubMissingError`, `PackageInstallCanceledError`, `PackageInstallInProgressError`,
`PackageInstallError`. Message text is carried over from `simply-package`'s
`messages/simply.package.dependencies.install.md` verbatim except for two that referred to "this
command"/"a DevHub to be specified" and now describe the library's contract instead
(`ApiVersionTooLowError`, `TargetDevHubMissingError`).

Two latent issues fixed in the port, both invisible unless you were looking:

- **Lifecycle listeners piled up.** The command registered `PackageEvents.install.*` listeners inside
  the per-package loop, so package _n_ had _n_ warning listeners and _n_ status listeners firing.
  The service registers each once per run, and removes them (`removeAllListeners`) in a `finally`
  so a second run in the same process — which a library consumer can plausibly do — gets fresh
  closures rather than the first run's `progress` callbacks.
- **Stale request across retries.** `pkgInstallRequest` was declared outside the retry callback, so
  a non-`SfError` failure on attempt _n+1_ (e.g. a network error) was reported as attempt _n_'s
  `Failed` request. It's now local to each attempt.

### `@simplysf/simply-package` — CLI, thinned (in `simply-plugins`)

- `dependencies/install.ts` keeps: flag definitions, `--installation-key`/`--package-retry-attempts`
  format validation (regexes and their `error.*Format` messages), `--target-dev-hub` →
  `AuthInfo`/`Connection` (as a factory, so an absent flag only errors if a dependency needs it),
  `--output-file` writing and its `info.reportWritten` message, and the two prompt texts. It maps
  `progress` onto `this.spinner.start/status/stop`, `this.info`, `this.warn`.
- `messages/simply.package.dependencies.install.md` drops the keys the command no longer loads
  (`error.apiVersionTooLow`, `error.invalidPackage2Id`, `error.invalidSubscriberPackageVersionId`,
  `error.packageInstall`, `error.packageInstallInProgress`, `error.packageInstallPollingTimeout`,
  `error.targetDevHubMissing`, `info.canceledPackageInstall`, `warning.packageInstallRetrying`).
  That text now lives in the library.
- `PackageToInstall` is re-exported from the library rather than declared locally (same shape;
  `Status` narrows from `string` to a union — non-breaking for readers).
- `--json` output, flags, `command-snapshot.json`: unchanged.

### `@simplysf/simply-cicd` — no more `sf simply` shell-out (in `simply-plugins`)

- `common/sfPackages.ts`: `installPackageDependencies({ alias?, wait?, installType? })` resolves the
  org with `Org.create({ aliasOrUsername: alias })` (an absent alias means the default target org,
  exactly as the absent `--target-org` did) and the project with `SfProject.resolve()`, calls the
  library with `apexCompile: 'package'` and the same `wait`/`installType`, and returns
  `PackageToInstall[]`. The `noPrompt` (always `true`), `debug` (unused), and `outputFile` config
  fields go away. `progress` → `logger.info`/`logger.warn`; `stepStatus` is logged only when the
  text changes (it fires every 2-second poll).
- `resolveUpgradedPackages(installResults, config)` filters the array directly instead of reading
  a report file. `deploy happy-soup`'s `installPackagedAndDetectUpgrades` drops the `mkdtemp` +
  `--output-file` round trip.
- `package.json` gains `@simplysf/simply-package-core` and `@salesforce/kit` (for `Duration`).
- `sf package version report` (also in `sfPackages.ts`) keeps shelling out — out of scope here.
- `DEFAULT_DEPLOYMENT_PLUGINS` still lists `@simplysf/simply`: nothing else in `simply-cicd` runs an
  `sf simply …` command any more, but project-supplied `bin/*.sh` deploy scripts may, so removing
  it is a separate decision (see Open questions).

### Public-API test

`test/index.test.ts`'s pinned key list gains `'installPackageDependencies'` (between
`'findPackageVersions'` and `'isDependenciesPackagingDirectory'` in code-unit order).

## Alternatives considered

**Import the oclif command class and call `PackageDependenciesInstall.run([...args])` in-process.**
This is the literal reading of "import the command". Rejected: it would make `simply-cicd` depend on
`@simplysf/simply-package` (a CLI plugin) and on oclif's `Config.load()` happening inside the
consumer's process — the exact coupling every `-core` package exists to avoid — and the return
channel would still be a string-flag interface. It also wouldn't be usable from anything that isn't
already an `sf` plugin.

**Put the engine in `simply-cicd-core`.** Rejected: see Decision — it's packaging logic with
packaging dependencies, and `simply-package`'s command needs it too. Two consumers in different
plugins is the definition of a `-core` export.

**Keep the engine in the command and only move the "was this an upgrade" post-processing.** Would
leave the shell-out and the plugin-install prerequisite in place, which is the problem statement.

**Have the library write `outputFile` itself.** Simpler for the CLI, but it's file I/O that only
one consumer wants, and a library returning the array is the more general contract. The CLI writes
the file from the array — ~5 lines.

**Pass `installationKeys` as the raw `alias:key` strings.** The `^(\w+:\w+)(,\s*\w+:\w+)*` format is a
CLI-flag concern (and its error text is a `messages/` key); the library takes an already-parsed
record keyed by alias-or-id and does only the alias→`04t` resolution both consumers need.

**Register Lifecycle listeners with a `uniqueListenerIdentifier` instead of removing them.**
`Lifecycle.on(..., id)` _keeps the first_ listener registered under an id and drops later ones, so
a second run in the same process would report progress to the first run's callbacks. Removal in
`finally` is the only option that gives each run its own.

## Implementation plan

`simply-node` (this PR):

1. `packages/simply-package-core/src/packageDependenciesInstall.ts` — the service, ported from
   `simply-plugins`' `packages/simply-package/src/commands/simply/package/dependencies/install.ts`
   at `28a6740`.
2. `packages/simply-package-core/src/index.ts` — export the function and its types.
3. `packages/simply-package-core/package.json` — add `@salesforce/kit` (`Duration`).
4. `packages/simply-package-core/test/packageDependenciesInstall.test.ts` — see Testing.
5. `packages/simply-package-core/test/index.test.ts` — pin the new key.
6. `packages/simply-package-core/README.md`, `site/src/content/docs/guides/simply-package-core.md`
   — API row and example.
7. This doc + `docs/design/README.md` row.
8. Merge → Lerna publishes `@simplysf/simply-package-core@0.3.0` (a `feat` commit → minor).

`simply-plugins` (companion PR, after `0.3.0` is on npm):

9. `packages/simply-package`: thin the command; prune `messages/`; bump `simply-package-core` to
   `^0.3.0`; drop `@salesforce/ts-types` if nothing else in the package imports it; `pnpm run readme`
   (expect no diff — flags unchanged); `pnpm run build` for `command-snapshot.json`.
10. `packages/simply-cicd`: rewrite `common/sfPackages.ts`'s install half; update
    `deploy/deployHappySoup.ts`; add `simply-package-core` + `@salesforce/kit` to `package.json`;
    update `test/common/sfPackages.test.ts` (mock the library instead of `execa`),
    `test/common/deploy/deployHappySoup.test.ts` (no `outputFile`; array argument).
11. `pnpm-workspace.yaml` `minimumReleaseAgeExclude` entry for `simply-package-core@0.3.0`, per
    0032's precedent.
12. Duplicate this doc into `simply-plugins`' `docs/design/` (as `0036-…`, its next free number).

## Testing

**Unit (`simply-package-core`)** — `test/packageDependenciesInstall.test.ts`, with a fake `SfProject`
(`getPackageDirectories`/`getPackageIdFromAlias`) and fake `Connection` (`getApiVersion`/
`getUsername`), and sinon stubs on `SubscriberPackageVersion` (`installedList`, and the prototype's
`getSubscriberPackageId`/`getVersionNumber`/`getId`/`install`/`getExternalSites`/`getPackageType`,
plus `resolveId`). `SubscriberPackageVersion`'s constructor only validates the `04t` and tolerates
no `SfProject` instance, so no `TestContext`/`MockTestOrgData` is needed. Cases, each pinning one
rule from the Behavior table:

- `Upgrade` skips same/older and installs newer/not-installed; `Delta` installs a same-version-number
  different-`04t`; `All` installs everything but still reports the existing version; `Upgrade` is
  the default. (Ported 1:1 from the command's tests.)
- Alias resolution + de-duplication; empty project → `[]` with the "No packages" info line and no
  org calls; non-resolving dependency → `InvalidSubscriberPackageVersionIdError`; API < 36 →
  `ApiVersionTooLowError`.
- Dev Hub: missing connection → `TargetDevHubMissingError`; non-`0Ho` → `InvalidPackage2IdError`;
  factory invoked exactly once and `resolveId` called with the connection/branch/packageId; factory
  _not_ invoked when no dependency needs it.
- Request mapping: security/upgrade/apex-compile/skip-handlers/installation-key/`wait` land on the
  `install()` call; defaults `none`/`mixed-mode`; unresolvable key → error.
- Prompts: omitted → neither `getExternalSites` nor `getPackageType` is called; `confirmEnableRss`
  result becomes `EnableRss`; declined `confirmUpgradeTypeDelete` → `PackageInstallCanceledError`
  before `install()`.
- Retries: succeeds on the third attempt with two `warn` lines; exhausts and rethrows the original
  error; per-package override; `IN_PROGRESS` → `PackageInstallInProgressError` with the
  `sf package install report` hint and exactly one attempt; a request attached to an `SfError`'s
  `data` → `Failed` + `PackageInstallError` + the "Polling timeout exceeded" `stepStop`.
- Lifecycle: warnings/status emitted during `install()` reach `progress`, and no listeners remain
  after the run.

**`simply-package` command tests** (in `simply-plugins`) — the existing `install.test.ts` cases
(same stubs, run through `PackageDependenciesInstall.run`) keep passing unchanged: they stub
`SubscriberPackageVersion.prototype` and `SfProject.prototype`, which the library uses via the same
module instance. This is the regression check that the wrapper maps flags correctly.

**`simply-cicd` unit tests** — `sfPackages.test.ts` asserts the library is called with
`Org.create`'s connection, `apexCompile: 'package'`, the given `installType`, and a `wait` of the
given minutes; and that `resolveUpgradedPackages` filters the array (four existing cases, now fed
an array instead of a stubbed `readFile`). `deployHappySoup.test.ts` asserts the array is passed
through.

**Manual verification**: `sf simply cicd build install-dependencies` against a scratch org with one
declared dependency, confirming the same "Package X … will be skipped" / "Installing package X"
lines appear via `logger` that the spinner used to show.

## Open questions

- **Should `@simplysf/simply` come off `DEFAULT_DEPLOYMENT_PLUGINS`?** After this change
  `simply-cicd` itself never runs an `sf simply …` command, but project-owned deploy scripts
  (`bin/*.sh`) can. Leaving it installed costs a plugin install per job; removing it could break a
  project. Decide in a follow-up with a look at real `bin/` scripts — the maintainer's call.
- **`sf package version report` shell-out** in `resolveUpgradedPackages` could move to
  `@salesforce/packaging`'s `Package.getVersion…` in the same style. Deferred: different command,
  different data shape, and not part of the install path.
