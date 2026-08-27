#!/usr/bin/env node
// Regenerates command-reference docs pages from each package's oclif-generated
// README.md, so the site never hand-duplicates content that `pnpm run readme`
// already keeps current. Safe to re-run any time; every file it writes is
// fully derived from packages/*/README.md and packages/*/package.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const packagesDir = path.join(repoRoot, 'packages');
const docsDir = path.join(__dirname, '../src/content/docs');

const COMMANDS_START = '<!-- commands -->';
const COMMANDS_STOP = '<!-- commandsstop -->';

/** Pulls the oclif-generated command block out of a package README. */
function extractCommandsBlock(readme) {
  const start = readme.indexOf(COMMANDS_START);
  const stop = readme.indexOf(COMMANDS_STOP);
  if (start === -1 || stop === -1) return null;
  return readme.slice(start + COMMANDS_START.length, stop).trim();
}

/**
 * Splits a commands block into one chunk per `## \`sf ...\`` command,
 * dropping the auto-generated table-of-contents bullet list that precedes
 * the first command header.
 */
function splitCommands(block) {
  const chunks = [];
  let current = null;
  for (const line of block.split('\n')) {
    if (line.startsWith('## `')) {
      if (current) chunks.push(current);
      current = { header: line, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) chunks.push(current);
  return chunks.map((c) => c.lines.join('\n').trim());
}

function frontmatter(title, description) {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n\n`;
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`wrote ${path.relative(repoRoot, filePath)}`);
}

function readPackage(dirName) {
  const dir = path.join(packagesDir, dirName);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
  return { pkg, block: extractCommandsBlock(readme) };
}

// --- simply-cicd: split its command reference by topic ---

const CICD_GROUPS = [
  {
    match: 'sf simply cicd deploy happy-soup ',
    file: 'deploy-happy-soup.md',
    title: 'Deploy — Happy Soup',
    description: 'Command reference for the unpackaged (happy-soup) deploy pipeline stages.',
  },
  {
    match: 'sf simply cicd deploy project ',
    file: 'deploy-project.md',
    title: 'Deploy — Project',
    description: 'Command reference for the 2GP packaged deploy pipeline stages.',
  },
  {
    match: 'sf simply cicd deploy ',
    file: 'deploy.md',
    title: 'Deploy — Validate',
    description: 'Command reference for the generic deploy validate command.',
  },
  {
    match: 'sf simply cicd build ',
    file: 'build.md',
    title: 'Build',
    description: 'Command reference for scratch-org and package build commands.',
  },
  {
    match: 'sf simply cicd notify ',
    file: 'notify.md',
    title: 'Notify',
    description: 'Command reference for pipeline notification commands.',
  },
  {
    match: 'sf simply cicd sfdx-dependabot',
    file: 'sfdx-dependabot.md',
    title: 'sfdx-dependabot',
    description: 'Command reference for the cross-repo dependency-bump command.',
  },
];

function syncCicdReference() {
  const { block } = readPackage('simply-cicd');
  if (!block) throw new Error('Could not find a commands block in packages/simply-cicd/README.md');

  const commands = splitCommands(block);
  const grouped = new Map();

  for (const commandBody of commands) {
    const group = CICD_GROUPS.find((g) => commandBody.includes(`\`${g.match}`));
    if (!group) {
      console.warn(`sync-command-reference: no reference group matched for:\n${commandBody.split('\n')[0]}`);
      continue;
    }
    if (!grouped.has(group.file)) grouped.set(group.file, { group, bodies: [] });
    grouped.get(group.file).bodies.push(commandBody);
  }

  for (const { group, bodies } of grouped.values()) {
    const content = frontmatter(group.title, group.description) + bodies.join('\n\n');
    writeFile(path.join(docsDir, 'cicd/reference', group.file), content);
  }
}

// --- other plugins: one reference page each, full command block ---

const OTHER_PLUGIN_DIRS = [
  'simply',
  'simply-aep',
  'simply-apex',
  'simply-community',
  'simply-data',
  'simply-document',
  'simply-flow',
  'simply-package',
  'simply-permissions',
  'simply-project',
  'simply-schema',
  'simply-sobject',
];

function syncPluginReference(dirName) {
  const { pkg, block } = readPackage(dirName);
  if (!block) {
    console.warn(`sync-command-reference: skipping ${dirName} (no commands block in README — not a CLI plugin?)`);
    return;
  }

  const intro = `${pkg.description}\n\n\`\`\`sh\nsf plugins install ${pkg.name}\n\`\`\`\n\n## Commands\n\n`;
  const content = frontmatter(pkg.name, pkg.description) + intro + splitCommands(block).join('\n\n');
  writeFile(path.join(docsDir, 'plugins', `${dirName}.md`), content);
}

syncCicdReference();
for (const dirName of OTHER_PLUGIN_DIRS) syncPluginReference(dirName);
