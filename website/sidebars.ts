import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

export default {
  docs: [
    {type: 'category', label: 'Getting started', collapsed: false, items: ['getting-started/quickstart', 'getting-started/github']},
    {type: 'category', label: 'Guides', items: ['guides/repositories', 'guides/boards', 'guides/collaboration', 'guides/users']},
    {type: 'category', label: 'Operations', items: ['operations/configuration', 'operations/backup', 'operations/update', 'operations/troubleshooting']},
    {type: 'category', label: 'Project', items: ['project/about', 'project/architecture', 'project/development', 'project/security', 'project/contributing']},
  ],
} satisfies SidebarsConfig;
