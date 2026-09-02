# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.14.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.14.0...%40simplysf%2Fsimply-aep%400.14.1) (2026-09-02)

### Bug Fixes

- **simply-aep-core:** correct AT4DX MatcherRule__c enum values ([28589e7](https://github.com/SimplySF/simply-node/commit/28589e79e8923182fdd2c6fc3076609caac0d1f4))

# [0.14.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.13.0...%40simplysf%2Fsimply-aep%400.14.0) (2026-09-01)

### Features

- **simply-aep:** add AT4DX platform-event-subscription create/update (Stage 3) ([19e3c39](https://github.com/SimplySF/simply-node/commit/19e3c39b93bf1676dfc6f1631cfcf3e8d2035472))

# [0.13.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.12.0...%40simplysf%2Fsimply-aep%400.13.0) (2026-09-01)

### Features

- **simply-aep:** add AT4DX platform-event-subscription simulate (Stage 2) ([b734d6c](https://github.com/SimplySF/simply-node/commit/b734d6cd2f9bf7025b9789f27f44e1761ff0f4d7))

# [0.12.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.11.3...%40simplysf%2Fsimply-aep%400.12.0) (2026-09-01)

### Features

- **simply-aep:** add AT4DX platform-event-subscription list/validate (Stage 1) ([1803b6c](https://github.com/SimplySF/simply-node/commit/1803b6c71166162f3824d985acbb4480fd28a5ef))

## [0.11.3](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.11.2...%40simplysf%2Fsimply-aep%400.11.3) (2026-09-01)

**Note:** Version bump only for package @simplysf/simply-aep

## [0.11.2](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.11.1...%40simplysf%2Fsimply-aep%400.11.2) (2026-09-01)

**Note:** Version bump only for package @simplysf/simply-aep

## [0.11.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.11.0...%40simplysf%2Fsimply-aep%400.11.1) (2026-08-31)

**Note:** Version bump only for package @simplysf/simply-aep

# [0.11.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.10.0...%40simplysf%2Fsimply-aep%400.11.0) (2026-08-31)

- feat(simply-aep)!: rename domain-process-binding set to update ([f6be0a9](https://github.com/SimplySF/simply-node/commit/f6be0a922cac82192a1b452773558fee4bacea64)), closes [#148](https://github.com/SimplySF/simply-node/issues/148) [#149](https://github.com/SimplySF/simply-node/issues/149)

### BREAKING CHANGES

- `sf simply aep at4dx domain-process-binding set` is now
  `update`, and simply-aep-core's `setDomainProcessBinding`/
  `SetDomainProcessBindingInput`/`Target`/`At4dxDomainProcessBindingSetResult`
  are renamed to their `update*` equivalents. This is the last AT4DX write
  command still using `set` after `binding` (#148) and `field-set-inclusion`
  (#149) already standardized on `update` — see design doc 0018.

# [0.10.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.9.1...%40simplysf%2Fsimply-aep%400.10.0) (2026-08-30)

### Features

- **simply-aep:** extend at4dx binding create/update/validate to UnitOfWork ([78d9f87](https://github.com/SimplySF/simply-node/commit/78d9f87c149b4a22d3f63ac69bccc1cad1f8b8a5))

## [0.9.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.9.0...%40simplysf%2Fsimply-aep%400.9.1) (2026-08-30)

**Note:** Version bump only for package @simplysf/simply-aep

# [0.9.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.8.0...%40simplysf%2Fsimply-aep%400.9.0) (2026-08-30)

### Features

- **simply-aep:** add at4dx field-set-inclusion list/validate/create/update ([35848f0](https://github.com/SimplySF/simply-node/commit/35848f031d33739c121ec9b7961f51b4e66e0467)), closes [#148](https://github.com/SimplySF/simply-node/issues/148)

# [0.8.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.7.0...%40simplysf%2Fsimply-aep%400.8.0) (2026-08-30)

### Features

- **simply-aep:** add binding validate/create/update for AT4DX Application Factory bindings ([5f1202e](https://github.com/SimplySF/simply-node/commit/5f1202e7e941555f28cb8f4e81508eaf66f873fd))

### BREAKING CHANGES

- **simply-aep:** scanLocalBindings now returns
  { records, malformed, ambiguous } instead of a bare RawBindingRecord[].

  See docs/design/0015-at4dx-binding-validate-create-set.md.

# [0.7.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.6.1...%40simplysf%2Fsimply-aep%400.7.0) (2026-08-29)

### Features

- **simply-aep:** validate EntityDefinition eligibility for domain-process-binding SObject fields ([372dec1](https://github.com/SimplySF/simply-node/commit/372dec164464e5c76cff8a1df75c250e2a96362f))

## [0.6.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.6.0...%40simplysf%2Fsimply-aep%400.6.1) (2026-08-27)

**Note:** Version bump only for package @simplysf/simply-aep

# [0.6.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.5.1...%40simplysf%2Fsimply-aep%400.6.0) (2026-08-27)

### Features

- **simply-aep:** add domain-process-binding create/set commands ([b3ea68d](https://github.com/SimplySF/simply-node/commit/b3ea68d06bae9f4c6e2a687704aefa34818d2abd))

## [0.5.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.5.0...%40simplysf%2Fsimply-aep%400.5.1) (2026-08-26)

### Bug Fixes

- **simply-aep:** validate-then-filter --sobject so scan-wide issues aren't dropped ([a1ba32a](https://github.com/SimplySF/simply-node/commit/a1ba32a601f23972b7bcaeea7e97e5139df5cade))

# [0.5.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.4.1...%40simplysf%2Fsimply-aep%400.5.0) (2026-08-26)

- feat(simply-aep)!: add domain-process-binding validate command ([a50e066](https://github.com/SimplySF/simply-node/commit/a50e066b1ff3c564e9afb8ba9a355addc7d1758b)), closes [#127](https://github.com/SimplySF/simply-node/issues/127)

### BREAKING CHANGES

- `scanLocalDomainProcessBindings` (@simplysf/simply-aep-core)
  now returns `{ records, malformed, ambiguous }` instead of
  `RawDomainProcessBindingRecord[]`. Update any direct consumer to destructure
  `{ records }` from the result.

## [0.4.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.4.0...%40simplysf%2Fsimply-aep%400.4.1) (2026-08-26)

**Note:** Version bump only for package @simplysf/simply-aep

# [0.4.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.3.1...%40simplysf%2Fsimply-aep%400.4.0) (2026-08-25)

- refactor(simply-aep)!: extract simply-aep-core library package ([a2721d8](https://github.com/SimplySF/simply-node/commit/a2721d8d332ede1a76f595650ed9895df85c01af))

### BREAKING CHANGES

- @simplysf/simply-aep's src/index.ts no longer re-exports the
  AT4DX scan/resolve functions and types added in 0.2.0/0.3.0 (0007, 0008).
  Import them from @simplysf/simply-aep-core instead. @simplysf/simply-aep's
  own command behavior (flags, output, errors) is unchanged.

## [0.3.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.3.0...%40simplysf%2Fsimply-aep%400.3.1) (2026-08-24)

**Note:** Version bump only for package @simplysf/simply-aep

# [0.3.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-aep%400.2.0...%40simplysf%2Fsimply-aep%400.3.0) (2026-08-24)

### Features

- **simply-aep:** add simply aep at4dx domain-process-binding list ([aff62cb](https://github.com/SimplySF/simply-node/commit/aff62cb7b0384e9f781f3166a8c9110b76257e7b))

# 0.2.0 (2026-08-24)

### Features

- **simply-aep:** add simply aep at4dx binding list ([a41e65f](https://github.com/SimplySF/simply-node/commit/a41e65f6b2e98a6edcd325eed658ef95c29f9a30))
