import Head from '@docusaurus/Head';

import ErrorState from '../components/ErrorState';

export default function ServerError() {
  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <ErrorState
        code="500"
        eyebrow="COLLABORATION INTERRUPTED"
        title="The workspace lost its connection."
        description="An unexpected error interrupted this page. Reload the workspace first. If the problem returns, the project issue tracker is the best place to share what happened."
        primary={{label: 'Reload the page', reload: true}}
        secondary={{label: 'Return home', to: '/'}}
        issueLink
      />
    </>
  );
}
