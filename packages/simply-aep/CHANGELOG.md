# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
