# @simplysf/simply-project-setup-core

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-project-setup-core?label=@simplysf/simply-project-setup-core)](https://npmjs.com/@simplysf/simply-project-setup-core) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-project-setup-core.svg)](https://npmjs.com/@simplysf/simply-project-setup-core) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

The engine behind a "standardize this Salesforce DX project" command: resolve which features are
enabled from CLI flags, a preset, and a project-local config file; copy each enabled feature's
template pack into the project (preserving any customization-marked region on a file that already
exists); compose `.gitignore`; and merge each feature's dependencies into `package.json`.

This package ships **no templates, no presets, no package.json defaults, and no project-local
config-file format** — every one of those is a specific project's own opinion, not this engine's. A
consumer plugin supplies them and gets the file-copy/merge/customization mechanics for free. See
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

That block-marker convention isn't the only way to reconcile a template with a target that already
exists. `standardizeFiles` checks these, in order, for each file it's about to write:

| Order | Option/behavior       | Trigger                                       | Once the target exists                                             |
| ----- | --------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| 1     | `protectedFiles`      | destination path matches a configured glob    | skip entirely — never rewritten                                    |
| 2     | `regexCustomizations` | destination path matches a rule's `path` glob | splice the target's matched region(s) into the template output     |
| 3     | `jsonMergeFiles`      | destination path matches a configured glob    | deep-merge target JSON under template JSON — target wins conflicts |
| 4     | customization block   | template content contains the marker pair     | splice the target's block content into the template output         |
| 5     | _(none of the above)_ | —                                             | overwrite if content differs                                       |

A file should match at most one of 1–4 — pick the strategy that fits the file's format, not more
than one.

**`protectedFiles`** ("create this file once, never touch it again") and **`jsonMergeFiles`**
("deep-merge a JSON file, existing target values win on conflict, only new template keys are
added — arrays are replaced outright, never merged element-wise") are both glob lists matched
against the resolved relative destination path.

### Merging a JSON file instead of overwriting it

`jsonMergeFiles` is for a JSON file the template should _seed and extend_ but never reset: editor
settings, a linter or formatter rc file, a tool's project config. List it by destination path (glob
syntax, dotfiles match without a leading-dot escape):

```ts
standardizeFiles({
  config,
  templatesPath,
  jsonMergeFiles: ['.vscode/settings.json', '.myapprc.json', 'config/*.json'],
});
```

Given this template at `templates/vscode/.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "salesforcedx-vscode-core.push-or-deploy-on-save.enabled": false,
  "files.exclude": { "**/.sfdx": true, "**/.sf": true }
}
```

and a project whose `.vscode/settings.json` a developer has already tuned:

```json
{
  "editor.formatOnSave": false,
  "editor.tabSize": 2,
  "files.exclude": { "**/.sfdx": true, "**/node_modules": true }
}
```

the written result is reported as a `"MERGE"` action and reads:

```json
{
  "editor.formatOnSave": false,
  "editor.tabSize": 2,
  "files.exclude": { "**/.sfdx": true, "**/node_modules": true, "**/.sf": true },
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "salesforcedx-vscode-core.push-or-deploy-on-save.enabled": false
}
```

Reading that result against the rules:

| Rule                                                                  | In the example                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Target wins on any key both sides have                                | `editor.formatOnSave` stays `false`                                       |
| Keys only the target has are left alone                               | `editor.tabSize` survives                                                 |
| Keys only the template has are added                                  | `editor.defaultFormatter` and the `push-or-deploy-on-save` setting appear |
| Recurses only when both sides hold a plain object at that key         | `files.exclude` gains `**/.sf` without losing `**/node_modules`           |
| Key order is the target's, then template-only keys in template order  | The two added keys land at the end                                        |
| Output is `JSON.stringify(…, null, 2)` plus a trailing newline        | A target with other indentation is rewritten once, then stable on re-runs |
| A re-run whose merge result equals the file on disk reports no action | Running `standardizeFiles` again produces nothing for this file           |

Two cases where the merge deliberately does _not_ do what a first glance might expect:

- **Arrays are kept or replaced whole, never merged element-wise.** With a template
  `.vscode/extensions.json` of `{ "recommendations": ["salesforce.salesforcedx-vscode", "esbenp.prettier-vscode"] }`
  and a target of `{ "recommendations": ["salesforce.salesforcedx-vscode"] }`, the target is left
  exactly as it is — the new recommendation is **not** appended, because the target already has a
  `recommendations` key and its value wins. A file that is essentially one array isn't a
  `jsonMergeFiles` candidate: let the template own it (no strategy, plain overwrite), let the
  project own it (`protectedFiles`), or pin the one spot that varies with `regexCustomizations`.
- **A type mismatch resolves to the target's value, with no recursion.** If the template has
  `"files.exclude": { … }` and the target has `"files.exclude": "none"`, the string stays.

Both sides must parse with `JSON.parse`. A target that a developer has added `//` comments to (VS
Code tolerates them; JSON doesn't) is reported as an `"ERROR"` action and left untouched, as is a
template that isn't valid JSON. If the target doesn't exist yet, the template is written as-is and
reported as `"CREATE"`. There is no "template wins except for these keys" mode — a JSON file where
the template should be authoritative simply isn't listed in `jsonMergeFiles`.

**`regexCustomizations`** is the regex-scoped analog of the comment-delimited block, for a format
that can't hold a comment (JSON) or a single inline token that doesn't need a whole block:

```ts
regexCustomizations: [
  { path: '.myapprc.json', pattern: /"apiVersion":\s*"([^"]+)"/ },
  { path: 'bin/deploy.sh', pattern: [/^TARGET_ORG=(.*)$/m, /^TIMEOUT=(\d+)$/m] },
];
```

Each `pattern` (one or a list, applied in order) needs exactly one capturing group — it only proves
the pattern identifies a customizable value; the _whole_ match, not just the group, is what gets
preserved. Only the first match per pattern is used, never a global replace, so a file needing more
than one independently customizable spot lists more than one pattern rather than relying on one
pattern matching repeatedly. A pattern that matches the target but not the template (or vice versa)
is handled the same way an unbalanced block is: matching the target but not the template just means
nothing to preserve yet (the template's own text is kept); not matching the template at all is
reported as an `"ERROR"` action, since it means the rule no longer corresponds to anything in the
current template.

## Project-local config-file overrides

`resolveSetupConfig` doesn't read any file itself — it takes a `localOverrides` argument shaped
`{ include?: string[]; exclude?: string[] }` and applies it before a preset or boolean flags. A
consumer that wants a project-local override file (its own name, its own schema, its own other
fields) parses and validates it however it likes, then passes just that shape through:

```ts
import { resolveSetupConfig } from '@simplysf/simply-project-setup-core';

// however your command finds/reads/validates its own config file
const myConfig = loadMyConfigFile();

const config = resolveSetupConfig({
  flags,
  localOverrides: myConfig?.setup, // e.g. { exclude: ['utam'] }
  baseConfig,
});
```

## API

Everything below is exported from the package root. Removing or renaming an export is a breaking
change; see [`src/index.ts`](src/index.ts).

| Export                               | Description                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `resolveSetupConfig(options)`        | Resolves the feature list to apply from a base config, local overrides, a preset, and flags.                               |
| `standardizeFiles(options)`          | Copies template packs into the project, composes `.gitignore`, deletes banned files.                                       |
| `standardizePackageJson(options)`    | Writes `private`/`type`/`workspaces` and feature-gated `scripts`/`wireit` entries.                                         |
| `writeDependencies(options)`         | Merges each included feature's `dependencies.json` into `package.json`.                                                    |
| `PackageJson`, `PackageJsonContents` | Reads/mutates/writes a project's `package.json`, ordering keys on write; `PackageJsonContents` is the parsed file's shape. |
| `exists(path)`                       | `true` if a path exists and is accessible.                                                                                 |
| `loadRootPath(fileName, cwd?)`       | Walks up from `cwd` for the nearest ancestor directory containing `fileName`.                                              |
| `log(message, indent?)`              | A small indent-aware `console.warn` wrapper used by `PackageJson.write()`.                                                 |
| `orderMap(map)`                      | Returns a copy of `map` with keys sorted alphabetically.                                                                   |
| `semverIsLessThan(version, target)`  | Compares two plain `major.minor.patch` strings.                                                                            |
| `RegexCustomization`                 | Type for a `standardizeFiles` `regexCustomizations` entry — see above.                                                     |

### End-to-end example

```ts
import {
  resolveSetupConfig,
  standardizeFiles,
  standardizePackageJson,
  writeDependencies,
  type SetupConfig,
} from '@simplysf/simply-project-setup-core';
import path from 'node:path';

const templatesPath = path.join(import.meta.dirname, 'templates');
const myConfig = loadMyConfigFile(); // however your command finds/reads/validates its own config file

const baseConfig: SetupConfig = {
  include: ['core'],
  exclude: [],
  add: [],
  banned: ['.prettierrc.mjs'],
};

const config = resolveSetupConfig({
  flags, // this command's own parsed flags
  localOverrides: myConfig?.setup, // e.g. { exclude: ['utam'] } — this package owns no config-file format
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
  protectedFiles: ['.env'],
  jsonMergeFiles: ['.vscode/settings.json', '.myapprc.json'],
  regexCustomizations: [{ path: 'bin/deploy.sh', pattern: /^TARGET_ORG=(.*)$/m }],
  transformFile: ({ destRelativePath, content }) =>
    destRelativePath === '.husky/pre-commit' ? content.replace('REPLACE_WITH_BRANCH_REGEX', myBranchRegex()) : content,
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
