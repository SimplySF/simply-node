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

import { create } from 'xmlbuilder2';
import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces.js';

/** What `patchCustomSiteXml` should write into `sites/<Site>.site-meta.xml`. */
export type PatchCustomSiteXmlOptions = {
  domain: string;
  primary: boolean;
  pathPrefix?: string;
};

export type PatchCustomSiteXmlResult = {
  xml: string;
  /** The `domainName` values of every `customWebAddresses` entry the replace-all discarded. */
  previousDomains: string[];
};

/**
 * Find the direct child elements of `root` with the given tag name.
 *
 * `filter`'s second argument (`self`) excludes `root` itself from consideration, and the third
 * (`recursive`) is left `false` so a same-named descendant nested under an unrelated element
 * (there are none today, but the metadata schema isn't ours to fix) can't be matched by mistake.
 */
function childrenNamed(root: XMLBuilder, tagName: string): XMLBuilder[] {
  return root.filter((node) => node.node.nodeName === tagName, false, false);
}

/**
 * Patch a `CustomSite` metadata document: replace every `customWebAddresses` entry with exactly
 * one, and optionally set `urlPathPrefix`.
 *
 * Per the CustomSite metadata reference, saving or deploying a CustomSite replaces all root
 * custom URLs with the list being written — so this replaces rather than appends, matching what
 * the deploy is going to do regardless.
 *
 * @param xml - The current contents of the `sites/<Site>.site-meta.xml` file.
 * @param options - The domain (and whether it's primary) to write, and an optional path prefix.
 * @returns The rewritten document, plus the domains the replace-all discarded.
 * @throws {Error} If `xml` isn't parseable.
 */
export function patchCustomSiteXml(xml: string, options: PatchCustomSiteXmlOptions): PatchCustomSiteXmlResult {
  const doc = create(xml);
  const root = doc.root();

  const previousDomains: string[] = [];
  for (const node of childrenNamed(root, 'customWebAddresses')) {
    const domainNameNode = childrenNamed(node, 'domainName')[0];
    if (domainNameNode?.node.textContent) {
      previousDomains.push(domainNameNode.node.textContent);
    }
    node.remove();
  }

  root
    .ele('customWebAddresses')
    .ele('domainName')
    .txt(options.domain)
    .up()
    .ele('primary')
    .txt(String(options.primary))
    .up()
    .up();

  if (options.pathPrefix !== undefined) {
    setUrlPathPrefix(root, options.pathPrefix);
  }

  return { xml: doc.end({ prettyPrint: true }), previousDomains };
}

/**
 * Patch a `Network` metadata document's `urlPathPrefix`.
 *
 * @param xml - The current contents of the `networks/<Network>.network-meta.xml` file.
 * @param pathPrefix - The URL path prefix to write.
 * @returns The rewritten document.
 * @throws {Error} If `xml` isn't parseable.
 */
export function patchNetworkXml(xml: string, pathPrefix: string): string {
  const doc = create(xml);
  const root = doc.root();

  setUrlPathPrefix(root, pathPrefix);

  return doc.end({ prettyPrint: true });
}

/**
 * Read a `Network` metadata document's `<site>` element — the CustomSite API name it belongs to.
 *
 * @param xml - The contents of a `networks/*.network-meta.xml` file.
 * @returns The `<site>` value, or `undefined` if the element is absent.
 * @throws {Error} If `xml` isn't parseable.
 */
export function readNetworkSiteName(xml: string): string | undefined {
  const root = create(xml).root();

  return childrenNamed(root, 'site')[0]?.node.textContent ?? undefined;
}

/** Set `urlPathPrefix`'s text, creating the element (appended as the last child) if absent. */
function setUrlPathPrefix(root: XMLBuilder, pathPrefix: string): void {
  const existing = childrenNamed(root, 'urlPathPrefix')[0];

  if (existing) {
    existing.node.textContent = pathPrefix;
  } else {
    root.ele('urlPathPrefix').txt(pathPrefix).up();
  }
}
