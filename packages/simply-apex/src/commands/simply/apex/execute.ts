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

import path from 'node:path';
import { Messages } from '@salesforce/core';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { requireConnection, targetOrgFlags } from '@simplysf/simply-plugin-kit';
import { ApexExecuteError, executeApex, type ApexExecuteResult } from '../../../common/apexExecute.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-apex', 'simply.apex.execute');

export type { ApexExecuteResult } from '../../../common/apexExecute.js';

/**
 * Executes an anonymous block of Apex code from a local .apex file against a target org and
 * reports the compile and execution results, including any debug logs produced.
 */
export default class ApexExecute extends SfCommand<ApexExecuteResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    ...targetOrgFlags,
    file: Flags.file({
      summary: messages.getMessage('flags.file.summary'),
      description: messages.getMessage('flags.file.description'),
      char: 'f',
      exists: true,
      required: true,
    }),
  };

  /**
   * @returns The compile/execution result. Throws if compilation or execution failed.
   */
  public async run(): Promise<ApexExecuteResult> {
    const { flags } = await this.parse(ApexExecute);

    const targetOrgConnection = requireConnection(flags);

    this.spinner.start(`Executing ${path.parse(flags.file).name}`);

    let result: ApexExecuteResult;
    try {
      result = await executeApex(targetOrgConnection, flags.file);
    } catch (error) {
      this.spinner.stop(messages.getMessage('info.failed'));

      if (error instanceof ApexExecuteError) {
        if (error.code === 'compile-failed') {
          throw messages.createError('error.compileFailed', [
            error.result.line,
            error.result.column,
            error.result.compileProblem,
          ]);
        }
        throw messages.createError('error.executeFailed', [error.result.exceptionMessage]);
      }
      throw error;
    }

    this.spinner.stop();

    if (result.logs) {
      this.log(result.logs);
    }

    return result;
  }
}
