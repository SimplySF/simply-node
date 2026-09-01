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
import {
  ApexTestSuiteError,
  generateApexTestSuite,
  type ApexTestSuiteGenerateResult,
} from '@simplysf/simply-apex-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-apex', 'simply.apex.test-suite.generate');

export type { ApexTestSuiteGenerateResult } from '@simplysf/simply-apex-core';

/** Maps `ApexTestSuiteError`'s structural codes to this command's own `Messages` catalog. */
function toCliError(error: ApexTestSuiteError): Error {
  switch (error.code) {
    case 'no-test-classes-found':
      return messages.createError('error.noTestClassesFound');
    case 'scan-failed':
      return messages.createError('error.scanFailed', [error.message]);
  }
}

/**
 * Scans one or more source directories for Apex classes whose first meaningful line is an
 * `@IsTest` annotation, then generates an `ApexTestSuite` metadata file listing them.
 */
export default class ApexTestSuiteGenerate extends SfCommand<ApexTestSuiteGenerateResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    'source-dir': Flags.directory({
      summary: messages.getMessage('flags.source-dir.summary'),
      description: messages.getMessage('flags.source-dir.description'),
      char: 'd',
      exists: true,
      multiple: true,
      required: true,
    }),
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      description: messages.getMessage('flags.name.description'),
      char: 'n',
      required: true,
    }),
    'output-dir': Flags.directory({
      summary: messages.getMessage('flags.output-dir.summary'),
      description: messages.getMessage('flags.output-dir.description'),
      required: true,
    }),
  };

  /** @returns The generated file's path and the test class names it lists. */
  public async run(): Promise<ApexTestSuiteGenerateResult> {
    const { flags } = await this.parse(ApexTestSuiteGenerate);

    this.spinner.start(messages.getMessage('info.scanning'));

    let result: ApexTestSuiteGenerateResult;
    try {
      result = await generateApexTestSuite(flags['source-dir'], flags['output-dir'], flags.name);
    } catch (error) {
      this.spinner.stop();
      throw error instanceof ApexTestSuiteError ? toCliError(error) : error;
    }

    this.spinner.stop();

    this.info(messages.getMessage('info.fileGenerated', [result.filePath]));

    this.table({
      data: result.testClassNames.map((className) => ({ class: className })),
      columns: [{ key: 'class', name: 'CLASS' }],
    });

    return result;
  }
}
