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

import type { VcsBranch, VcsCommit, VcsMergeRequest, VcsProject, VcsProjectVariable, VcsProvider } from './types.js';

type GitLabProjectResponse = {
  id: number;
  name: string;
  path_with_namespace: string;
  default_branch?: string;
  archived?: boolean;
  empty_repo?: boolean;
  forked_from_project?: unknown;
};

type GitLabMergeRequestResponse = {
  id: number;
  iid: number;
  title: string;
  description?: string;
  source_branch: string;
  target_branch: string;
  web_url?: string;
};

type GitLabProjectVariableResponse = {
  key: string;
  value: string;
};

function normalizeProject(project: GitLabProjectResponse): VcsProject {
  return {
    id: project.id,
    name: project.name,
    pathWithNamespace: project.path_with_namespace,
    defaultBranch: project.default_branch,
    archived: Boolean(project.archived),
    empty: Boolean(project.empty_repo),
    isFork: Boolean(project.forked_from_project),
    raw: project,
  };
}

function normalizeMergeRequest(mergeRequest: GitLabMergeRequestResponse): VcsMergeRequest {
  return {
    id: mergeRequest.id,
    iid: mergeRequest.iid,
    title: mergeRequest.title,
    description: mergeRequest.description,
    sourceBranch: mergeRequest.source_branch,
    targetBranch: mergeRequest.target_branch,
    webUrl: mergeRequest.web_url,
    raw: mergeRequest,
  };
}

/** A `VcsProvider` implementation for GitLab, backed by the GitLab REST API v4. */
export class GitLabProvider implements VcsProvider {
  private readonly apiUrl: string;
  private readonly token: string;

  public constructor(apiUrl: string, token: string) {
    if (!apiUrl) {
      throw new Error('GitLab API URL is required.');
    }
    if (!token) {
      throw new Error('GitLab access token is required.');
    }
    this.apiUrl = apiUrl.replace(/\/+$/, '');
    this.token = token;
  }

  public async getGroupProjects(groupId: string | number): Promise<VcsProject[]> {
    let projects: GitLabProjectResponse[] = [];
    let page = 1;
    let hasMore = true;
    const encodedGroupId = encodeURIComponent(groupId);

    while (hasMore) {
      const endpoint = `/groups/${encodedGroupId}/projects?include_subgroups=true&per_page=100&page=${page}`;
      // eslint-disable-next-line no-await-in-loop -- pagination is inherently sequential (next page depends on this one's headers)
      const response = await this.request(endpoint);
      // eslint-disable-next-line no-await-in-loop
      const data = (await response.json()) as GitLabProjectResponse[];

      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      projects = projects.concat(data);

      const nextPageHeader = response.headers.get('X-Next-Page');
      if (nextPageHeader) {
        const nextPageNum = Number(nextPageHeader);
        if (nextPageNum && nextPageNum > page) {
          page = nextPageNum;
        } else {
          hasMore = false;
        }
      } else if (data.length < 100) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return projects.map(normalizeProject);
  }

  public async getFileContent(projectId: string | number, filePath: string, ref: string): Promise<string> {
    const encodedFilePath = encodeURIComponent(filePath);
    const endpoint = `/projects/${projectId}/repository/files/${encodedFilePath}/raw?ref=${encodeURIComponent(ref)}`;
    return this.getRawText(endpoint);
  }

  public async branchExists(projectId: string | number, branchName: string): Promise<boolean> {
    const encodedBranch = encodeURIComponent(branchName);
    const endpoint = `/projects/${projectId}/repository/branches/${encodedBranch}`;
    try {
      await this.request(endpoint, { method: 'GET' });
      return true;
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('404')) {
        return false;
      }
      throw err;
    }
  }

  public async createBranch(projectId: string | number, branchName: string, ref: string): Promise<VcsBranch> {
    const endpoint = `/projects/${projectId}/repository/branches`;
    const response = await this.request(endpoint, {
      method: 'POST',
      body: { branch: branchName, ref },
    });
    const raw: unknown = await response.json();
    return { name: branchName, raw };
  }

  public async commitFile(
    projectId: string | number,
    branchName: string,
    commitMessage: string,
    filePath: string,
    content: string,
  ): Promise<VcsCommit> {
    const endpoint = `/projects/${projectId}/repository/commits`;
    /* eslint-disable camelcase -- GitLab API field names */
    const response = await this.request(endpoint, {
      method: 'POST',
      body: {
        branch: branchName,
        commit_message: commitMessage,
        actions: [{ action: 'update', file_path: filePath, content }],
      },
    });
    /* eslint-enable camelcase */
    const raw = (await response.json()) as { id?: string };
    return { id: raw.id, raw };
  }

  public async findOpenMergeRequest(
    projectId: string | number,
    sourceBranch: string,
    targetBranch: string,
  ): Promise<VcsMergeRequest | undefined> {
    const endpoint = `/projects/${projectId}/merge_requests?state=opened&source_branch=${encodeURIComponent(
      sourceBranch,
    )}&target_branch=${encodeURIComponent(targetBranch)}`;
    const mergeRequests = (await this.getJson(endpoint)) as GitLabMergeRequestResponse[];
    return mergeRequests.length > 0 ? normalizeMergeRequest(mergeRequests[0]) : undefined;
  }

  public async createMergeRequest(
    projectId: string | number,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description: string,
    labels?: string,
  ): Promise<VcsMergeRequest> {
    const endpoint = `/projects/${projectId}/merge_requests`;
    /* eslint-disable camelcase -- GitLab API field names */
    const body: Record<string, unknown> = {
      source_branch: sourceBranch,
      target_branch: targetBranch,
      title,
      description,
      remove_source_branch: true,
    };
    /* eslint-enable camelcase */
    if (labels) {
      body.labels = labels;
    }
    const response = await this.request(endpoint, { method: 'POST', body });
    return normalizeMergeRequest((await response.json()) as GitLabMergeRequestResponse);
  }

  public async updateMergeRequest(
    projectId: string | number,
    mergeRequestId: number,
    title: string,
    description: string,
    labels?: string,
  ): Promise<VcsMergeRequest> {
    const endpoint = `/projects/${projectId}/merge_requests/${mergeRequestId}`;
    const body: Record<string, unknown> = { title, description };
    if (labels) {
      body.labels = labels;
    }
    const response = await this.request(endpoint, { method: 'PUT', body });
    return normalizeMergeRequest((await response.json()) as GitLabMergeRequestResponse);
  }

  public async getProjectVariables(projectId: string | number): Promise<VcsProjectVariable[]> {
    try {
      const variables = (await this.getJson(`/projects/${projectId}/variables`)) as GitLabProjectVariableResponse[];
      return variables.map((variable) => ({ key: variable.key, value: variable.value, raw: variable }));
    } catch {
      // If we don't have permission to read variables, treat it as "no variables".
      return [];
    }
  }

  // eslint-disable-next-line class-methods-use-this -- part of the VcsProvider instance contract; GitLab's URL scheme needs no instance state
  public buildAuthenticatedRemoteUrl(host: string, token: string, projectPath: string): string {
    return `https://oauth2:${token}@${host}/${projectPath}.git`;
  }

  // eslint-disable-next-line class-methods-use-this -- part of the VcsProvider instance contract; GitLab's URL scheme needs no instance state
  public buildCiCloneUrl(host: string, ciJobToken: string, projectPath: string): string {
    return `https://gitlab-ci-token:${ciJobToken}@${host}/${projectPath}.git`;
  }

  private async request(
    endpoint: string,
    options: { body?: unknown; headers?: Record<string, string>; method?: string } = {},
  ): Promise<Response> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'PRIVATE-TOKEN': this.token,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`GitLab API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response;
  }

  private async getJson(endpoint: string): Promise<unknown> {
    const response = await this.request(endpoint);
    return response.json();
  }

  private async getRawText(endpoint: string): Promise<string> {
    const response = await this.request(endpoint);
    return response.text();
  }
}
