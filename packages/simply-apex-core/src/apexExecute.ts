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

import type { Connection } from '@salesforce/core';
import { ExecuteService } from '@salesforce/apex-node';

/** Compile/execution outcome for an anonymous Apex execution, including any debug logs produced. */
export type ApexExecuteResult = {
  success: boolean;
  compiled: boolean;
  compileProblem: string;
  exceptionMessage: string;
  exceptionStackTrace: string;
  line: number;
  column: number;
  logs?: string;
};

/** The error conditions `executeApex` signals structurally (via `code`) rather than by message text, so a `Messages`-based caller (the CLI) can map each one to its own error key without string-matching. */
export type ApexExecuteErrorCode = 'compile-failed' | 'execute-failed';

export class ApexExecuteError extends Error {
  public readonly code: ApexExecuteErrorCode;
  public readonly result: ApexExecuteResult;

  public constructor(code: ApexExecuteErrorCode, message: string, result: ApexExecuteResult) {
    super(message);
    this.name = 'ApexExecuteError';
    this.code = code;
    this.result = result;
  }
}

/**
 * Executes an anonymous block of Apex code from a local file against `connection` and returns the
 * compile/execution result, including any debug logs produced.
 *
 * @param connection - The org connection to execute against.
 * @param apexFilePath - Path to the local `.apex` file to execute.
 * @returns The compile/execution result.
 * @throws {ApexExecuteError} `compile-failed` if the Apex didn't compile, `execute-failed` if it
 * compiled but threw during execution. Either way, `error.result` carries the full result so a
 * caller can still inspect line/column/logs.
 */
export async function executeApex(connection: Connection, apexFilePath: string): Promise<ApexExecuteResult> {
  const executeService = new ExecuteService(connection);
  const response = await executeService.executeAnonymous({ apexFilePath });

  const diagnostic = response.diagnostic?.[0];

  const result: ApexExecuteResult = {
    success: response.success,
    compiled: response.compiled,
    compileProblem: diagnostic?.compileProblem ?? '',
    exceptionMessage: diagnostic?.exceptionMessage ?? '',
    exceptionStackTrace: diagnostic?.exceptionStackTrace ?? '',
    line: diagnostic?.lineNumber ?? -1,
    column: diagnostic?.columnNumber ?? -1,
    logs: response.logs,
  };

  if (!response.compiled) {
    throw new ApexExecuteError(
      'compile-failed',
      `Compile failed at line ${result.line}, column ${result.column}: ${result.compileProblem}`,
      result,
    );
  }

  if (!response.success) {
    throw new ApexExecuteError('execute-failed', `Execution failed: ${result.exceptionMessage}`, result);
  }

  return result;
}
