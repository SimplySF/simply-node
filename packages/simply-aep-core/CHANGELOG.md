# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.10.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep-core%400.10.0...%40simplysf%2Fsimply-aep-core%400.10.1) (2026-09-01)

### Bug Fixes

- **simply-aep-core:** preserve existing .md-meta.xml shape on AT4DX update ([123341b](https://github.com/SimplySF/simply-node/commit/123341b13707b0a4d98b1c13fd400d21b9e7e86d))

# [0.10.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep-core%400.9.0...%40simplysf%2Fsimply-aep-core%400.10.0) (2026-08-31)

- feat(simply-aep)!: rename domain-process-binding set to update ([f6be0a9](https://github.com/SimplySF/simply-node/commit/f6be0a922cac82192a1b452773558fee4bacea64)), closes [#148](https://github.com/SimplySF/simply-node/issues/148) [#149](https://github.com/SimplySF/simply-node/issues/149)

### BREAKING CHANGES

- `sf simply aep at4dx domain-process-binding set` is now
  `update`, and simply-aep-core's `setDomainProcessBinding`/
  `SetDomainProcessBindingInput`/`Target`/`At4dxDomainProcessBindingSetResult`
  are renamed to their `update*` equivalents. This is the last AT4DX write
  command still using `set` after `binding` (#148) and `field-set-inclusion`
  (#149) already standardized on `update` — see design doc 0018.

# [0.9.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep-core%400.8.0...%40simplysf%2Fsimply-aep-core%400.9.0) (2026-08-30)

### Features

- **simply-aep:** extend at4dx binding create/update/validate to UnitOfWork ([78d9f87](https://github.com/SimplySF/simply-node/commit/78d9f87c149b4a22d3f63ac69bccc1cad1f8b8a5))

# [0.8.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep-core%400.7.0...%40simplysf%2Fsimply-aep-core%400.8.0) (2026-08-30)

### Features

- **simply-aep:** add at4dx field-set-inclusion list/validate/create/update ([35848f0](https://github.com/SimplySF/simply-node/commit/35848f031d33739c121ec9b7961f51b4e66e0467)), closes [#148](https://github.com/SimplySF/simply-node/issues/148)

# [0.7.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep-core%400.6.0...%40simplysf%2Fsimply-aep-core%400.7.0) (2026-08-30)

### Bug Fixes

- **simply-aep-core:** supply required label field in at4dxResolve test factory ([d41deb2](https://github.com/SimplySF/simply-node/commit/d41deb2aed9fec1b29b3f9ee0b57847f9ab5cfbb))

### Features

- **simply-aep:** add binding validate/create/update for AT4DX Application Factory bindings ([5f1202e](https://github.com/SimplySF/simply-node/commit/5f1202e7e941555f28cb8f4e81508eaf66f873fd))

### BREAKING CHANGES

- **simply-aep:** scanLocalBindings now returns
  { records, malformed, ambiguous } instead of a bare RawBindingRecord[].

  See docs/design/0015-at4dx-binding-validate-create-set.md.

# [0.6.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep-core%400.5.0...%40simplysf%2Fsimply-aep-core%400.6.0) (2026-08-29)

### Features

- **simply-aep:** validate EntityDefinition eligibility for domain-process-binding SObject fields ([372dec1](https://github.com/SimplySF/simply-node/commit/372dec164464e5c76cff8a1df75c250e2a96362f))

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
