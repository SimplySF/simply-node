import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { createStarlightTypeDocPlugin } from 'starlight-typedoc';
import { remarkBaseLinks } from './plugins/remark-base-links.mjs';

const base = '/simply-node';

// One instance per package: each needs its own sidebar-group placeholder (from
// createStarlightTypeDocPlugin) so their generated entries don't collide, and its own
// non-overlapping `output` directory under src/content/docs/api/.
const [simplyCore, simplyCoreSidebar] = createStarlightTypeDocPlugin();
const [simplyAepCore, simplyAepCoreSidebar] = createStarlightTypeDocPlugin();
const [simplyApexCore, simplyApexCoreSidebar] = createStarlightTypeDocPlugin();
const [simplyDocumentCore, simplyDocumentCoreSidebar] = createStarlightTypeDocPlugin();
const [simplyReport, simplyReportSidebar] = createStarlightTypeDocPlugin();
const [simplyDataCore, simplyDataCoreSidebar] = createStarlightTypeDocPlugin();
const [simplyPackageCore, simplyPackageCoreSidebar] = createStarlightTypeDocPlugin();
const [simplySchemaCore, simplySchemaCoreSidebar] = createStarlightTypeDocPlugin();

function typeDocOptions(pkg) {
  return {
    entryPoints: [`../packages/${pkg}/src/index.ts`],
    tsconfig: `../packages/${pkg}/tsconfig.json`,
    output: `api/${pkg}`,
    sidebar: { label: pkg },
    typeDoc: {
      // Every export in `src/index.ts` is the package's public API (see each package's own
      // comment above its exports) - group them by source file so the sidebar/page structure
      // mirrors the source layout instead of one flat alphabetical list.
      groupOrder: ['Functions', 'Classes', 'Type Aliases', '*'],
      excludePrivate: true,
      excludeInternal: true,
      readme: 'none',
    },
  };
}

export default defineConfig({
  site: 'https://simplysf.github.io',
  base,
  markdown: {
    remarkPlugins: [remarkBaseLinks(base)],
  },
  integrations: [
    starlight({
      title: 'Simply Node',
      description:
        'Framework-independent Node/TypeScript libraries for working with Salesforce, built by SimplySF: querying and bulk data, AT4DX binding scan/resolution, Apex execute/log/trace tooling, technical design document rendering, and shared HTML report scaffolding.',
      logo: {
        light: './src/assets/logo-icon.png',
        dark: './src/assets/logo-icon-dark.png',
        alt: 'Simply SF logo',
      },
      favicon: '/favicon.png',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/SimplySF/simply-node' }],
      editLink: {
        baseUrl: 'https://github.com/SimplySF/simply-node/edit/main/site/',
      },
      plugins: [
        simplyCore(typeDocOptions('simply-core')),
        simplyAepCore(typeDocOptions('simply-aep-core')),
        simplyApexCore(typeDocOptions('simply-apex-core')),
        simplyDocumentCore(typeDocOptions('simply-document-core')),
        simplyReport(typeDocOptions('simply-report')),
        simplyDataCore(typeDocOptions('simply-data-core')),
        simplyPackageCore(typeDocOptions('simply-package-core')),
        simplySchemaCore(typeDocOptions('simply-schema-core')),
      ],
      sidebar: [
        { label: 'Get Started', slug: 'getting-started' },
        {
          label: 'Guides',
          items: [
            { label: 'simply-core', slug: 'guides/simply-core' },
            { label: 'simply-aep-core', slug: 'guides/simply-aep-core' },
            { label: 'simply-apex-core', slug: 'guides/simply-apex-core' },
            { label: 'simply-document-core', slug: 'guides/simply-document-core' },
            { label: 'simply-report', slug: 'guides/simply-report' },
            { label: 'simply-data-core', slug: 'guides/simply-data-core' },
            { label: 'simply-package-core', slug: 'guides/simply-package-core' },
            { label: 'simply-schema-core', slug: 'guides/simply-schema-core' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            simplyCoreSidebar,
            simplyAepCoreSidebar,
            simplyApexCoreSidebar,
            simplyDocumentCoreSidebar,
            simplyReportSidebar,
            simplyDataCoreSidebar,
            simplyPackageCoreSidebar,
            simplySchemaCoreSidebar,
          ],
        },
      ],
    }),
  ],
});
