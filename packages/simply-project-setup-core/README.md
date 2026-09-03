# @simplysf/simply-project-setup-core

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-project-setup-core?label=@simplysf/simply-project-setup-core)](https://npmjs.com/@simplysf/simply-project-setup-core) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-project-setup-core.svg)](https://npmjs.com/@simplysf/simply-project-setup-core) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

The engine behind a "standardize this Salesforce DX project" command: resolve which features are
enabled from CLI flags, a preset, and a project-local config file; copy each enabled feature's
template pack into the project (preserving any customization-marked region on a file that already
exists); compose `.gitignore`; and merge each feature's dependencies into `package.json`.

This package ships **no templates, no presets, and no package.json defaults** — every one of those
is a specific project's own opinion, not this engine's. A consumer plugin supplies them and gets the
file-copy/merge/customization mechanics for free. The one deliberate exception is `.sfdevrc.json`:
its schema, validation, and the branch-naming-regex convention it drives are this package's own
opinion, not a consumer's — see [`sfdevrcSchema`](#api) below. See
[docs/design/0035-simply-project-setup-core.md](https://github.com/SimplySF/simply-node/blob/main/docs/design/0035-simply-project-setup-core.md)
for the reasoning.

## Install

```bash
npm install @simplysf/simply-project-setup-core
```

Requires Node.js `>=22` and either `"type": "module"` or a dynamic `import()` — this package ships ESM only.

## Templates-directory contract

`standardizeFiles` and `writeDependencies` both take a `templatesPath` pointing at a directory of
feature packs — one subdirectory per feature id, named however your command names its features:

```
templates/
  core/
    .editorconfig
    bin/deploy.sh
    dependencies.json       # optional; merged into package.json when "core" is included
  eslint/
    eslint.config.mjs
    dependencies.json
  gitignore/
    base.gitignore          # always composed into .gitignore, regardless of `include`
    eslint.gitignore         # appended when "eslint" is included
```

A file that should preserve a project-local edit across re-runs contains a
`# -- START CUSTOMIZATION` / `# -- END CUSTOMIZATION` block; `standardizeFiles` re-copies everything
outside that block from the template and keeps whatever's inside it from the existing file.

## `.sfdevrc.json`

Unlike templates and presets, `.sfdevrc.json` is this package's own opinion — every consumer that
uses `resolveSetupConfig` shares the same config-file format, validated the same way:

```json
{
  "gitlabProjectId": "42",
  "jiraProjectKeys": ["ABC", "XYZ"],
  "deploymentPlugins": ["sfdmu"],
  "setup": { "exclude": ["utam"] }
}
```

`resolveSetupConfig` reads `setup.include`/`setup.exclude`. `buildBranchRegex` reads `branchRegex`
(if set, used verbatim) or `jiraProjectKey`/`jiraProjectKeys` (folded into a JIRA-keyed branch-name
regex, each key in both cases), falling back to a default `feature|bugfix|devops|release` pattern
when neither is set. `gitlabProjectId` and `deploymentPlugins` aren't read by anything in this
package — they're validated here anyway so a project has exactly one schema to satisfy, whether a
field is read by this package, by a consumer's own commands, or both.

## API

Everything below is exported from the package root. Removing or renaming an export is a breaking
change; see [`src/index.ts`](src/index.ts).

| Export                              | Description                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `resolveSetupConfig(options)`       | Resolves the feature list to apply from a base config, local overrides, a preset, and flags. |
| `standardizeFiles(options)`         | Copies template packs into the project, composes `.gitignore`, deletes banned files.         |
| `standardizePackageJson(options)`   | Writes `private`/`type`/`workspaces` and feature-gated `scripts`/`wireit` entries.           |
| `writeDependencies(options)`        | Merges each included feature's `dependencies.json` into `package.json`.                      |
| `PackageJson`                       | Reads/mutates/writes a project's `package.json`, ordering keys on write.                     |
| `sfdevrcSchema`                     | The `zod` schema for `.sfdevrc.json`; `Sfdevrc` is its inferred type.                        |
| `loadSfdevrc(cwd?)`                 | Finds, reads, and validates the nearest `.sfdevrc.json`; `undefined` if none exists.         |
| `findSfdevrcPath(cwd?)`             | Just the path-finding half of `loadSfdevrc`, without reading or validating.                  |
| `buildBranchRegex(sfdevrc)`         | Derives a branch-naming regex from `branchRegex`/`jiraProjectKey(s)`.                        |
| `exists(path)`                      | `true` if a path exists and is accessible.                                                   |
| `loadRootPath(fileName, cwd?)`      | Walks up from `cwd` for the nearest ancestor directory containing `fileName`.                |
| `log(message, indent?)`             | A small indent-aware `console.warn` wrapper used by `PackageJson.write()`.                   |
| `orderMap(map)`                     | Returns a copy of `map` with keys sorted alphabetically.                                     |
| `semverIsLessThan(version, target)` | Compares two plain `major.minor.patch` strings.                                              |

### End-to-end example

```ts
import {
  resolveSetupConfig,
  standardizeFiles,
  standardizePackageJson,
  writeDependencies,
  loadSfdevrc,
  buildBranchRegex,
  type SetupConfig,
} from '@simplysf/simply-project-setup-core';
import path from 'node:path';

const templatesPath = path.join(import.meta.dirname, 'templates');
const sfdevrc = loadSfdevrc(); // finds/reads/validates the nearest .sfdevrc.json, or undefined

const baseConfig: SetupConfig = {
  include: ['core'],
  exclude: [],
  add: [],
  banned: ['.prettierrc.mjs'],
};

const config = resolveSetupConfig({
  flags, // this command's own parsed flags
  sfdevrc,
  baseConfig,
  presets: { hrm: ['core', 'eslint', 'prettier', 'jest'] },
  booleanFeatures: ['eslint', 'prettier', 'jest'],
  dependentFeatures: ['eslint', 'prettier', 'jest'],
});

const fileActions = standardizeFiles({
  config,
  templatesPath,
  gitignoreHeader: "# Generated by 'myapp project setup'. Do not edit manually.\n\n",
  renameFile: (dest) => (dest === '.prettier.config.mjs' ? 'prettier.config.mjs' : dest),
  protectedFiles: ['.myapprc.json'],
  transformFile: ({ destRelativePath, content }) =>
    destRelativePath === '.husky/pre-commit'
      ? content.replace('REPLACE_WITH_BRANCH_REGEX', `"${buildBranchRegex(sfdevrc)}"`)
      : content,
});

const pjsonChanged =
  config.include.includes('package-json') &&
  [
    await writeDependencies({ config, templatesPath }),
    standardizePackageJson({
      config,
      defaults: {
        private: true,
        type: 'module',
        scripts: { format: 'prettier --write .', 'test:unit': 'vitest' },
        featureScripts: { prettier: ['format'], jest: ['test:unit'] },
      },
    }),
  ].some(Boolean);
```

### Composing a feature-specific step on top

This package deliberately doesn't special-case any feature by name — including patterns the source
tool this engine was extracted from did special-case, like adding a package's own name as a
`"file:"` dependency when a UI-testing feature is enabled. A consumer needing that kind of step has
the same `PackageJson` class the engine itself uses:

```ts
import { PackageJson } from '@simplysf/simply-project-setup-core';

if (config.include.includes('utam')) {
  const pjson = new PackageJson(projectPath);
  const dependencies = pjson.get<Record<string, string>>('dependencies', {});
  dependencies[pjson.contents.name] = 'file:';
  pjson.write();
}
```

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See [CONTRIBUTING.md](CONTRIBUTING.md) for what's specific to this package, and the repo's [root CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for repo structure, setup, commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt) license.
