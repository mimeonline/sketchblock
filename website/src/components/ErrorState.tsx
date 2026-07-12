import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import styles from './ErrorState.module.css';

type ErrorAction = {
  label: string;
  to?: string;
  reload?: boolean;
};

type ErrorStateProps = {
  code: '404' | '500';
  eyebrow: string;
  title: string;
  description: string;
  primary: ErrorAction;
  secondary: ErrorAction;
  issueLink?: boolean;
  onRetry?: () => void;
  embedded?: boolean;
};

function Action({action, primary, onRetry}: {action: ErrorAction; primary?: boolean; onRetry?: () => void}): ReactNode {
  const className = primary ? 'button button--primary button--lg' : 'button button--secondary button--lg';

  if (action.reload || onRetry) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => {
          if (onRetry) {
            onRetry();
          } else {
            window.location.reload();
          }
        }}
      >
        {action.label}
      </button>
    );
  }

  return <Link className={className} to={action.to ?? '/'}>{action.label}</Link>;
}

function BrokenFlow({code}: {code: ErrorStateProps['code']}): ReactNode {
  return (
    <div className={styles.board} aria-hidden="true">
      <div className={styles.toolbar}><i/><i/><i/><i/></div>
      <div className={`${styles.node} ${styles.nodeStart}`}>Known path</div>
      <div className={styles.flowLine}><span>{code}</span></div>
      <div className={`${styles.node} ${styles.nodeEnd}`}>{code === '404' ? 'Missing board' : 'Interrupted flow'}</div>
      <div className={styles.presence}><b>MM</b><span>ready to reconnect</span></div>
    </div>
  );
}

export default function ErrorState({
  code,
  eyebrow,
  title,
  description,
  primary,
  secondary,
  issueLink = false,
  onRetry,
  embedded = false,
}: ErrorStateProps): ReactNode {
  const content = (
    <main className={styles.page}>
      <div className={`container ${styles.grid}`}>
        <section className={styles.copy}>
          <div className={styles.eyebrow}>{eyebrow}</div>
          <p className={styles.code}>{code}</p>
          <h1>{title}</h1>
          <p className={styles.description}>{description}</p>
          <div className={styles.actions}>
            <Action action={primary} primary onRetry={onRetry} />
            <Action action={secondary} />
          </div>
          {issueLink ? (
            <p className={styles.support}>
              Still blocked? <Link href="https://github.com/mimeonline/sketchblock/issues/new/choose">Open an issue on GitHub</Link>.
            </p>
          ) : null}
        </section>
        <BrokenFlow code={code} />
      </div>
    </main>
  );

  return embedded
    ? content
    : <Layout title={`${code} · ${title}`} description={description}>{content}</Layout>;
}
