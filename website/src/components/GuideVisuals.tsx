import type {CSSProperties, ReactNode} from 'react';

import styles from './GuideVisuals.module.css';

type GuideStep = {
  title: string;
  description: string;
};

type GuideFlowProps = {
  label: string;
  steps: GuideStep[];
  caption?: string;
};

/** A reading-order diagram for a documented workflow or lifecycle. */
export function GuideFlow({label, steps, caption}: GuideFlowProps): ReactNode {
  return (
    <figure className={styles.flow} aria-label={label}>
      <p className={styles.label}>{label}</p>
      <ol className={styles.steps} style={{'--step-count': steps.length} as CSSProperties}>
        {steps.map((step, index) => (
          <li className={styles.step} key={step.title}>
            <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div className={styles.content}>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </div>
            {index < steps.length - 1 && <span className={styles.arrow} aria-hidden="true">→</span>}
          </li>
        ))}
      </ol>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}
