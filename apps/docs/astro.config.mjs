// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Two content sources:
//  - apps/docs/src/content/docs/    public-facing pages (this directory)
//  - ../../docs/                    canonical engineering docs reused
//                                    via the `engineering` route group below
//
// Keeping engineering docs at the repo root (where contributors and AI
// agents read them) and surfacing them through the public site is a
// dual-use win: one source of truth, two readerships.

export default defineConfig({
  site: 'https://keynv.dev',
  output: 'static',
  integrations: [
    starlight({
      title: 'keynv',
      description: 'AI-safe secrets management — aliases instead of values; AI agents never see real secrets.',
      logo: { src: './src/assets/wordmark.svg' },
      favicon: '/favicon.svg',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/keynv-org/keynv',
        },
      ],
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      lastUpdated: true,
      editLink: {
        baseUrl: 'https://github.com/keynv-org/keynv/edit/main/apps/docs/',
      },
      customCss: ['./src/styles/theme.css'],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'What is keynv?', slug: 'index' },
            { label: 'Getting started', slug: 'getting-started' },
            { label: 'CLI quick reference', slug: 'cli-quick-reference' },
          ],
        },
        {
          label: 'Agent integrations',
          items: [
            { label: 'Overview', slug: 'integrations/overview' },
            { label: 'Claude Code', slug: 'integrations/claude-code' },
            { label: 'Cursor', slug: 'integrations/cursor' },
            { label: 'OpenCode', slug: 'integrations/opencode' },
            { label: 'Codex CLI', slug: 'integrations/codex' },
            { label: 'Aider', slug: 'integrations/aider' },
          ],
        },
        {
          label: 'Self-host',
          items: [
            { label: 'Docker Compose', slug: 'deploy/docker-compose' },
            { label: 'Kubernetes (Helm)', slug: 'deploy/kubernetes' },
            { label: 'Behind a TLS proxy', slug: 'deploy/tls-proxy' },
            { label: 'Disaster recovery', slug: 'deploy/disaster-recovery' },
          ],
        },
        {
          label: 'Architecture',
          items: [
            { label: 'Vision & scope', slug: 'engineering/00-vision-and-scope' },
            { label: 'Architecture', slug: 'engineering/01-architecture' },
            { label: 'Threat model', slug: 'engineering/02-threat-model' },
            { label: 'Reference syntax', slug: 'engineering/03-reference-syntax' },
            { label: 'RBAC', slug: 'engineering/04-rbac-and-permissions' },
            { label: 'Encryption', slug: 'engineering/05-encryption-design' },
            { label: 'API spec', slug: 'engineering/06-api-spec' },
          ],
        },
        {
          label: 'Project',
          items: [
            { label: 'Roadmap (phases)', slug: 'project/roadmap' },
            { label: 'Contributing', slug: 'project/contributing' },
            { label: 'Security policy', slug: 'project/security' },
            { label: 'License', slug: 'project/license' },
          ],
        },
      ],
    }),
  ],
});
