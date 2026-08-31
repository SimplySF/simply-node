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

import { exec as execCallback } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { Messages } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { buildChangeReportHtml, type ChangeEntry, type ChangesByComponentType } from '@simplysf/simply-document-core';

const exec = promisify(execCallback);

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-document', 'simply.document.diff');

/** Maps a source-format directory name to the component type it's grouped under in the report. */
const COMPONENT_TYPE_MAPPING: Record<string, string> = {
  classes: 'apexClasses',
  triggers: 'apexTriggers',
  approvalProcesses: 'approvalProcesses',
  aura: 'auraComponents',
  applications: 'customApplications',
  labels: 'customLabels',
  customMetadata: 'customMetadata',
  dashboards: 'dashboards',
  digitalExperienceBundles: 'digitalExperienceBundles',
  email: 'emailTemplates',
  experienceBundles: 'experienceBundles',
  flexipages: 'flexipages',
  flows: 'flows',
  groups: 'groups',
  lwc: 'lightningComponents',
  permissionsets: 'permissionSets',
  permissionsetgroups: 'permissionSetGroups',
  queues: 'queues',
  reports: 'reports',
  sharingRules: 'sharingRules',
  staticresources: 'staticResources',
  pages: 'visualforcePages',
};

/** Maps a `git diff --name-status` status letter to the label rendered in the report. */
const CHANGE_TYPE_LABELS: Record<string, string> = {
  A: 'Added',
  M: 'Modified',
  R: 'Renamed',
  D: 'Deleted',
  C: 'Copied',
};

/**
 * Determine the report component type/name for a changed source-format file path, by walking its
 * path segments looking for a recognized metadata directory name.
 *
 * @param filePath - The changed file's path, as reported by `git diff --name-status`.
 * @returns The component type this file is grouped under, and its component name.
 */
async function getComponentTypeFromPath(filePath: string): Promise<{ componentType: string; componentName: string }> {
  const parts = filePath.split('/');

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part === 'objects') {
      const objectName = parts[i + 1] || 'Unknown';
      let componentType = 'standardObjects';

      if (objectName.endsWith('__mdt')) {
        componentType = 'customMetadataTypes';
      } else if (objectName.endsWith('__e')) {
        componentType = 'platformEvents';
      } else if (objectName.endsWith('__c')) {
        componentType = 'customObjects';

        // Try to detect if it's a Custom Setting by looking for the .object-meta.xml file on disk
        const objectMetaPath =
          filePath.split(`/objects/${objectName}/`)[0] + `/objects/${objectName}/${objectName}.object-meta.xml`;
        try {
          // eslint-disable-next-line no-await-in-loop
          const content = await fs.readFile(objectMetaPath, 'utf-8');
          if (content.includes('<customSettingsType>')) {
            componentType = 'customSettings';
          }
        } catch {
          // File might not exist (e.g. deleted, or we're in a different directory)
        }
      }

      return {
        componentType,
        componentName: objectName.replace(/\.[^/.]+$/, ''),
      };
    }

    if (COMPONENT_TYPE_MAPPING[part]) {
      const componentName = parts[i + 1] || 'Unknown';
      return {
        componentType: COMPONENT_TYPE_MAPPING[part],
        componentName: componentName.replace(/\.[^/.]+$/, ''),
      };
    }
  }

  const fileName = path.basename(filePath);
  return {
    componentType: 'Unknown',
    componentName: fileName.replace(/\.[^/.]+$/, ''),
  };
}

/** The rendered report, and where it was written (if `--output-file` was specified). */
export type DocumentDiffResult = {
  html: string;
  outputFile?: string;
};

/**
 * Generates a Confluence-storage-format change report between two git refs, grouping changed
 * files by Salesforce metadata component type.
 */
export default class DocumentDiff extends SfCommand<DocumentDiffResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    'from-tag': Flags.string({
      summary: messages.getMessage('flags.from-tag.summary'),
      required: true,
    }),
    'to-tag': Flags.string({
      summary: messages.getMessage('flags.to-tag.summary'),
      required: true,
    }),
    'output-file': Flags.string({
      summary: messages.getMessage('flags.output-file.summary'),
      description: messages.getMessage('flags.output-file.description'),
    }),
    'template-file': Flags.file({
      summary: messages.getMessage('flags.template-file.summary'),
      description: messages.getMessage('flags.template-file.description'),
      exists: true,
    }),
    'output-format': Flags.custom<'html'>({ options: ['html'] })({
      summary: messages.getMessage('flags.output-format.summary'),
      description: messages.getMessage('flags.output-format.description'),
      default: 'html',
    }),
  };

  /** @returns The rendered change report, and where it was written (if `--output-file` was specified). */
  public async run(): Promise<DocumentDiffResult> {
    const { flags } = await this.parse(DocumentDiff);
    const fromTag = flags['from-tag'];
    const toTag = flags['to-tag'];

    const customTemplateSource = flags['template-file']
      ? await fs.readFile(flags['template-file'], 'utf-8')
      : undefined;

    this.spinner.start(messages.getMessage('info.generatingDiff', [fromTag, toTag]));

    let stdout: string;
    let stderr: string;
    try {
      ({ stdout, stderr } = await exec(`git diff --name-status ${fromTag}..${toTag}`));
    } catch (error) {
      this.spinner.stop();
      throw messages.createError('error.gitDiffFailed', [(error as Error).message]);
    }

    if (stderr) {
      // git diff can write informational messages to stderr, so this isn't fatal
      this.warn(stderr);
    }

    const changedFiles = stdout.trim().length > 0 ? stdout.trim().split(/\r?\n/) : [];
    const changes: ChangesByComponentType = {};

    for (const file of changedFiles) {
      const parts = file.split('\t');
      if (parts.length < 2) {
        continue;
      }

      let changeType = parts[0];
      let filePath = parts[1];
      let changeDescription = '';

      // For renames (R...) and copies (C...), git diff returns 3 columns: [status, oldPath, newPath]
      if (parts.length === 3) {
        const oldPath = parts[1];
        filePath = parts[2];
        if (changeType.startsWith('R')) {
          changeType = 'R';
          changeDescription = `Renamed from ${oldPath}`;
        } else if (changeType.startsWith('C')) {
          changeType = 'C';
          changeDescription = `Copied from ${oldPath}`;
        }
      }

      // eslint-disable-next-line no-await-in-loop
      const { componentType, componentName } = await getComponentTypeFromPath(filePath);

      changes[componentType] ??= [];

      const shortChangeType = changeType.charAt(0);
      const transformedChangeType = CHANGE_TYPE_LABELS[shortChangeType] ?? changeType;

      changes[componentType].push({
        componentName,
        componentType,
        changeType: transformedChangeType,
        changeDescription,
        path: filePath,
      });
    }

    for (const key of Object.keys(changes)) {
      changes[key].sort((a: ChangeEntry, b: ChangeEntry) => {
        const typeCompare = a.changeType.localeCompare(b.changeType);
        if (typeCompare !== 0) {
          return typeCompare;
        }
        return a.componentName.localeCompare(b.componentName);
      });
    }

    this.spinner.stop();

    let html: string;
    if (flags['output-format'] === 'html') {
      html = buildChangeReportHtml(changes, customTemplateSource);
    } else {
      throw messages.createError('error.unsupportedOutputFormat', [flags['output-format']]);
    }

    const outputFile = flags['output-file'];
    if (outputFile) {
      await fs.writeFile(outputFile, html, 'utf-8');
      this.info(messages.getMessage('info.complete', [outputFile]));
    } else {
      this.log(html);
    }

    return { html, outputFile };
  }
}
