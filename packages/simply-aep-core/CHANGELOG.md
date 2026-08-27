# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.5.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep-core%400.4.0...%40simplysf%2Fsimply-aep-core%400.5.0) (2026-08-27)

### Features

- **simply-aep-core:** add DomainProcessBinding__mdt create/set write functions ([8787ac6](https://github.com/SimplySF/simply-node/commit/8787ac68e12c7f38743b0004170b1b08b9440145))

# [0.4.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep-core%400.3.0...%40simplysf%2Fsimply-aep-core%400.4.0) (2026-08-26)

### Features

- **simply-aep-core:** add scope/filePath metadata and filterDomainProcessBindingIssues ([2b70c3e](https://github.com/SimplySF/simply-node/commit/2b70c3e81ff4f6ad620aa49b1befd37d5ff19ec0))

# [0.3.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep-core%400.2.1...%40simplysf%2Fsimply-aep-core%400.3.0) (2026-08-26)

- feat(simply-aep)!: add domain-process-binding validate command ([a50e066](https://github.com/SimplySF/simply-node/commit/a50e066b1ff3c564e9afb8ba9a355addc7d1758b)), closes [#127](https://github.com/SimplySF/simply-node/issues/127)

### BREAKING CHANGES

- `scanLocalDomainProcessBindings` (@simplysf/simply-aep-core)
  now returns `{ records, malformed, ambiguous }` instead of
  `RawDomainProcessBindingRecord[]`. Update any direct consumer to destructure
  `{ records }` from the result.

## [0.2.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep-core%400.2.0...%40simplysf%2Fsimply-aep-core%400.2.1) (2026-08-26)

### Bug Fixes

- **simply-aep-core:** order Criteria before Action for a shared sequence ([d47d5de](https://github.com/SimplySF/simply-node/commit/d47d5de8020544f7d4e5ee691ee27699092f11ce))

# 0.2.0 (2026-08-25)

- refactor(simply-aep)!: extract simply-aep-core library package ([a2721d8](https://github.com/SimplySF/simply-node/commit/a2721d8d332ede1a76f595650ed9895df85c01af))

### BREAKING CHANGES

- @simplysf/simply-aep's src/index.ts no longer re-exports the
  AT4DX scan/resolve functions and types added in 0.2.0/0.3.0 (0007, 0008).
  Import them from @simplysf/simply-aep-core instead. @simplysf/simply-aep's
  own command behavior (flags, output, errors) is unchanged.
