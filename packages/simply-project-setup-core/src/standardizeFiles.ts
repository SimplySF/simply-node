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

import { basename, dirname, join, relative } from 'node:path';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { globSync } from 'glob';
import { exists } from './exists.js';
import { loadRootPath } from './loadRootPath.js';
import { FileAction, StandardizeFilesOptions } from './types.js';

const CUSTOMIZATION_START = '# -- START CUSTOMIZATION';
const CUSTOMIZATION_END = '# -- END CUSTOMIZATION';

function normalize(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

function readTargetContent(targetPath: string): string | undefined {
  try {
    return readFileSync(targetPath, 'utf8');
  } catch {
    return undefined;
  }
}

function writeIfDifferent(targetPath: string, content: string): 'CREATE' | 'UPDATE' | undefined {
  const isNew = !exists(targetPath);
  const existing = readTargetContent(targetPath);
  if (existing !== undefined && normalize(existing) === normalize(content)) {
    return undefined;
  }
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, content);
  return isNew ? 'CREATE' : 'UPDATE';
}

function recursiveFind(dir: string): string[] {
  return readdirSync(dir).flatMap((item) => {
    const path = join(dir, item);
    return statSync(path).isDirectory() ? recursiveFind(path) : path;
  });
}

function getProjectRoot(projectPath?: string): string {
  if (projectPath) {
    return projectPath;
  }
  try {
    return loadRootPath('package.json');
  } catch {
    return process.cwd();
  }
}

function findCustomizationIndices(content: string): number[] {
  const indices: number[] = [];
  let idx = 0;
  let startIdx = content.indexOf(CUSTOMIZATION_START, idx);
  while (startIdx !== -1) {
    const endIdx = content.indexOf(CUSTOMIZATION_END, startIdx);
    if (endIdx === -1) break;
    indices.push(startIdx, endIdx);
    idx = endIdx + CUSTOMIZATION_END.length;
    startIdx = content.indexOf(CUSTOMIZATION_START, idx);
  }
  return indices;
}

function checkCustomizationBalance(content: string, indices: number[]): boolean {
  const starts = (content.match(new RegExp(CUSTOMIZATION_START, 'g')) ?? []).length;
  const ends = (content.match(new RegExp(CUSTOMIZATION_END, 'g')) ?? []).length;
  return starts === ends && indices.length === starts * 2;
}

function hasCustomization(content: string): boolean {
  return content.includes(CUSTOMIZATION_START);
}

/**
 * Preserves the existing target's customization-marked region(s) when re-copying a template that
 * carries them. Returns `undefined` when the source and target don't carry a matching, balanced
 * set of customization markers to merge — the caller reports that as an `"ERROR"` action.
 */
function mergeCustomization(sourceContent: string, targetContent: string): string | undefined {
  const sourceIndices = findCustomizationIndices(sourceContent);
  const targetIndices = findCustomizationIndices(targetContent);

  if (
    !checkCustomizationBalance(sourceContent, sourceIndices) ||
    !checkCustomizationBalance(targetContent, targetIndices) ||
    sourceIndices.length !== targetIndices.length
  ) {
    return undefined;
  }

  let merged = sourceContent;
  for (let i = sourceIndices.length - 2; i >= 0; i -= 2) {
    const targetCustomization = targetContent.substring(targetIndices[i], targetIndices[i + 1]);
    merged = merged.substring(0, sourceIndices[i]) + targetCustomization + merged.substring(sourceIndices[i + 1]);
  }
  return merged;
}

function processSingleFile(
  destinationPath: string,
  content: string,
  protectedFiles: string[],
): 'CREATE' | 'UPDATE' | 'MERGE' | 'ERROR' | undefined {
  const destFilename = basename(destinationPath);

  if (protectedFiles.includes(destFilename)) {
    if (exists(destinationPath)) {
      return undefined;
    }
    return writeIfDifferent(destinationPath, content);
  }

  if (hasCustomization(content)) {
    const targetContent = readTargetContent(destinationPath);
    if (targetContent === undefined) {
      return writeIfDifferent(destinationPath, content);
    }
    const merged = mergeCustomization(content, targetContent);
    if (merged === undefined) {
      return 'ERROR';
    }
    const result = writeIfDifferent(destinationPath, merged);
    return result ? 'MERGE' : undefined;
  }

  return writeIfDifferent(destinationPath, content);
}

function removeBannedFiles(projectRoot: string, banned: string[] | undefined): string[] {
  const deleted: string[] = [];
  if (banned && banned.length > 0) {
    for (const pattern of banned) {
      const matches = globSync(pattern, { cwd: projectRoot, absolute: true });
      for (const filePath of matches) {
        if (exists(filePath)) {
          rmSync(filePath, { force: true, recursive: true });
          deleted.push(relative(projectRoot, filePath));
        }
      }
    }
  }
  return deleted;
}

function standardizeGitignore(
  projectRoot: string,
  templatesPath: string,
  includedFeatures: string[],
  gitignoreHeader: string | undefined,
): FileAction | undefined {
  const gitignoreTemplatesPath = join(templatesPath, 'gitignore');
  const gitignorePath = join(projectRoot, '.gitignore');
  const customizationHeader = `\n${CUSTOMIZATION_START}`;
  const customizationFooter = CUSTOMIZATION_END;

  let content = '';
  const baseGitignorePath = join(gitignoreTemplatesPath, 'base.gitignore');
  if (exists(baseGitignorePath)) {
    content += readFileSync(baseGitignorePath, 'utf8');
  }

  for (const feature of includedFeatures) {
    const featureGitignorePath = join(gitignoreTemplatesPath, `${feature}.gitignore`);
    if (exists(featureGitignorePath)) {
      content += `\n# ${feature}\n`;
      content += readFileSync(featureGitignorePath, 'utf8');
    }
  }

  if (!content) {
    return undefined;
  }

  let customizationContent = '';
  const existingContent = readTargetContent(gitignorePath);
  if (existingContent !== undefined) {
    const start = existingContent.indexOf(customizationHeader);
    if (start !== -1) {
      const end = existingContent.indexOf(customizationFooter, start);
      if (end !== -1) {
        customizationContent = existingContent.substring(start, end + customizationFooter.length);
      }
    }
  }

  if (!customizationContent) {
    customizationContent = `${customizationHeader}\n${customizationFooter}`;
  }

  const finalContent = (gitignoreHeader ?? '') + content + '\n' + customizationContent + '\n';
  const result = writeIfDifferent(gitignorePath, finalContent);
  return result ? { file: '.gitignore', action: result } : undefined;
}

/**
 * Copies each included feature's template pack into the project (skipping `dependencies.json` —
 * that's `writeDependencies`'s job), composes `.gitignore`, and deletes any banned glob matches.
 * See this package's README for the templates-directory contract and the optional hooks.
 */
export function standardizeFiles(options: StandardizeFilesOptions): FileAction[] {
  const {
    config,
    templatesPath,
    projectPath,
    gitignoreHeader,
    renameFile,
    protectedFiles = [],
    transformFile,
  } = options;
  const projectRoot = getProjectRoot(projectPath);
  const { include, exclude, add } = config;

  const rename = (destRelativePath: string): string => (renameFile ? renameFile(destRelativePath) : destRelativePath);

  const filesToProcess = new Map<string, string>(); // Map<destination, source>

  for (const packName of include) {
    const packPath = join(templatesPath, packName);
    if (!exists(packPath)) continue;
    const packFiles = recursiveFind(packPath);

    for (const sourcePath of packFiles) {
      if (basename(sourcePath) === 'dependencies.json') {
        continue;
      }
      const destRelativePath = rename(relative(packPath, sourcePath));
      filesToProcess.set(join(projectRoot, destRelativePath), sourcePath);
    }
  }

  for (const addPath of add) {
    const sourcePath = join(templatesPath, addPath);
    if (exists(sourcePath)) {
      if (basename(sourcePath) === 'dependencies.json') {
        continue;
      }
      const destRelativePath = rename(basename(addPath));
      filesToProcess.set(join(projectRoot, destRelativePath), sourcePath);
    }
  }

  for (const excludePath of exclude) {
    const [, ...filePathParts] = excludePath.split('/');
    const destRelativePath = rename(join(...filePathParts));
    const key = join(projectRoot, destRelativePath);
    filesToProcess.delete(key);
  }

  const actions: FileAction[] = [];

  const gitignoreAction = standardizeGitignore(projectRoot, templatesPath, include, gitignoreHeader);
  if (gitignoreAction) {
    actions.push(gitignoreAction);
  }

  for (const [destinationPath, sourcePath] of filesToProcess.entries()) {
    const destRelativePath = relative(projectRoot, destinationPath);
    let content = readFileSync(sourcePath, 'utf8');
    if (transformFile) {
      content = transformFile({ sourcePath, destRelativePath, content });
    }
    const action = processSingleFile(destinationPath, content, protectedFiles);
    if (action) {
      actions.push({ file: destRelativePath, action });
    }
  }

  const deletedFiles = removeBannedFiles(projectRoot, config.banned);
  for (const file of deletedFiles) {
    actions.push({ file, action: 'DELETE' });
  }

  return actions;
}
