/*
 * Copyright (c) 2026, Clay Chipps; Copyright (c) 2026 Salesforce, Inc.
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
import { Flags } from '@salesforce/sf-plugins-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-cicd', 'simply.cicd.build');

/** Flags shared by every build command that authenticates against one or more Dev Hubs. */
export const devHubFlags = {
  'dev-hub-name': Flags.string({
    summary: messages.getMessage('flags.dev-hub-name.summary'),
    multiple: true,
    required: true,
  }),
  'dev-hub-username': Flags.string({
    summary: messages.getMessage('flags.dev-hub-username.summary'),
    multiple: true,
    required: true,
  }),
  'dev-hub-client-id': Flags.string({
    summary: messages.getMessage('flags.dev-hub-client-id.summary'),
    multiple: true,
    required: true,
  }),
  'dev-hub-instance-url': Flags.string({
    summary: messages.getMessage('flags.dev-hub-instance-url.summary'),
    multiple: true,
    required: true,
  }),
};

export const jwtKeyFileFlag = {
  'jwt-key-file': Flags.string({ summary: messages.getMessage('flags.jwt-key-file.summary'), required: true }),
};

export const debugFlag = {
  debug: Flags.boolean({ summary: messages.getMessage('flags.debug.summary'), default: false }),
};

export const disabledFlag = {
  disabled: Flags.boolean({ summary: messages.getMessage('flags.disabled.summary'), default: false }),
};
