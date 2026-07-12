import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const analyticsScripts: Config['scripts'] = process.env.NODE_ENV === 'production'
  ? [{
      src: 'https://stats.meierhoff-systems.de/api/script.js',
      defer: true,
      'data-site-id': 'f0018399a2b7',
    }]
  : [];

const config: Config = {
  title: 'Sketchblock',
  tagline: 'Collaborative whiteboards that stay in Git.',
  favicon: 'img/logo.svg',
  future: {v4: true},
  url: 'https://mimeonline.github.io',
  baseUrl: '/sketchblock/',
  organizationName: 'mimeonline',
  projectName: 'sketchblock',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  scripts: analyticsScripts,
  i18n: {defaultLocale: 'en', locales: ['en']},
  presets: [[
    'classic',
    {
      docs: {
        sidebarPath: './sidebars.ts',
        routeBasePath: 'docs',
        editUrl: 'https://github.com/mimeonline/sketchblock/tree/main/website/',
      },
      blog: false,
      theme: {customCss: './src/css/custom.css'},
      sitemap: {changefreq: 'weekly', priority: 0.7},
    } satisfies Preset.Options,
  ]],
  themeConfig: {
    image: 'img/social-card.svg',
    metadata: [
      {name: 'keywords', content: 'Excalidraw, Git, GitHub, whiteboard, collaboration, self-hosted'},
    ],
    colorMode: {defaultMode: 'light', respectPrefersColorScheme: true},
    navbar: {
      title: 'Sketchblock',
      logo: {alt: 'Sketchblock logo', src: 'img/logo.svg', srcDark: 'img/logo-dark.svg'},
      items: [
        {to: '/docs/getting-started/quickstart', label: 'Docs', position: 'left'},
        {to: '/docs/guides/collaboration', label: 'Guides', position: 'left'},
        {href: 'https://github.com/mimeonline/sketchblock', label: 'GitHub', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {title: 'Start', items: [
          {label: 'Quickstart', to: '/docs/getting-started/quickstart'},
          {label: 'Connect GitHub', to: '/docs/getting-started/github'},
        ]},
        {title: 'Operate', items: [
          {label: 'Configuration', to: '/docs/operations/configuration'},
          {label: 'Backup and restore', to: '/docs/operations/backup'},
        ]},
        {title: 'Project', items: [
          {label: 'About Michael', to: '/docs/project/about'},
          {label: 'Roadmap', href: 'https://github.com/mimeonline/sketchblock/blob/main/ROADMAP.md'},
          {label: 'GitHub', href: 'https://github.com/mimeonline/sketchblock'},
          {label: 'Security', to: '/docs/project/security'},
          {label: 'Imprint', href: 'https://meierhoff-systems.de/legal/impressum'},
          {label: 'Privacy', to: '/docs/project/privacy'},
        ]},
      ],
      copyright: `© ${new Date().getFullYear()} Sketchblock contributors. Self-hosted and built in the open.`,
    },
    prism: {theme: prismThemes.github, darkTheme: prismThemes.dracula},
  } satisfies Preset.ThemeConfig,
};

export default config;
