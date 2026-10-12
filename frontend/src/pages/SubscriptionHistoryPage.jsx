import { Link } from 'react-router-dom';
import { getMyHistory } from '../api/accountApi.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { formatDateShort } from '../utils/format.js';
import { Badge, Card, PageHeader, StateBlock } from '../components/ui.jsx';

// Subscription history from GET /admin/members/:userId/history with the
// caller's own id. Records are backend data, shown as-is.
// KNOWN BACKEND LIMITATION (read-only, not fixable here): the route guard
// is requireRole('ADMIN'), so BASIC/MEMBER callers get 403 INSUFFICIENT_ROLE
// even for their own history. The backend error is shown honestly.
export default function SubscriptionHistoryPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi(
    () => getMyHistory(user.id),
    [user.id]
  );

  return (
    <div>
      <PageHeader
        eyebrow="Membership"
        title="Subscription history"
        sub="Every membership period the server has on record for you."
      />
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading history…"
        onRetry={reload}
        empty={data && !data.length ? 'No subscription history yet. Your first approved membership will appear here.' : null}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(data || []).map((h) => (
            <Card
              key={h.id}
              title={`${h.planName} · ${h.months} month${h.months === 1 ? '' : 's'}`}
              sub={`${formatDateShort(h.startedAt)} → ${formatDateShort(h.endedAt)}`}
            >
              <p>
                <Badge>{h.endReason}</Badge>{' '}
                <span className="card-sub">
                  with {h.coachName || '—'}
                  {h.coachName && (
                    <>
                      {' · '}
                      <Link to="/coaches">View coaches</Link>
                    </>
                  )}
                </span>
              </p>
            </Card>
          ))}
        </div>
        {data && !!data.length && (
          <p className="card-sub" style={{ marginTop: '1rem' }}>
            Need a new period? <Link to="/subscriptions">Browse plans</Link>
          </p>
        )}
      </StateBlock>
    </div>
  );
}
