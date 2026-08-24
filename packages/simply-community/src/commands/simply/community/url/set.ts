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

import fs from 'node:fs/promises';
import path from 'node:path';
import { Duration } from '@salesforce/kit';
import { Messages, type Connection } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { escapeSoqlLiteral } from '@simplysf/simply-core';
import { requireConnection } from '@simplysf/simply-plugin-kit';
import { patchCustomSiteXml, patchNetworkXml } from '../../../../common/siteMetadataXml.js';
import { resolveNetworkFile, resolveSearchRoots, resolveSiteFile } from '../../../../common/resolveSiteFiles.js';
import { verifyDomain, type DomainCheckResult } from '../../../../common/verifyDomain.js';
import { deployChangedFiles } from '../../../../common/deployChangedFiles.js';
import { publishCommunity } from '../../../../common/publishCommunity.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-community', 'simply.community.url.set');

/** The fields this needs from the `Network` record matching a network file's basename. */
type NetworkRecord = { Id: string; Name: string };

export type CommunityUrlSetResult = {
  site: string;
  domain: string;
  primary: boolean;
  pathPrefix?: string;
  siteFile: string;
  networkFile?: string;
  previousDomains: string[];
  /** Absent when no --target-org was available to query. */
  domainCheck?: {
    status: string;
    domainId?: string;
    boundToSiteIds: string[];
    ignored: boolean;
  };
  /** Absent when --deploy was not passed. */
  deploy?: {
    id: string;
    status: string;
    componentsDeployed: string[];
    restored: boolean;
  };
  /** Absent unless --publish was passed and the deploy succeeded. */
  publish?: {
    networkName: string;
    jobId: string;
    url: string;
  };
};

/**
 * Sets an Experience Cloud site's custom domain by patching `sites/<Site>.site-meta.xml` (and,
 * when a path prefix is given, `networks/<Network>.network-meta.xml`) in place.
 *
 * By default this only patches the working tree; the caller's own deploy step runs separately.
 * With `--deploy`, it also deploys just the files it changed and restores their original
 * contents afterwards, so the working tree is left exactly as it found it.
 */
export default class CommunityUrlSet extends SfCommand<CommunityUrlSetResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    ...SfCommand.baseFlags,
    site: Flags.string({ char: 's', summary: messages.getMessage('flags.site.summary'), required: true }),
    domain: Flags.string({ char: 'd', summary: messages.getMessage('flags.domain.summary'), required: true }),
    'path-prefix': Flags.string({ char: 'p', summary: messages.getMessage('flags.path-prefix.summary') }),
    primary: Flags.boolean({
      summary: messages.getMessage('flags.primary.summary'),
      default: true,
      allowNo: true,
    }),
    directory: Flags.directory({ summary: messages.getMessage('flags.directory.summary'), exists: true }),
    deploy: Flags.boolean({
      summary: messages.getMessage('flags.deploy.summary'),
      default: false,
    }),
    publish: Flags.boolean({
      summary: messages.getMessage('flags.publish.summary'),
      default: false,
    }),
    'target-org': Flags.optionalOrg(),
    'api-version': Flags.orgApiVersion(),
    wait: Flags.string({ summary: messages.getMessage('flags.wait.summary'), char: 'w', default: '33' }),
    'ignore-missing-domain': Flags.boolean({
      summary: messages.getMessage('flags.ignore-missing-domain.summary'),
      default: false,
    }),
  };

  // eslint-disable-next-line complexity
  public async run(): Promise<CommunityUrlSetResult> {
    const { flags } = await this.parse(CommunityUrlSet);

    if (flags.deploy && !flags['target-org']) {
      throw messages.createError('error.deployRequiresTargetOrg');
    }
    if (flags.publish && !flags.deploy) {
      throw messages.createError('error.publishRequiresDeploy');
    }

    const roots = await resolveSearchRoots(flags.directory);
    const siteFile = await resolveSiteFile(flags.site, roots);

    const wantsNetworkFile = flags['path-prefix'] !== undefined || flags.publish;
    const networkFile = wantsNetworkFile ? await resolveNetworkFile(flags.site, roots) : undefined;

    const org = flags['target-org'];
    const connection = org?.getConnection(flags['api-version']);

    const domainCheck = await this.runDomainPreflight(connection, networkFile, flags);

    // --- Patch (computed before any write, so a parse failure never leaves a half-applied patch) ---
    const originalSiteXml = await fs.readFile(siteFile, 'utf-8');
    const originalNetworkXml = networkFile ? await fs.readFile(networkFile, 'utf-8') : undefined;

    let patchedSiteXml: string;
    let previousDomains: string[];
    try {
      ({ xml: patchedSiteXml, previousDomains } = patchCustomSiteXml(originalSiteXml, {
        domain: flags.domain,
        primary: flags.primary,
        pathPrefix: flags['path-prefix'],
      }));
    } catch (err) {
      throw messages.createError('error.invalidSiteXml', [siteFile, (err as Error).message]);
    }

    const patchesNetworkFile = networkFile !== undefined && flags['path-prefix'] !== undefined;
    let patchedNetworkXml: string | undefined;
    if (patchesNetworkFile) {
      try {
        patchedNetworkXml = patchNetworkXml(originalNetworkXml as string, flags['path-prefix'] as string);
      } catch (err) {
        throw messages.createError('error.invalidNetworkXml', [networkFile, (err as Error).message]);
      }
    }

    await fs.writeFile(siteFile, patchedSiteXml, 'utf-8');
    if (patchesNetworkFile) {
      await fs.writeFile(networkFile, patchedNetworkXml as string, 'utf-8');
    }

    this.log(messages.getMessage('info.patched', [siteFile]));

    const result: CommunityUrlSetResult = {
      site: flags.site,
      domain: flags.domain,
      primary: flags.primary,
      pathPrefix: flags['path-prefix'],
      siteFile,
      networkFile,
      previousDomains,
      domainCheck,
    };

    if (!flags.deploy) {
      return result;
    }

    // --- Deploy, then restore unconditionally ---
    const deployConnection = requireConnection(flags);
    const changedFiles = patchesNetworkFile ? [siteFile, networkFile] : [siteFile];

    // Captured rather than thrown directly from the try block, so a restore failure below can
    // report both the deploy outcome and the restore failure instead of one silently replacing
    // the other when both go wrong.
    let deployError: Error | undefined;
    let restored = false;
    try {
      this.spinner.start(messages.getMessage('info.deploying'));
      const deployOutcome = await deployChangedFiles({
        connection: deployConnection,
        filePaths: changedFiles,
        wait: Duration.minutes(Number(flags.wait)),
      });
      this.spinner.stop();

      result.deploy = {
        id: deployOutcome.id,
        status: deployOutcome.status,
        componentsDeployed: deployOutcome.componentsDeployed,
        restored: false,
      };

      if (!deployOutcome.success) {
        const failureSummary = deployOutcome.failures
          .map((failure) => `${failure.fullName} (${failure.type}): ${failure.error}`)
          .join('; ');
        deployError = messages.createError('error.deployFailed', [failureSummary || deployOutcome.status]);
      } else if (flags.publish) {
        result.publish = await this.publishAfterDeploy(deployConnection, networkFile as string);
      }
    } catch (err) {
      this.spinner.stop();
      deployError = err instanceof Error ? err : new Error(String(err));
    } finally {
      try {
        await fs.writeFile(siteFile, originalSiteXml, 'utf-8');
        if (patchesNetworkFile) {
          await fs.writeFile(networkFile, originalNetworkXml as string, 'utf-8');
        }
        restored = true;
      } catch (restoreErr) {
        const modifiedFiles = patchesNetworkFile ? [siteFile, networkFile] : [siteFile];
        const deploySummary = deployError
          ? messages.getMessage('info.deployAlsoFailed', [deployError.message])
          : messages.getMessage('info.deploySucceeded', [result.deploy?.id ?? '']);
        this.error(
          messages.getMessage('error.restoreFailed', [
            modifiedFiles.join(', '),
            (restoreErr as Error).message,
            deploySummary,
          ]),
        );
      }

      if (result.deploy) {
        result.deploy.restored = restored;
      }
    }

    if (deployError) {
      throw deployError;
    }

    return result;
  }

  /**
   * Run the domain preflight when a connection is available, and turn its outcome into either
   * the result's `domainCheck`, a warning, or a fatal error — matching the "Preflight" table in
   * the design doc.
   */
  private async runDomainPreflight(
    connection: Connection | undefined,
    networkFile: string | undefined,
    flags: { domain: string; site: string; 'ignore-missing-domain': boolean },
  ): Promise<CommunityUrlSetResult['domainCheck']> {
    if (!connection) {
      if (flags['ignore-missing-domain']) {
        this.warn(messages.getMessage('warning.ignoreMissingDomainNoOrg'));
      }
      return undefined;
    }

    const check = await verifyDomain(connection, flags.domain);

    if (check.status === 'unavailable') {
      this.warn(messages.getMessage('warning.domainCheckUnavailable', [flags.domain]));
      return { status: check.status, boundToSiteIds: [], ignored: false };
    }

    if (check.status === 'missing') {
      if (!flags['ignore-missing-domain']) {
        throw messages.createError('error.domainNotRegistered', [flags.domain, connection.getUsername() ?? '']);
      }
      this.warn(messages.getMessage('warning.domainMissingIgnored', [flags.domain]));
      return { status: check.status, boundToSiteIds: [], ignored: true };
    }

    await this.warnIfBoundElsewhere(connection, check, networkFile, flags.site);

    return {
      status: check.status,
      domainId: check.domainId,
      boundToSiteIds: check.boundToSiteIds,
      ignored: false,
    };
  }

  /**
   * Warn when the domain is already bound to a site other than the one being configured.
   *
   * Determining "this site" requires resolving `--site`'s Salesforce Id, which is only cheaply
   * available when a network file was already resolved (path-prefix or --publish). Without it,
   * there's no reliable way to tell "already configured, re-run" apart from "bound elsewhere" —
   * and staying quiet on an unprovable case matters more than a possibly-wrong warning on every
   * re-run, so the comparison is skipped rather than guessed at.
   */
  private async warnIfBoundElsewhere(
    connection: Connection,
    check: DomainCheckResult,
    networkFile: string | undefined,
    site: string,
  ): Promise<void> {
    if (check.boundToSiteIds.length === 0 || !networkFile) {
      return;
    }

    const networkName = path.basename(networkFile, '.network-meta.xml');
    const network = await connection.singleRecordQuery<NetworkRecord>(
      `SELECT Id, Name FROM Network WHERE Name = '${escapeSoqlLiteral(networkName)}'`,
    );

    const otherSiteIds = check.boundToSiteIds.filter((id) => id !== network.Id);
    if (otherSiteIds.length > 0) {
      this.warn(messages.getMessage('warning.domainBoundElsewhere', [site, otherSiteIds.join(', ')]));
    }
  }

  private async publishAfterDeploy(
    connection: Connection,
    networkFile: string,
  ): Promise<CommunityUrlSetResult['publish']> {
    const networkName = path.basename(networkFile, '.network-meta.xml');
    const network = await connection.singleRecordQuery<NetworkRecord>(
      `SELECT Id, Name FROM Network WHERE Name = '${escapeSoqlLiteral(networkName)}'`,
    );

    this.spinner.start(messages.getMessage('info.publishing', [network.Name]));
    try {
      const publishResponse = await publishCommunity({ connection, networkId: network.Id, wait: 15 });
      this.spinner.stop();
      return { networkName: network.Name, jobId: publishResponse.jobId, url: publishResponse.url };
    } catch (err) {
      this.spinner.stop();
      throw messages.createError('error.publishFailed', [network.Name, (err as Error).message]);
    }
  }
}
