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

/** The set of source-control-hosting platforms `simply-cicd` knows how to talk to. */
export type VcsProviderKind = 'gitlab';

/** A repository/project, normalized across VCS platforms. */
export type VcsProject = {
  id: number;
  name: string;
  pathWithNamespace: string;
  defaultBranch?: string;
  archived: boolean;
  empty: boolean;
  isFork: boolean;
  /** The raw, platform-specific API response this was derived from. */
  raw: unknown;
};

/** A branch, normalized across VCS platforms. */
export type VcsBranch = {
  name: string;
  raw: unknown;
};

/** The result of a file-content commit, normalized across VCS platforms. */
export type VcsCommit = {
  id?: string;
  raw: unknown;
};

/** A merge/pull request, normalized across VCS platforms. */
export type VcsMergeRequest = {
  id: number;
  iid: number;
  title: string;
  description?: string;
  sourceBranch: string;
  targetBranch: string;
  webUrl?: string;
  raw: unknown;
};

/** A project/repo-level CI variable, normalized across VCS platforms. */
export type VcsProjectVariable = {
  key: string;
  value: string;
  raw: unknown;
};

/**
 * A source-control-hosting platform client, abstracted so that platforms beyond GitLab (e.g.
 * GitHub) can be added later without changing any command that consumes a `VcsProvider`.
 */
export interface VcsProvider {
  /** Lists all projects/repos under a group/org, including subgroups, paginating as needed. */
  getGroupProjects(groupId: string | number): Promise<VcsProject[]>;

  /** Fetches the raw content of a file from a project at a given ref. */
  getFileContent(projectId: string | number, filePath: string, ref: string): Promise<string>;

  /** Returns whether a branch exists in a project. */
  branchExists(projectId: string | number, branchName: string): Promise<boolean>;

  /** Creates a branch from a reference point (usually the project's default branch). */
  createBranch(projectId: string | number, branchName: string, ref: string): Promise<VcsBranch>;

  /** Commits new content for a single file to a branch. */
  commitFile(
    projectId: string | number,
    branchName: string,
    commitMessage: string,
    filePath: string,
    content: string,
  ): Promise<VcsCommit>;

  /** Finds an existing open merge/pull request with the given source and target branch, if any. */
  findOpenMergeRequest(
    projectId: string | number,
    sourceBranch: string,
    targetBranch: string,
  ): Promise<VcsMergeRequest | undefined>;

  /** Creates a new merge/pull request. */
  createMergeRequest(
    projectId: string | number,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description: string,
    labels?: string,
  ): Promise<VcsMergeRequest>;

  /** Updates an existing merge/pull request's title, description, and labels. */
  updateMergeRequest(
    projectId: string | number,
    mergeRequestId: number,
    title: string,
    description: string,
    labels?: string,
  ): Promise<VcsMergeRequest>;

  /** Fetches project/repo-level CI variables. Returns an empty array if unreadable. */
  getProjectVariables(projectId: string | number): Promise<VcsProjectVariable[]>;

  /** Builds a token-authenticated remote URL suitable for push/tag operations (e.g. `git remote add`). */
  buildAuthenticatedRemoteUrl(host: string, token: string, projectPath: string): string;

  /** Builds a CI-job-token-authenticated remote URL suitable for a read-only `git clone`. */
  buildCiCloneUrl(host: string, ciJobToken: string, projectPath: string): string;
}
