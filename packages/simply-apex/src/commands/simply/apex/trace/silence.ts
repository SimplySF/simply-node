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

import { Messages } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { requireConnection, targetOrgFlags } from '@simplysf/simply-plugin-kit';
import {
  ApexTraceSilenceError,
  resolveClasses,
  silenceApexClasses,
  type ApexTraceSilenceOutcome,
  type ApexTraceSilenceResult,
} from '../../../../common/apexTraceSilence.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-apex', 'simply.apex.trace.silence');

export type { ApexTraceSilenceResult } from '../../../../common/apexTraceSilence.js';

/**
 * Creates or updates a 24-hour CLASS_TRACING trace flag with a fully suppressed (NONE) debug
 * level for each specified Apex class, preventing those classes from generating debug log
 * output. Classes that already have a trace flag have its expiration extended instead of getting
 * a duplicate.
 */
export default class ApexTraceSilence extends SfCommand<ApexTraceSilenceResult[]> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    ...targetOrgFlags,
    classes: Flags.string({
      summary: messages.getMessage('flags.classes.summary'),
      description: messages.getMessage('flags.classes.description'),
      char: 'c',
      exclusive: ['classes-file'],
    }),
    'classes-file': Flags.file({
      summary: messages.getMessage('flags.classes-file.summary'),
      description: messages.getMessage('flags.classes-file.description'),
      exists: true,
      exclusive: ['classes'],
    }),
    fflib: Flags.boolean({
      summary: messages.getMessage('flags.fflib.summary'),
      description: messages.getMessage('flags.fflib.description'),
      default: false,
    }),
    at4dx: Flags.boolean({
      summary: messages.getMessage('flags.at4dx.summary'),
      description: messages.getMessage('flags.at4dx.description'),
      default: false,
    }),
    'force-di': Flags.boolean({
      summary: messages.getMessage('flags.force-di.summary'),
      description: messages.getMessage('flags.force-di.description'),
      default: false,
    }),
  };

  /**
   * @returns The trace flag created or updated for each Apex class that was found and
   * successfully silenced. Classes that couldn't be found or whose trace flag couldn't be
   * created/updated are warned about and omitted.
   */
  public async run(): Promise<ApexTraceSilenceResult[]> {
    const { flags } = await this.parse(ApexTraceSilence);

    const targetOrgConnection = requireConnection(flags);

    const classNames = flags.classes
      ? flags.classes
          .split(',')
          .map((className) => className.trim())
          .filter(Boolean)
      : [];

    let classes: string[];
    try {
      classes = resolveClasses(classNames, flags['classes-file'], {
        fflib: flags.fflib,
        at4dx: flags.at4dx,
        forceDi: flags['force-di'],
      });
    } catch (error) {
      if (error instanceof ApexTraceSilenceError && error.code === 'invalid-classes-file') {
        throw messages.createError('error.invalidClassesFile', [error.message]);
      }
      throw error;
    }

    if (classes.length === 0) {
      throw messages.createError('error.noClassesSpecified');
    }

    let outcome: ApexTraceSilenceOutcome;
    try {
      outcome = await silenceApexClasses(targetOrgConnection, classes, (phase) => {
        switch (phase) {
          case 'checking-debug-level':
            this.spinner.start(messages.getMessage('info.checkingDebugLevel'));
            break;
          case 'finding-classes':
            this.spinner.stop();
            this.spinner.start(messages.getMessage('info.findingClasses'));
            break;
          case 'creating-trace-flags':
            this.spinner.stop();
            this.spinner.start(messages.getMessage('info.creatingTraceFlags'));
            break;
        }
      });
    } catch (error) {
      this.spinner.stop();
      if (error instanceof ApexTraceSilenceError && error.code === 'debug-level-create-failed') {
        throw messages.createError('error.debugLevelCreateFailed', [error.message]);
      }
      throw error;
    }
    this.spinner.stop();

    if (outcome.results.length === 0 && outcome.missingClassNames.length === classes.length) {
      this.warn(messages.getMessage('warning.noClassesFound'));
      return [];
    }

    if (outcome.missingClassNames.length > 0) {
      this.warn(messages.getMessage('warning.someClassesNotFound', [outcome.missingClassNames.join(', ')]));
    }

    for (const failure of outcome.failures) {
      const key = failure.action === 'update' ? 'warning.traceFlagUpdateFailed' : 'warning.traceFlagCreateFailed';
      this.warn(messages.getMessage(key, [failure.class, failure.error]));
    }

    this.table({
      data: outcome.results,
      columns: [
        { key: 'class', name: 'CLASS' },
        { key: 'classId', name: 'CLASS ID' },
        { key: 'traceFlagId', name: 'TRACE FLAG ID' },
      ],
    });

    return outcome.results;
  }
}
