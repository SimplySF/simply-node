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

import { ExecuteService, type ExecuteAnonymousResponse } from '@salesforce/apex-node';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import sinon from 'sinon';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { executeApex } from '../src/apexExecute.js';

describe('executeApex', () => {
  const $$ = new TestContext({ sinon });
  const testOrg = new MockTestOrgData();

  beforeAll(async () => {
    await $$.stubAuths(testOrg);
  });

  afterEach(() => {
    $$.restore();
  });

  it('returns the compile/execution result on success', async () => {
    const connection = await testOrg.getConnection();
    const response: ExecuteAnonymousResponse = {
      success: true,
      compiled: true,
      logs: 'test logs',
      diagnostic: [
        { compileProblem: '', exceptionMessage: '', exceptionStackTrace: '', lineNumber: -1, columnNumber: -1 },
      ],
    };
    $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(response);

    const result = await executeApex(connection, 'scripts/apex/data-fix.apex');

    expect(result).toEqual({
      success: true,
      compiled: true,
      compileProblem: '',
      exceptionMessage: '',
      exceptionStackTrace: '',
      line: -1,
      column: -1,
      logs: 'test logs',
    });
  });

  it('throws ApexExecuteError with code compile-failed when compilation fails', async () => {
    const connection = await testOrg.getConnection();
    const response: ExecuteAnonymousResponse = {
      success: false,
      compiled: false,
      diagnostic: [
        {
          compileProblem: 'Unexpected token',
          exceptionMessage: '',
          exceptionStackTrace: '',
          lineNumber: 3,
          columnNumber: 7,
        },
      ],
    };
    $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(response);

    await expect(executeApex(connection, 'scripts/apex/broken.apex')).rejects.toMatchObject({
      code: 'compile-failed',
      result: { line: 3, column: 7, compileProblem: 'Unexpected token' },
    });
  });

  it('throws ApexExecuteError with code execute-failed when execution throws', async () => {
    const connection = await testOrg.getConnection();
    const response: ExecuteAnonymousResponse = {
      success: false,
      compiled: true,
      diagnostic: [
        {
          compileProblem: '',
          exceptionMessage: 'System.NullPointerException',
          exceptionStackTrace: 'Class.Foo.bar: line 1',
          lineNumber: -1,
          columnNumber: -1,
        },
      ],
    };
    $$.SANDBOX.stub(ExecuteService.prototype, 'executeAnonymous').resolves(response);

    await expect(executeApex(connection, 'scripts/apex/throws.apex')).rejects.toMatchObject({
      code: 'execute-failed',
      result: { exceptionMessage: 'System.NullPointerException' },
    });
  });
});
