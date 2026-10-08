import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import type {ReactNode} from 'react';

import styles from './GettingStartedVisuals.module.css';

type ScreenshotFigureProps = {
  src: string;
  alt: string;
  caption: ReactNode;
  className?: string;
};

export function ScreenshotFigure({src, alt, caption, className}: ScreenshotFigureProps): ReactNode {
  const imageUrl = useBaseUrl(src);
  const [width, height] = src.endsWith("invitations.png") ? [512, 646]
    : src.endsWith("repositories.png") ? [1160, 320] : [1440, 1000];

  return (
    <figure className={[styles.figure, className].filter(Boolean).join(' ')}>
      <a className={styles.figureLink} href={imageUrl} target="_blank" rel="noreferrer">
        <img className={styles.screenshot} src={imageUrl} alt={alt} width={width} height={height} loading="lazy" />
      </a>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

type StarterCard = {
  title: string;
  description: string;
  to: string;
  action: string;
};

export function StarterCards(): ReactNode {
  const cards: StarterCard[] = [
    {
      title: 'Demo workspace',
      description: 'Start locally with the shared demo identity and no GitHub credentials.',
      to: '/docs/getting-started/quickstart',
      action: 'Run the quickstart',
    },
    {
      title: 'Instance workspace',
      description: 'Use local accounts for private boards, versions, and invited collaboration.',
      to: '/docs/guides/instance-workspace',
      action: 'Explore local workspaces',
    },
    {
      title: 'GitHub repositories',
      description: 'Connect an OAuth App when the owner needs repository-backed boards and saves.',
      to: '/docs/getting-started/github',
      action: 'Configure GitHub',
    },
  ];

  return (
    <section className={styles.cards} aria-labelledby="getting-started-paths">
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>Choose a starting point</p>
        <h2 id="getting-started-paths">Three ways into the workflow</h2>
      </div>
      <div className={styles.cardGrid}>
        {cards.map((card) => (
          <article className={styles.card} key={card.title}>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <Link className={styles.cardLink} to={card.to}>
              {card.action} <span aria-hidden="true">→</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

type ProcessStep = {
  number: string;
  title: string;
  description: string;
};

export function WorkflowRail(): ReactNode {
  const steps: ProcessStep[] = [
    {number: '01', title: 'GitHub file', description: 'Select the board beside the code and documentation it explains.'},
    {number: '02', title: 'Live canvas', description: 'Invite collaborators and refine the same board in real time.'},
    {number: '03', title: 'Commit', description: 'Save the agreed result back to the repository as a versioned file.'},
  ];

  return (
    <ol className={styles.workflow} aria-label="Sketchblock workflow">
      {steps.map((step, index) => (
        <li className={styles.workflowStep} key={step.number}>
          <div className={styles.workflowIcon} aria-hidden="true">{step.number}</div>
          <div>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </div>
          {index < steps.length - 1 ? <span className={styles.workflowArrow} aria-hidden="true">→</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function GithubConfigExample(): ReactNode {
  return (
    <section className={styles.configExample} aria-labelledby="oauth-example-title">
      <div className={styles.configHeader}>
        <p className={styles.kicker}>Local configuration example</p>
        <h2 id="oauth-example-title">Match the URLs to your instance</h2>
        <p>Set these values in the local runtime before the owner connects GitHub.</p>
      </div>
      <div className={styles.configFields} role="group" aria-label="GitHub OAuth configuration example">
        <div className={styles.configField}><span>Homepage URL</span><code>http://localhost:4512</code></div>
        <div className={styles.configField}><span>Callback URL</span><code>http://localhost:4512/api/auth/github/callback</code></div>
        <div className={styles.configField}><span>Runtime mode</span><code>SKETCHBLOCK_AUTH_MODE=github</code></div>
      </div>
      <p className={styles.configNote}>Keep the client secret in the local <code>.env</code> file. A connected owner can then select repositories; invited participants can use a local account or an existing GitHub sign-in.</p>
    </section>
  );
}
