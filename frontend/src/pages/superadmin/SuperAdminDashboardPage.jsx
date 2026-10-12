import { Link } from 'react-router-dom';
import {
  listAllCoaches,
  listAllPayments,
  listAuditLog,
  listDeletedAccounts,
} from '../../api/superAdminApi.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { formatAmount } from '../../utils/format.js';
import { Badge, Card, PageHeader, PaymentStatusBadge, StateBlock } from '../../components/ui.jsx';

// System overview. No stats endpoint exists, so the dashboard composes the
// scoped endpoints and labels every number by source (authoritative totals
// from pagination.total; pending counted across a bounded latest-100 fetch).
export default function SuperAdminDashboardPage() {
  const { user } = useAuth();
  const coachesQuery = useApi(() => listAllCoaches());
  const paymentsQuery = useApi(() => listAllPayments({ page: 1, pageSize: 100 }));
  const deletedQuery = useApi(() => listDeletedAccounts({ page: 1, pageSize: 1 }));
  const auditQuery = useApi(() => listAuditLog({ page: 1, pageSize: 5 }));

  const loading =
    coachesQuery.loading || paymentsQuery.loading || deletedQuery.loading || auditQuery.loading;
  const error =
    coachesQuery.error || paymentsQuery.error || deletedQuery.error || auditQuery.error;
  const reload = () => {
    coachesQuery.reload();
    paymentsQuery.reload();
    deletedQuery.reload();
    auditQuery.reload();
  };

  const coaches = coachesQuery.data ?? [];
  const payments = paymentsQuery.data?.items ?? [];
  const paymentTotal = paymentsQuery.data?.pagination?.total ?? null;
  const pendingRecent = payments.filter((p) => p.status === 'PENDING');
  const deletedTotal = deletedQuery.data?.pagination?.total ?? null;
  const auditTotal = auditQuery.data?.pagination?.total ?? null;
  const recentAudit = auditQuery.data?.items ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Super Admin"
        title="System dashboard"
        sub={`Welcome, ${user?.username || 'admin'}. Platform-wide data from the server.`}
      />
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading system overview…"
        onRetry={reload}
      >
        <div className="stat-grid">
          <div className="stat-card">
            <strong>{coaches.length}</strong>
            <span>Coaches</span>
          </div>
          <div className="stat-card">
            <strong>{paymentTotal ?? '—'}</strong>
            <span>Payment requests (all)</span>
          </div>
          <div className="stat-card">
            <strong>{deletedTotal ?? '—'}</strong>
            <span>Deleted accounts</span>
          </div>
        </div>

        <div className="grid-2">
          <Card title="Coaches" sub="Every coach profile on record.">
            {!coaches.length ? (
              <p className="card-sub">No coaches yet.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {coaches.map((c) => (
                  <li key={c.coachId} style={{ marginBottom: '0.4rem' }}>
                    <strong>{c.name}</strong>{' '}
                    <span className="card-sub">
                      #{c.coachNumber} · {c.specialty || 'General'}
                      {' · '}
                      {c.capacity == null ? 'unlimited' : `cap ${c.capacity}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ marginBottom: 0 }}>
              <Link to="/super-admin/coaches">Manage coaches →</Link>
            </p>
          </Card>

          <Card
            title="Needs attention"
            sub={`${pendingRecent.length} pending among the latest 100 requests · ${auditTotal ?? '—'} audit entries total.`}
          >
            {!pendingRecent.length ? (
              <p className="card-sub">No pending requests in the latest 100.</p>
            ) : (
              <ul style={{ margin: '0 0 0.6rem', paddingLeft: '1.1rem' }}>
                {pendingRecent.slice(0, 5).map((p) => (
                  <li key={p.id} style={{ marginBottom: '0.4rem' }}>
                    <strong>{p.user?.username}</strong>{' '}
                    <span className="card-sub">
                      → {p.coach?.name} · {p.packageName} · {formatAmount(p.amount)}
                    </span>{' '}
                    <PaymentStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
            <p style={{ marginBottom: 0 }}>
              <Link to="/super-admin/payments">All payments →</Link>
            </p>
          </Card>
        </div>

        <Card title="Latest admin activity" sub="Newest audit entries.">
          {!recentAudit.length ? (
            <p className="card-sub" style={{ marginBottom: 0 }}>No audit entries yet.</p>
          ) : (
            <ul style={{ margin: '0 0 0.6rem', paddingLeft: '1.1rem' }}>
              {recentAudit.map((a) => (
                <li key={a.id} style={{ marginBottom: '0.4rem' }}>
                  <Badge>{a.action}</Badge>{' '}
                  <span className="card-sub">
                    by {a.actor || '—'} ({a.actorRole || '—'})
                    {a.targetUser ? ` → ${a.targetUser}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginBottom: 0 }}>
            <Link to="/super-admin/audit-logs">Full audit log →</Link>
          </p>
        </Card>
      </StateBlock>
    </div>
  );
}
