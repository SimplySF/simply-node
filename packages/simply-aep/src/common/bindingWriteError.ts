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

import type { Messages } from '@salesforce/core';
import { BindingWriteError, type BindingIssue } from '@simplysf/simply-aep-core';

/**
 * Maps a `BindingWriteError` thrown by `createBinding`/`updateBinding` onto the calling command's own
 * `error.*` message keys, shared by `create.ts`/`update.ts` since both throw the same error type for the
 * same set of codes. Mirrors `domainProcessBindingWriteError.ts`'s `toDomainProcessBindingCliError` —
 * see docs/design/0015-at4dx-binding-validate-create-set.md.
 *
 * @param error - Whatever `createBinding`/`updateBinding` rejected with.
 * @param messages - The calling command's own loaded message catalog.
 * @param printIssues - Renders a validation issue table (the command's own `this.table`-based printer).
 * @returns An `Error` ready to throw from the command's `run()` — an `SfError` built from a message key when `error` is a recognized `BindingWriteError`, or `error` itself (coerced to `Error`) otherwise.
 */
export function toBindingCliError(
  error: unknown,
  messages: Messages<string>,
  printIssues: (issues: BindingIssue[]) => void,
): Error {
  if (!(error instanceof BindingWriteError)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  switch (error.code) {
    case 'source-or-target-required':
      return messages.createError('error.sourceDirOrTargetOrgRequired');
    case 'type-field-mismatch':
      return messages.createError('error.typeFieldMismatch', [error.message]);
    case 'invalid-developer-name':
      return messages.createError('error.invalidDeveloperName', [error.message]);
    case 'label-too-long':
      return messages.createError('error.labelTooLong', [error.message]);
    case 'developer-name-already-exists':
      return messages.createError('error.developerNameAlreadyExists', [error.message]);
    case 'developer-name-not-found':
      return messages.createError('error.developerNameNotFound', [error.message]);
    case 'no-fields-to-update':
      return messages.createError('error.noFieldsToUpdate');
    case 'at4dx-not-detected':
      return messages.createError('error.at4dxNotDetected', [error.message]);
    case 'validation-failed':
      printIssues(error.issues ?? []);
      return messages.createError('error.validationFailed');
    case 'deploy-failed':
      return messages.createError('error.deployFailed', [error.message]);
    default:
      return error;
  }
}
