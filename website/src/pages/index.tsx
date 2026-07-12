import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import styles from './index.module.css';

const proof = [
  ['Stay in flow', 'Open one focused room, sketch together, and keep the conversation moving.'],
  ['Keep the artifact', 'The result remains an ordinary .excalidraw file in the repository you control.'],
  ['Own the stack', 'Run the complete product on your infrastructure with Docker Compose and Postgres.'],
];

const flow = [
  ['01', 'Start locally', 'One script launches Postgres, migrations, the web app, and collaboration runtime.'],
  ['02', 'Try the demo', 'Edit the included board and open a live session without creating credentials.'],
  ['03', 'Connect GitHub', 'Switch to your repositories when you are ready to work with real project artifacts.'],
];

const useCases = [
  ['Architecture decisions', 'Turn a technical conversation into a versioned artifact that stays beside the code.'],
  ['System maps', 'Explore relationships visually while keeping every reviewed result inspectable in Git.'],
  ['Focused workshops', 'Invite collaborators for the working session and viewers for the shared understanding.'],
];

function HeroVisual(): ReactNode {
  return (
    <div className={styles.heroVisual} aria-label="Git-backed collaborative whiteboard illustration">
      <svg viewBox="0 0 620 520" role="img" aria-labelledby="hero-visual-title">
        <title id="hero-visual-title">A visual artifact moving from a whiteboard into Git and a live collaboration session</title>
        <defs>
          <pattern id="hero-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="#b8c5d6" />
          </pattern>
          <filter id="hero-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#0f172a" floodOpacity=".16" />
          </filter>
        </defs>
        <rect className={styles.heroBoard} x="52" y="45" width="516" height="420" rx="28" fill="#fff" filter="url(#hero-shadow)" />
        <rect x="52" y="45" width="516" height="420" rx="28" fill="url(#hero-grid)" />
        <g className={styles.heroToolbar}>
          <rect x="151" y="69" width="318" height="54" rx="15" fill="#fff" stroke="#d8e0ea" />
          <path d="M181 86l17 11-8 3-3 9-6-23z" fill="#6c5ce7" />
          <rect x="221" y="87" width="18" height="18" rx="3" fill="none" stroke="#334155" strokeWidth="2" />
          <circle cx="274" cy="96" r="9" fill="none" stroke="#334155" strokeWidth="2" />
          <path d="M311 96h25m-7-7 7 7-7 7" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M362 104l17-17 5 5-17 17-8 3z" fill="none" stroke="#334155" strokeWidth="2" strokeLinejoin="round" />
          <text x="412" y="103" fill="#334155" fontSize="20" fontWeight="700">A</text>
        </g>
        <g className={styles.heroDiagram}>
          <rect x="107" y="205" width="145" height="78" rx="14" fill="#ecfdf5" stroke="#0f8b6d" strokeWidth="3" />
          <text x="179" y="238" textAnchor="middle" fill="#0f4d40" fontSize="16" fontWeight="700">Shared idea</text>
          <text x="179" y="261" textAnchor="middle" fill="#47645e" fontSize="12">architecture.excalidraw</text>
          <path d="M254 244c42-38 75-38 112 0" fill="none" stroke="#6c5ce7" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 9" />
          <path d="M364 227l4 17-17 1" fill="none" stroke="#6c5ce7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="369" y="205" width="145" height="78" rx="14" fill="#f5f3ff" stroke="#6c5ce7" strokeWidth="3" />
          <text x="441" y="238" textAnchor="middle" fill="#42338b" fontSize="16" fontWeight="700">Git commit</text>
          <text x="441" y="261" textAnchor="middle" fill="#62588f" fontSize="12">versioned · reviewable</text>
        </g>
        <g className={styles.heroPulse}>
          <circle cx="300" cy="357" r="22" fill="#0f8b6d" />
          <circle cx="358" cy="357" r="22" fill="#6c5ce7" />
          <text x="300" y="362" textAnchor="middle" fill="white" fontSize="12" fontWeight="700">MM</text>
          <text x="358" y="362" textAnchor="middle" fill="white" fontSize="12" fontWeight="700">AK</text>
          <rect x="399" y="339" width="115" height="36" rx="18" fill="#d9fff3" />
          <circle cx="419" cy="357" r="5" fill="#10b981" />
          <text x="434" y="362" fill="#11604e" fontSize="13" fontWeight="700">2 live</text>
        </g>
        <path className={styles.heroSketch} d="M105 345c30-18 58-17 78 3s46 23 72 3" fill="none" stroke="#f59e0b" strokeWidth="5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function WhiteboardToolbar(): ReactNode {
  return (
    <div className={styles.toolDock} aria-label="Whiteboard tools">
      <button type="button" className={styles.toolActive} aria-label="Selection tool"><span className={styles.cursorIcon}>➤</span></button>
      <button type="button" aria-label="Rectangle tool"><span className={styles.squareIcon} /></button>
      <button type="button" aria-label="Diamond tool"><span className={styles.diamondIcon} /></button>
      <button type="button" aria-label="Ellipse tool"><span className={styles.circleIcon} /></button>
      <button type="button" aria-label="Arrow tool"><span className={styles.arrowIcon}>→</span></button>
      <button type="button" aria-label="Draw tool"><span className={styles.drawIcon}>⌁</span></button>
      <button type="button" aria-label="Text tool"><span className={styles.textIcon}>A</span></button>
    </div>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout title="Collaborate live. Commit the result." description="Self-hosted collaboration for Excalidraw files that stay in Git.">
      <main>
        <section className={styles.hero}>
          <div className={`container ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <div className={styles.eyebrow}>OPEN SOURCE · SELF-HOSTED · GIT-NATIVE</div>
              <h1>Collaborate live.<br/>Commit the result.</h1>
              <p className={styles.lead}>Sketchblock turns Excalidraw files in Git into focused live workspaces—so technical teams can think visually without losing ownership, history, or context.</p>
              <div className={styles.actions}>
                <Link className="button button--primary button--lg" to="/docs/getting-started/quickstart">Run the demo</Link>
                <Link className="button button--secondary button--lg" href="https://github.com/mimeonline/sketchblock">View on GitHub</Link>
              </div>
              <div className={styles.command}><span>$</span> git clone https://github.com/mimeonline/sketchblock.git<br/><span>$</span> ./scripts/start.sh</div>
            </div>
            <HeroVisual />
          </div>
        </section>

        <section className={styles.proof} aria-label="Why Sketchblock">
          <div className={`container ${styles.proofGrid}`}>
            {proof.map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}
          </div>
        </section>

        <section className={styles.workspace}>
          <div className={`container ${styles.workspaceGrid}`}>
            <div><div className={styles.eyebrow}>FROM FILE TO LIVE ROOM</div><h2>Keep the artifact.<br/>Add the collaboration.</h2></div>
            <div className={styles.mockup} aria-label="Sketchblock product preview">
              <div className={styles.mockbar}><i/><i/><i/><span>sketchblock / architecture.excalidraw</span></div>
              <div className={styles.canvas}>
                <WhiteboardToolbar />
                <div className={styles.node}>Product context</div><div className={styles.line}/><div className={styles.node}>Shared understanding</div>
                <div className={styles.presence}><b>MM</b><b>AK</b><span>2 live</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.useCases}>
          <div className="container">
            <div className={styles.useCasesIntro}>
              <div className={styles.eyebrow}>BUILT FOR TECHNICAL CONVERSATIONS</div>
              <h2>Some decisions need a canvas.<br/>Every result needs a home.</h2>
              <p>Sketchblock connects the moment when a team thinks together with the place where its technical work already lives.</p>
            </div>
            <div className={styles.useCaseGrid}>
              {useCases.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}
            </div>
          </div>
        </section>

        <section className={styles.flow}>
          <div className="container"><div className={styles.eyebrow}>FIVE MINUTES TO FIRST VALUE</div><h2>Start with no credentials.</h2>
            <div className={styles.flowGrid}>{flow.map(([number,title,text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
          </div>
        </section>

        <section className={styles.founder}>
          <div className={`container ${styles.founderGrid}`}>
            <div className={styles.founderImageWrap}>
              <img src="/sketchblock/img/michael-meierhoff.jpg" alt="Michael Meierhoff, creator of Sketchblock" className={styles.founderImage} />
            </div>
            <div className={styles.founderCopy}>
              <div className={styles.eyebrow}>WHY I BUILT SKETCHBLOCK</div>
              <h2>The important conversations happened around diagrams. The diagrams kept losing their context.</h2>
              <p>I’m Michael Meierhoff, a software architect, systems thinker, and independent builder. For more than two decades I have worked with software systems, architecture, and the difficult space between technical detail and shared understanding.</p>
              <p>Sketchblock grew from a recurring frustration: teams think visually, while the resulting artifact often drifts away from the code, the decision, and its history. This project is my attempt to close that gap with a small, self-hosted tool that keeps visual work inspectable, versioned, and yours.</p>
              <div className={styles.founderLinks}>
                <Link to="/docs/project/about">Read the full story</Link>
                <Link href="https://methodatlas.meierhoff-systems.de/en">Explore Method Atlas</Link>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.finalCta}><div className="container"><h2>Your diagrams already live in Git.<br/>Now your conversations can too.</h2><Link className="button button--primary button--lg" to="/docs/getting-started/quickstart">Open the quickstart</Link></div></section>
      </main>
    </Layout>
  );
}
