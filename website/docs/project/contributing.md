# Contributing

import {GuideFlow} from '@site/src/components/GuideVisuals';

Sketchblock welcomes focused bug reports, documentation improvements, and contributions that make visual collaboration easier to understand, operate, and maintain.

<GuideFlow
  label="From an observation to a contribution"
  steps={[
    {title: 'Describe', description: 'Explain the concrete problem, expected behavior, and a reproducible example.'},
    {title: 'Scope', description: 'Open or reference an issue and agree on one product or technical concern.'},
    {title: 'Implement', description: 'Preserve architecture boundaries and document changed behavior.'},
    {title: 'Validate', description: 'Include relevant package checks and browser evidence in the pull request.'},
  ]}
/>

## Choose the right route

| Contribution | Useful starting information |
| --- | --- |
| Bug report | Version, deployment mode, browser, affected role, reproduction steps, expected result, and actual result. |
| Documentation correction | Page URL, unclear or incorrect passage, and the behavior it should explain. |
| Feature proposal | User problem, concrete use case, and expected outcome; check the roadmap first. |
| Code change | A linked issue, a focused patch, regression coverage, and affected documentation. |
| Suspected vulnerability | Use the private reporting route in [Security](./security.md). |

Start with [GitHub issues](https://github.com/mimeonline/sketchblock/issues). Use synthetic boards and redact logs and screenshots. Keep tokens, invite URLs, private repository content, and personal data out of public reports.

## Before opening a pull request

1. Read the repository's applicable `AGENTS.md` guidance and the [architecture overview](./architecture.md).
2. Keep the patch focused and explain the resulting behavior with a concrete example.
3. Update tests for changed behavior and public documentation for changed user or operator workflows.
4. Run the affected checks from [Development](./development.md#verify-the-affected-packages).
5. For collaboration changes, include the two-profile acceptance result or explicitly identify the remaining verification gap.

UI changes should retain keyboard access, visible focus, mobile layouts, and reduced-motion behavior. Include screenshots using synthetic data when they help review the change.

## Planning, releases, and license

The [Roadmap](https://github.com/mimeonline/sketchblock/blob/main/ROADMAP.md) is the public planning source. The [Changelog](https://github.com/mimeonline/sketchblock/blob/main/CHANGELOG.md) records shipped changes. Release maintainers use [RELEASING.md](https://github.com/mimeonline/sketchblock/blob/main/RELEASING.md).

By submitting a contribution, you agree that it is licensed under the Apache License 2.0 that covers this repository. The repository's [CONTRIBUTING.md](https://github.com/mimeonline/sketchblock/blob/main/CONTRIBUTING.md) remains the contribution policy.
