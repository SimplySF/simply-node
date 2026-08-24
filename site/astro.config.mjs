import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { remarkBaseLinks } from './plugins/remark-base-links.mjs';

// Matches the repo's actual current name/Pages URL (SimplySF/simply-node) —
// GitHub's "simply" -> "simply-node" rename redirect covers git/API access,
// but the Pages hosting URL itself is tied to the current repo name.
const base = '/simply-node';

export default defineConfig({
  site: 'https://simplysf.github.io',
  base,
  markdown: {
    remarkPlugins: [remarkBaseLinks(base)],
  },
  integrations: [
    starlight({
      title: 'Simply',
      description:
        'Salesforce CLI plugins by SimplySF for Apex, communities, data, documentation, packages, permissions, projects, schema, and SObjects — plus simply-cicd for CI/CD pipelines.',
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
      sidebar: [
        { label: 'Get Started', slug: 'getting-started' },
        {
          label: 'Plugins',
          items: [
            { label: 'Overview', slug: 'plugins' },
            { label: 'AEP', slug: 'plugins/simply-aep' },
            { label: 'Apex', slug: 'plugins/simply-apex' },
            { label: 'Community', slug: 'plugins/simply-community' },
            { label: 'Data', slug: 'plugins/simply-data' },
            { label: 'Document', slug: 'plugins/simply-document' },
            { label: 'Package', slug: 'plugins/simply-package' },
            { label: 'Permissions', slug: 'plugins/simply-permissions' },
            { label: 'Project', slug: 'plugins/simply-project' },
            { label: 'Schema', slug: 'plugins/simply-schema' },
            { label: 'SObject', slug: 'plugins/simply-sobject' },
            { label: 'All Commands (simply)', slug: 'plugins/simply' },
          ],
        },
        {
          label: 'simply-cicd',
          collapsed: true,
          items: [
            { label: 'Overview', slug: 'cicd' },
            { label: 'Concepts', items: [{ autogenerate: { directory: 'cicd/concepts' } }] },
            { label: 'Guides', items: [{ autogenerate: { directory: 'cicd/guides' } }] },
            { label: 'Command Reference', items: [{ autogenerate: { directory: 'cicd/reference' } }] },
          ],
        },
      ],
    }),
  ],
});
