import { Link, useLocation, useParams } from 'react-router-dom';
import { listPaymentRequests } from '../../api/coachApi.js';
import { useApi } from '../../hooks/useApi.js';
import { formatAmount, formatDate } from '../../utils/format.js';
import { Alert, Badge, Card, PageHeader, PaymentStatusBadge, StateBlock } from '../../components/ui.jsx';
import DecideControls from './DecideControls.jsx';

// Request detail. No single-payment endpoint exists, so the full record
// arrives as a snapshot from the list (labelled); direct URL access falls
// back to a bounded lookup in the latest 100 requests. Approve/reject acts
// on the id directly — the server verdict is authoritative.
export default function CoachPaymentDetailPage() {
  const { paymentId } = useParams();
  const location = useLocation();
  const snapshot = location.state?.payment || null;

  const lookupQuery = useApi(
    () => (snapshot ? Promise.resolve({ data: snapshot }) : listPaymentRequests({ page: 1, pageSize: 100 })),
    [paymentId]
  );

  const payment = snapshot || (lookupQuery.data?.items || []).find((p) => p.id === paymentId) || null;
  const lookedUp = !snapshot && !lookupQuery.loading && !lookupQuery.error;

  return (
    <div>
      <PageHeader
        eyebrow="Payment request"
        title={payment ? `${payment.user?.username} · ${payment.packageName}` : 'Request details'}
        sub={payment ? `Reference ${payment.reference}` : 'Loading request…'}
      />
      <p className="card-sub">
        <Link to="/coach/payment-requests">← All requests</Link>
      </p>

      <StateBlock
        loading={lookupQuery.loading}
        error={lookupQuery.error}
        loadingLabel="Loading request…"
        onRetry={lookupQuery.reload}
        empty={lookedUp && !payment ? 'Request not found among your latest 100. Check the payments log.' : null}
      >
        {payment && (
          <>
            <Card title="Request" sub="Exactly as stored on the server.">
              <dl className="kv">
                <dt>Status</dt>
                <dd><PaymentStatusBadge status={payment.status} /></dd>
                <dt>Type</dt>
                <dd><Badge>{payment.isExtension ? 'EXTENSION' : 'NEW'}</Badge></dd>
                <dt>User</dt>
                <dd>{payment.user?.username} · {payment.user?.email} ({payment.user?.role})</dd>
                <dt>Holder</dt>
                <dd>{payment.holderName}</dd>
                <dt>Package</dt>
                <dd>{payment.packageName}</dd>
                <dt>Amount</dt>
                <dd>{formatAmount(payment.amount)}</dd>
                <dt>Reference</dt>
                <dd>{payment.reference}</dd>
                <dt>Coach</dt>
                <dd>{payment.coach?.name} (#{payment.coach?.coachNumber})</dd>
                <dt>Decided at</dt>
                <dd>{payment.decidedAt ? formatDate(payment.decidedAt) : '—'}</dd>
                {payment.rejectionNote && (
                  <>
                    <dt>Note</dt>
                    <dd>{payment.rejectionNote}</dd>
                  </>
                )}
              </dl>
            </Card>

            {payment.status === 'PENDING' ? (
              <Card title="Your decision" sub="Capacity and conflicts are re-checked by the server now.">
                <DecideControls
                  paymentId={payment.id}
                  onDecided={() => lookupQuery.reload()}
                />
              </Card>
            ) : (
              <Alert kind="info">
                Already {payment.status.toLowerCase()} — decisions are final on the server.
              </Alert>
            )}
          </>
        )}
      </StateBlock>
    </div>
  );
}
