# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
