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

import { execa } from 'execa';
import { logger } from '../logger.js';
import { installFlowDeltaPlugin } from '../sfPlugins.js';

export type RunFlowDeltaOptions = {
  from: string;
  to: string;
  out?: string;
  projectAccessToken?: string;
  ciProjectId?: string;
  ciMergeRequestIid?: string;
  debug?: boolean;
};

/**
 * Core runner for the upstream `flow-delta` / `flow-delta-gitlab` binaries (installed via
 * `installFlowDeltaPlugin`). GitLab-specific by nature of those binaries themselves — not routed
 * through the `VcsProvider` abstraction. Does not catch its own errors; callers decide how to handle them.
 */
export async function runFlowDelta(options: RunFlowDeltaOptions): Promise<void> {
  const {
    from,
    to,
    out = 'flow-delta-out',
    projectAccessToken,
    ciProjectId,
    ciMergeRequestIid,
    debug = false,
  } = options;
  if (!from || !to) {
    throw new Error('Missing "from" or "to" commit SHA. Provide --from/--to arguments.');
  }

  await installFlowDeltaPlugin(debug);
  await execa(
    'flow-delta',
    [
      '--repo',
      '.',
      '--from',
      from,
      '--to',
      to,
      '--path',
      '**/*.flow-meta.xml',
      '--changed-only',
      '--out',
      out,
      '--json',
    ],
    { stdio: 'inherit' },
  );

  // Bracket notation (rather than dot access) for the upstream binary's required env var names, which aren't camelCase.
  const env: Record<string, string> = {};
  if (projectAccessToken) env['FlowDelta_GITLAB_TOKEN'] = projectAccessToken;
  if (ciProjectId) env.CI_PROJECT_ID = ciProjectId;
  if (ciMergeRequestIid) env.CI_MERGE_REQUEST_IID = ciMergeRequestIid;
  const execaOptions = Object.keys(env).length > 0 ? { env } : {};

  await execa('flow-delta-gitlab', ['--in', out, '--token', projectAccessToken] as string[], {
    ...execaOptions,
    stdio: 'inherit',
  });
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error running flow-delta';
}

export type GenerateFlowDiffOptions = RunFlowDeltaOptions & { disabled?: boolean };
export type GenerateFlowDiffResult = { skipped: boolean; success: boolean };

/**
 * Action-handler wrapper around `runFlowDelta`: checks the job-level skip flag, then runs the flow
 * delta and logs (rather than throws) on failure, since a diff-posting step shouldn't fail the build.
 *
 * Fixes a bug from the original: the CLI wired its skip flag as `--disabled`, but this function
 * checked `options.disableFlowDiff` — a property nothing ever set — so `--disabled` was a no-op.
 */
export async function generateFlowDiff(options: GenerateFlowDiffOptions): Promise<GenerateFlowDiffResult> {
  if (options.disabled) {
    logger.info('Flow diff generation is disabled. Skipping.');
    return { skipped: true, success: false };
  }

  logger.info('Generating flow diff using flow-delta...');
  try {
    await runFlowDelta(options);
    logger.success('Flow diff generation completed.');
    return { skipped: false, success: true };
  } catch (error) {
    logger.error('Flow diff generation failed.');
    logger.error(extractErrorMessage(error));
    return { skipped: false, success: false };
  }
}
