/*
 * Copyright (c) 2026, Clay Chipps.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Sfdevrc } from './sfdevrcSchema.js';

/**
 * The resolved set of feature ids a project setup run should apply. A "feature id" is just the
 * name of a subdirectory under a consumer's `templatesPath` (see `standardizeFiles`) — this
 * package never hardcodes what a feature id can be.
 */
export interface SetupConfig {
  /** Feature ids whose template pack should be copied and whose `dependencies.json` should be merged. */
  include: string[];
  /** Feature ids removed from `include` after presets/flags are applied — see `resolveSetupConfig`. */
  exclude: string[];
  /** Extra individual template paths (relative to `templatesPath`) to copy in addition to `include`. */
  add: string[];
  /** Glob patterns (relative to the project root) to delete, evaluated after every other step. */
  banned?: string[];
}

/** A command's own parsed flags, as `resolveSetupConfig` expects to receive them. */
export type SetupFlags = Record<string, boolean | string | undefined>;

export interface ResolveSetupConfigOptions {
  /** This command's own parsed flags. */
  flags: SetupFlags;
  /** The project's parsed `.sfdevrc.json` (see `loadSfdevrc`), if any. */
  sfdevrc?: Sfdevrc;
  /** Starting point before any override is applied. */
  baseConfig: SetupConfig;
  /** Named presets; a matched preset replaces `include` outright, short-circuiting `booleanFeatures`. */
  presets?: Record<string, string[]>;
  /** Flag names that add (`true`) or remove (`false`) a same-named feature id from `include`. */
  booleanFeatures?: string[];
  /** The flag name checked against `presets`. Defaults to `"preset"`. */
  presetFlagName?: string;
  /** Feature ids that, if any is included, require `packageJsonFeatureId` to also be included. */
  dependentFeatures?: string[];
  /** The feature id added/removed per `dependentFeatures`. Defaults to `"package-json"`. */
  packageJsonFeatureId?: string;
}

export interface FileAction {
  /** Path relative to the project root. */
  file: string;
  action: 'CREATE' | 'UPDATE' | 'MERGE' | 'DELETE' | 'ERROR';
}

export interface TransformFileContext {
  /** Absolute path of the template source file. */
  sourcePath: string;
  /** Path relative to the project root that the file will be written to (after `renameFile`). */
  destRelativePath: string;
  /** The template file's contents, as read from `sourcePath`. */
  content: string;
}

export interface StandardizeFilesOptions {
  config: SetupConfig;
  /** Directory of feature packs — see this package's README for the expected shape. */
  templatesPath: string;
  /** Defaults to the nearest ancestor directory containing a `package.json`, else `process.cwd()`. */
  projectPath?: string;
  /**
   * Prepended to the composed `.gitignore`. Omit to skip writing a `.gitignore` header (the file
   * is still written when at least one gitignore template contributed content).
   */
  gitignoreHeader?: string;
  /** Maps a template's relative destination path to a different one, e.g. dropping a leading dot. */
  renameFile?: (destRelativePath: string) => string;
  /** Relative destination paths that are only ever created, never overwritten once they exist. */
  protectedFiles?: string[];
  /** Rewrites a copied file's content before it's written; return `content` unchanged to skip. */
  transformFile?: (context: TransformFileContext) => string;
}

export interface PackageJsonDefaults {
  private?: boolean;
  type?: string;
  workspaces?: string[];
  /** The full set of scripts this consumer's setup can write, keyed by script name. */
  scripts?: Record<string, string>;
  /** Opaque — copied through as-is (this package doesn't interpret wireit's shape). */
  wireit?: Record<string, unknown>;
  /** Which of `scripts` (and `wireit`, by the same key) belong to which feature id, for pruning. */
  featureScripts?: Record<string, string[]>;
}

export interface StandardizePackageJsonOptions {
  config: SetupConfig;
  defaults: PackageJsonDefaults;
  projectPath?: string;
}

export interface WriteDependenciesOptions {
  config: SetupConfig;
  templatesPath: string;
  projectPath?: string;
}
