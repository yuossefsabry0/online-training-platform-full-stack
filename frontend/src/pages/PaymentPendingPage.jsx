import { Link, useSearchParams } from 'react-router-dom';
import { getLastPayment } from '../auth/sessionStore.js';
import { getSubscriptionStatus } from '../api/subscriptionsApi.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { formatAmount, formatDate } from '../utils/format.js';
import { Alert, Badge, Card, PageHeader } from '../components/ui.jsx';

// Pending-request view. The backend offers no "my payments" endpoint, so
// this page renders the 201 submission receipt returned by POST /payments/
// (kept per device and namespaced to the submitting user) — labelled as
// such. Status beyond the receipt is never invented; the coach's decision
// arrives via subscription state.
export default function PaymentPendingPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const stored = getLastPayment();
  // Never show another user's receipt on a shared device; legacy receipts
  // saved without a username still display for the current session's user.
  const receipt =
    stored && (!stored.username || stored.username === user?.username)
      ? stored
      : null;
  const alreadyExists = params.get('exists') === '1';

  // The receipt alone is frozen at submit time (PENDING). The one later
  // outcome the frontend CAN observe authoritatively is approval: a live
  // active subscription with the same coach means this request was
  // approved. Anything else keeps the receipt's own status untouched —
  // rejection remains indistinguishable from waiting (backend limitation).
  const statusQuery = useApi(() => getSubscriptionStatus());
  const liveSub = statusQuery.data?.subscription ?? null;
  const approved =
    !!receipt &&
    !!liveSub &&
    Number(receipt.coachNumber) === Number(liveSub.coach?.coachNumber);

  return (
    <div>
      <PageHeader
        eyebrow="Payment"
        title="Pending request"
        sub="Your transfer is waiting for your coach's approval."
      />
      {alreadyExists && !approved && (
        <Alert kind="info">
          The server reports you already have a pending payment request. It is shown below if this device submitted it.
        </Alert>
      )}
      {approved && (
        <Alert kind="success">
          Approved — your {liveSub.coach?.name} subscription is active
          (member ID {liveSub.memberId}).{' '}
          <Link to="/my-subscription">View subscription</Link>
        </Alert>
      )}
      {!receipt && (
        <Alert kind="info">
          No payment submission found on this device.{' '}
          <Link to="/payment">Submit a payment</Link> or{' '}
          <Link to="/subscriptions">browse plans</Link> first.
        </Alert>
      )}
      {receipt && (
        <Card
          title="Last submitted request"
          sub="Receipt returned by the server at submission time."
        >
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              <Badge tone="accent">{approved ? 'APPROVED' : receipt.status || 'PENDING'}</Badge>
            </dd>
            <dt>Type</dt>
            <dd>
              <Badge>{receipt.isExtension ? 'EXTENSION' : 'NEW'}</Badge>
            </dd>
            <dt>Package</dt>
            <dd>{receipt.packageName || '—'}</dd>
            <dt>Amount</dt>
            <dd>{formatAmount(receipt.amount)}</dd>
            <dt>Coach</dt>
            <dd>{receipt.coachNumber ? `#${receipt.coachNumber}` : '—'}</dd>
            <dt>Submitted</dt>
            <dd>{formatDate(receipt.submittedAt)}</dd>
          </dl>
          <Alert kind="info">
            Approval is manual. Once approved, your subscription appears under{' '}
            <Link to="/my-subscription">My Subscription</Link>. If rejected,
            submit a new request from <Link to="/payment">Payment</Link>.
          </Alert>
        </Card>
      )}
    </div>
  );
}
