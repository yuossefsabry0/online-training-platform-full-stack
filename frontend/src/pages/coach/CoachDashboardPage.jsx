import { Link } from 'react-router-dom';
import { listMyMembers, listPaymentRequests } from '../../api/coachApi.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { formatAmount } from '../../utils/format.js';
import { Badge, Card, PageHeader, PaymentStatusBadge, StateBlock } from '../../components/ui.jsx';

// Coach overview. No stats endpoint exists, so the dashboard composes the two
// scoped endpoints and labels everything by source:
// - active members total (GET /members/ pagination.total — authoritative)
// - payment requests total (GET /payments/ pagination.total — authoritative)
// - pending count among the latest 100 requests (bounded fetch, labelled)
// - latest members + latest requests tables.
export default function CoachDashboardPage() {
  const { user } = useAuth();
  const membersQuery = useApi(() => listMyMembers({ page: 1, pageSize: 5 }));
  const paymentsQuery = useApi(() => listPaymentRequests({ page: 1, pageSize: 100 }));

  const memberTotal = membersQuery.data?.pagination?.total ?? null;
  const paymentTotal = paymentsQuery.data?.pagination?.total ?? null;
  const recentPayments = paymentsQuery.data?.items ?? [];
  const pendingRecent = recentPayments.filter((p) => p.status === 'PENDING');
  const coachName =
    recentPayments.find((p) => p.coach?.name)?.coach?.name || null;

  return (
    <div>
      <PageHeader
        eyebrow="Coach"
        title={coachName ? `${coachName}'s dashboard` : 'Coach dashboard'}
        sub={`Welcome, ${user?.username || 'coach'}. Everything here is scoped to your own members by the server.`}
      />
      <StateBlock
        loading={membersQuery.loading || paymentsQuery.loading}
        error={membersQuery.error || paymentsQuery.error}
        loadingLabel="Loading dashboard…"
        onRetry={() => {
          membersQuery.reload();
          paymentsQuery.reload();
        }}
      >
        <div className="stat-grid">
          <div className="stat-card">
            <strong>{memberTotal ?? '—'}</strong>
            <span>Active members</span>
          </div>
          <div className="stat-card">
            <strong>{pendingRecent.length}</strong>
            <span>Pending (latest 100 requests)</span>
          </div>
          <div className="stat-card">
            <strong>{paymentTotal ?? '—'}</strong>
            <span>Total requests</span>
          </div>
        </div>

        <div className="grid-2">
          <Card title="Latest members" sub="Your 5 soonest-expiring members.">
            {!membersQuery.data?.items?.length ? (
              <p className="card-sub">No active members yet.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {membersQuery.data.items.map((m) => (
                  <li key={m.userId} style={{ marginBottom: '0.4rem' }}>
                    <Link to={`/coach/members/${m.userId}`} state={{ member: m }}>
                      {m.username}
                    </Link>{' '}
                    <span className="card-sub">
                      · {m.memberId} · {m.remainingDays}d left
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ marginBottom: 0 }}>
              <Link to="/coach/members">All members →</Link>
            </p>
          </Card>

          <Card title="Needs your decision" sub="Pending requests among the latest 100.">
            {!pendingRecent.length ? (
              <p className="card-sub" style={{ marginBottom: 0 }}>
                Nothing pending. <Link to="/coach/payment-requests">All requests →</Link>
              </p>
            ) : (
              <ul style={{ margin: '0 0 0.6rem', paddingLeft: '1.1rem' }}>
                {pendingRecent.slice(0, 5).map((p) => (
                  <li key={p.id} style={{ marginBottom: '0.4rem' }}>
                    <Link
                      to={`/coach/payment-requests/${p.id}`}
                      state={{ payment: p }}
                    >
                      {p.user?.username}
                    </Link>{' '}
                    <span className="card-sub">
                      · {p.packageName} · {formatAmount(p.amount)}
                    </span>{' '}
                    <PaymentStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
            <p style={{ marginBottom: 0 }}>
              <Link to="/coach/payment-requests">All requests →</Link>
            </p>
          </Card>
        </div>

        <p className="card-sub" style={{ marginTop: '1rem' }}>
          Approval conflicts (capacity filled, member joined another coach) are
          re-checked by the server at decision time — <Badge>server verdict</Badge> is final.
        </p>
      </StateBlock>
    </div>
  );
}
