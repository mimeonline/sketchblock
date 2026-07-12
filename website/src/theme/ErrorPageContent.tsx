import type {ReactNode} from 'react';
import type {Props} from '@theme/Error';

import ErrorState from '../components/ErrorState';

export default function ErrorPageContent({tryAgain}: Props): ReactNode {
  return (
    <ErrorState
      code="500"
      eyebrow="COLLABORATION INTERRUPTED"
      title="The workspace lost its connection."
      description="An unexpected client error interrupted this page. Retry the current view first. If the problem returns, share the route and the steps that led here in the project issue tracker."
      primary={{label: 'Try again', reload: true}}
      secondary={{label: 'Return home', to: '/'}}
      issueLink
      onRetry={tryAgain}
      embedded
    />
  );
}
