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
import { Flags } from '@salesforce/sf-plugins-core';
import { listVcsProviderKinds, type VcsProviderKind } from '../vcs/index.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-cicd', 'simply.cicd.deploy');

/**
 * Flags shared by every deploy command that targets a Salesforce org. `simply-cicd` never
 * authenticates orgs itself — the alias must already be authenticated (by the calling pipeline,
 * however it chooses to do that) before the command runs.
 */
export const orgAuthFlags = {
  alias: Flags.string({
    summary: messages.getMessage('flags.alias.summary'),
    required: true,
    env: 'SIMPLY_CICD_ALIAS',
  }),
};

export const debugFlag = {
  debug: Flags.boolean({
    summary: messages.getMessage('flags.debug.summary'),
    default: false,
    env: 'SIMPLY_CICD_DEBUG',
  }),
};

/** Flags shared by every deploy command that clones, tags, or pushes to a source-control remote. */
export const vcsFlags = {
  'vcs-host': Flags.string({
    summary: messages.getMessage('flags.vcs-host.summary'),
    env: 'SIMPLY_CICD_VCS_HOST',
  }),
  'vcs-provider': Flags.custom<VcsProviderKind>({ options: listVcsProviderKinds() })({
    summary: messages.getMessage('flags.vcs-provider.summary'),
    default: 'gitlab',
    env: 'SIMPLY_CICD_VCS_PROVIDER',
  }),
};

export const testFlags = {
  'test-level': Flags.string({
    summary: messages.getMessage('flags.test-level.summary'),
    default: 'RunLocalTests',
    env: 'SIMPLY_CICD_TEST_LEVEL',
  }),
  'test-suite': Flags.string({
    summary: messages.getMessage('flags.test-suite.summary'),
    env: 'SIMPLY_CICD_TEST_SUITE',
  }),
  tests: Flags.string({ summary: messages.getMessage('flags.tests.summary'), env: 'SIMPLY_CICD_TESTS' }),
};

export const startFromFlag = {
  'start-from': Flags.string({ summary: messages.getMessage('flags.start-from.summary') }),
};

export const deployProgressFileFlag = {
  'deploy-progress-file': Flags.string({
    summary: messages.getMessage('flags.deploy-progress-file.summary'),
    default: 'DEPLOY_PROGRESS.json',
    env: 'SIMPLY_CICD_DEPLOY_PROGRESS_FILE',
  }),
};

export const deployRulesFileFlag = {
  'deploy-rules-file': Flags.string({
    summary: messages.getMessage('flags.deploy-rules-file.summary'),
    default: 'config/deploy-rules.json',
    env: 'SIMPLY_CICD_DEPLOY_RULES_FILE',
  }),
};

export const ciJobTokenFlag = {
  'ci-job-token': Flags.string({
    summary: messages.getMessage('flags.ci-job-token.summary'),
    required: true,
    env: 'SIMPLY_CICD_CI_JOB_TOKEN',
  }),
};
