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

import { describe, expect, it } from 'vitest';
import { patchCustomSiteXml, patchNetworkXml, readNetworkSiteName } from '../src/siteMetadataXml.js';

const SITE_XML_NO_ADDRESSES = `<?xml version="1.0" encoding="UTF-8"?>
<CustomSite xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Partner Portal</label>
    <siteTemplate>Partner Portal</siteTemplate>
</CustomSite>
`;

const SITE_XML_ONE_ADDRESS = `<?xml version="1.0" encoding="UTF-8"?>
<CustomSite xmlns="http://soap.sforce.com/2006/04/metadata">
    <customWebAddresses>
        <domainName>old.example.com</domainName>
        <primary>true</primary>
    </customWebAddresses>
    <label>Partner Portal</label>
    <siteTemplate>Partner Portal</siteTemplate>
    <urlPathPrefix>old</urlPathPrefix>
</CustomSite>
`;

const SITE_XML_THREE_ADDRESSES = `<?xml version="1.0" encoding="UTF-8"?>
<CustomSite xmlns="http://soap.sforce.com/2006/04/metadata">
    <customWebAddresses>
        <domainName>one.example.com</domainName>
        <primary>true</primary>
    </customWebAddresses>
    <customWebAddresses>
        <domainName>two.example.com</domainName>
        <primary>false</primary>
    </customWebAddresses>
    <customWebAddresses>
        <domainName>three.example.com</domainName>
        <primary>false</primary>
    </customWebAddresses>
    <label>Partner Portal</label>
</CustomSite>
`;

const NETWORK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Network xmlns="http://soap.sforce.com/2006/04/metadata">
    <site>Partner_Portal</site>
    <status>Live</status>
</Network>
`;

describe('patchCustomSiteXml', () => {
  it('adds a single customWebAddresses entry when none existed', () => {
    const { xml, previousDomains } = patchCustomSiteXml(SITE_XML_NO_ADDRESSES, {
      domain: 'partners.acme.com',
      primary: true,
    });

    expect(previousDomains).to.deep.equal([]);
    expect(xml).to.include('<domainName>partners.acme.com</domainName>');
    expect(xml).to.include('<primary>true</primary>');
    expect((xml.match(/<customWebAddresses>/g) ?? []).length).to.equal(1);
  });

  it('replaces a single existing customWebAddresses entry and reports it as discarded', () => {
    const { xml, previousDomains } = patchCustomSiteXml(SITE_XML_ONE_ADDRESS, {
      domain: 'partners.acme.com',
      primary: false,
    });

    expect(previousDomains).to.deep.equal(['old.example.com']);
    expect(xml).to.include('<domainName>partners.acme.com</domainName>');
    expect(xml).to.include('<primary>false</primary>');
    expect(xml).not.to.include('old.example.com');
    expect((xml.match(/<customWebAddresses>/g) ?? []).length).to.equal(1);
  });

  it('replaces three existing customWebAddresses entries with exactly one', () => {
    const { xml, previousDomains } = patchCustomSiteXml(SITE_XML_THREE_ADDRESSES, {
      domain: 'partners.acme.com',
      primary: true,
    });

    expect(previousDomains).to.deep.equal(['one.example.com', 'two.example.com', 'three.example.com']);
    expect((xml.match(/<customWebAddresses>/g) ?? []).length).to.equal(1);
    expect(xml).to.include('<domainName>partners.acme.com</domainName>');
  });

  it('does not touch urlPathPrefix when no path prefix is given', () => {
    const { xml } = patchCustomSiteXml(SITE_XML_ONE_ADDRESS, { domain: 'partners.acme.com', primary: true });

    expect(xml).to.include('<urlPathPrefix>old</urlPathPrefix>');
  });

  it('sets urlPathPrefix when a path prefix is given', () => {
    const { xml } = patchCustomSiteXml(SITE_XML_ONE_ADDRESS, {
      domain: 'partners.acme.com',
      primary: true,
      pathPrefix: 'partners',
    });

    expect(xml).to.include('<urlPathPrefix>partners</urlPathPrefix>');
    expect(xml).not.to.include('<urlPathPrefix>old</urlPathPrefix>');
  });

  it('creates urlPathPrefix when the element did not previously exist', () => {
    const { xml } = patchCustomSiteXml(SITE_XML_NO_ADDRESSES, {
      domain: 'partners.acme.com',
      primary: true,
      pathPrefix: 'partners',
    });

    expect(xml).to.include('<urlPathPrefix>partners</urlPathPrefix>');
  });

  it('escapes a domain containing XML-significant characters', () => {
    const { xml } = patchCustomSiteXml(SITE_XML_NO_ADDRESSES, {
      domain: 'partners.acme.com&test',
      primary: true,
    });

    expect(xml).to.include('&amp;test');
    expect(xml).not.to.include('.com&test<');
  });

  it('is a byte-identical no-op when run twice with the same options', () => {
    const first = patchCustomSiteXml(SITE_XML_ONE_ADDRESS, {
      domain: 'partners.acme.com',
      primary: true,
      pathPrefix: 'partners',
    });
    const second = patchCustomSiteXml(first.xml, {
      domain: 'partners.acme.com',
      primary: true,
      pathPrefix: 'partners',
    });

    expect(second.xml).to.equal(first.xml);
    expect(second.previousDomains).to.deep.equal(['partners.acme.com']);
  });

  it('throws for content that is not XML', () => {
    expect(() => patchCustomSiteXml('this is not xml', { domain: 'x.com', primary: true })).to.throw();
  });
});

describe('patchNetworkXml', () => {
  it('sets urlPathPrefix when the element did not previously exist', () => {
    const xml = patchNetworkXml(NETWORK_XML, 'partners');

    expect(xml).to.include('<urlPathPrefix>partners</urlPathPrefix>');
    expect(xml).to.include('<site>Partner_Portal</site>');
  });

  it('overwrites an existing urlPathPrefix', () => {
    const withPrefix = patchNetworkXml(NETWORK_XML, 'partners');
    const updated = patchNetworkXml(withPrefix, 'newprefix');

    expect(updated).to.include('<urlPathPrefix>newprefix</urlPathPrefix>');
    expect(updated).not.to.include('partners</urlPathPrefix>');
  });

  it('throws for content that is not XML', () => {
    expect(() => patchNetworkXml('this is not xml', 'partners')).to.throw();
  });
});

describe('readNetworkSiteName', () => {
  it('reads the <site> element', () => {
    expect(readNetworkSiteName(NETWORK_XML)).to.equal('Partner_Portal');
  });

  it('returns undefined when <site> is absent', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Network xmlns="http://soap.sforce.com/2006/04/metadata">
    <status>Live</status>
</Network>
`;
    expect(readNetworkSiteName(xml)).to.be.undefined;
  });
});
