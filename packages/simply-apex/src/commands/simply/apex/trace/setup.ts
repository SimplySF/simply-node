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
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { requireConnection, targetOrgFlags } from '@simplysf/simply-plugin-kit';
import {
  ApexTraceSetupError,
  DATE_TIME_PATTERN,
  parseOnBehalfOf,
  setupApexTrace,
  type ApexTraceSetupResult,
  type OnBehalfOf,
} from '../../../../common/apexTraceSetup.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-apex', 'simply.apex.trace.setup');

export type { ApexTraceSetupResult } from '../../../../common/apexTraceSetup.js';

/** Maps `ApexTraceSetupError`'s structural codes to this command's own `Messages` catalog. */
function toCliError(error: ApexTraceSetupError): Error {
  switch (error.code) {
    case 'user-not-found':
      return messages.createError('error.userNotFound', error.args);
    case 'ambiguous-on-behalf-of':
      return messages.createError('error.ambiguousOnBehalfOf', error.args);
    case 'debug-level-not-found':
      return messages.createError('error.debugLevelNotFound', error.args);
    case 'debug-level-create-failed':
      return messages.createError('error.debugLevelCreateFailed', error.args);
    case 'trace-flag-create-failed':
      return messages.createError('error.traceFlagCreateFailed', error.args);
    case 'invalid-date-range':
      return messages.createError('error.invalidDateRange', error.args);
  }
}

/**
 * Creates or updates a DEVELOPER_LOG trace flag for the target user. The target user is the one
 * running the command by default, or the user identified by `--on-behalf-of` if provided. By
 * default the trace flag uses the FINEST/FINER `ReplayDebuggerLevels` debug level suitable for
 * the Apex Replay Debugger and runs for 24 hours starting now; `--log-level`, `--start-date`, and
 * `--end-date` override those defaults.
 */
export default class ApexTraceSetup extends SfCommand<ApexTraceSetupResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    ...targetOrgFlags,
    'on-behalf-of': Flags.custom<OnBehalfOf>({
      // eslint-disable-next-line @typescript-eslint/require-await
      parse: async (input) => {
        const onBehalfOf = parseOnBehalfOf(input);

        if (!onBehalfOf) {
          throw messages.createError('error.invalidOnBehalfOf', [input]);
        }

        return onBehalfOf;
      },
    })({
      summary: messages.getMessage('flags.on-behalf-of.summary'),
      description: messages.getMessage('flags.on-behalf-of.description'),
    }),
    'log-level': Flags.string({
      summary: messages.getMessage('flags.log-level.summary'),
      description: messages.getMessage('flags.log-level.description'),
    }),
    'start-date': Flags.string({
      summary: messages.getMessage('flags.start-date.summary'),
      description: messages.getMessage('flags.start-date.description'),
      // eslint-disable-next-line @typescript-eslint/require-await
      parse: async (input: string): Promise<string> => {
        if (!DATE_TIME_PATTERN.test(input)) {
          throw messages.createError('error.invalidDateTime', ['start-date', input]);
        }
        return input;
      },
    }),
    'end-date': Flags.string({
      summary: messages.getMessage('flags.end-date.summary'),
      description: messages.getMessage('flags.end-date.description'),
      // eslint-disable-next-line @typescript-eslint/require-await
      parse: async (input: string): Promise<string> => {
        if (!DATE_TIME_PATTERN.test(input)) {
          throw messages.createError('error.invalidDateTime', ['end-date', input]);
        }
        return input;
      },
    }),
  };

  /**
   * @returns The IDs of the debug level and trace flag that were created or updated, and the
   * trace flag's new expiration date.
   */
  public async run(): Promise<ApexTraceSetupResult> {
    const { flags } = await this.parse(ApexTraceSetup);

    const targetOrgConnection = requireConnection(flags);

    let result: ApexTraceSetupResult;
    try {
      result = await setupApexTrace(
        targetOrgConnection,
        {
          onBehalfOf: flags['on-behalf-of'],
          logLevel: flags['log-level'],
          startDate: flags['start-date'],
          endDate: flags['end-date'],
        },
        (phase) => {
          switch (phase) {
            case 'finding-user':
              this.spinner.start(messages.getMessage('info.findingUser'));
              break;
            case 'checking-debug-level':
              this.spinner.stop();
              this.spinner.start(messages.getMessage('info.checkingDebugLevel'));
              break;
            case 'configuring-trace-flag':
              this.spinner.stop();
              this.spinner.start(messages.getMessage('info.configuringTraceFlag'));
              break;
          }
        },
      );
    } catch (error) {
      this.spinner.stop();
      throw error instanceof ApexTraceSetupError ? toCliError(error) : error;
    }
    this.spinner.stop();

    this.info(messages.getMessage('info.complete', [result.expirationDate]));

    return result;
  }
}
