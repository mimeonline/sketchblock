import Head from '@docusaurus/Head';

import ErrorState from '../components/ErrorState';

export default function NotFound() {
  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <ErrorState
        code="404"
        eyebrow="LOST IN THE CANVAS"
        title="That board is out of frame."
        description="The page may have moved, the link may be incomplete, or the artifact may no longer exist. Start from a known point and keep exploring."
        primary={{label: 'Return home', to: '/'}}
        secondary={{label: 'Open the docs', to: '/docs/getting-started/quickstart'}}
      />
    </>
  );
}
