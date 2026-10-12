import { Link } from 'react-router-dom';
import { listPlans } from '../api/subscriptionsApi.js';
import { useApi } from '../hooks/useApi.js';
import { Badge, Card, PageHeader, StateBlock } from '../components/ui.jsx';

// Coach browsing. The backend has no public coach LIST endpoint, so the
// list is derived from GET /subscriptions/plans (real backend data:
// coachNumber, coachName, specialty, capacity). Detail pages use
// GET /coaches/:coachNumber.
export default function CoachesPage() {
  const { data, error, loading, reload } = useApi(() => listPlans());

  return (
    <div>
      <PageHeader
        eyebrow="Coaches"
        title="Train with the best"
        sub="Pick a coach, then choose a plan. Availability and eligibility are decided by the backend."
      />
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading coaches…"
        onRetry={reload}
        empty={!data?.length ? 'No coaches are available right now.' : null}
      >
        <div className="grid-2">
          {(data || []).map((c) => (
            <Card
              key={c.coachNumber}
              title={`${c.coachName} · #${c.coachNumber}`}
              sub={c.specialty || 'General training'}
            >
              <p className="card-sub">
                {c.plans?.length || 0} plan{(c.plans?.length || 0) === 1 ? '' : 's'} available
                {' · '}
                {c.capacity == null ? (
                  <Badge tone="accent">Open enrollment</Badge>
                ) : (
                  <Badge>Capacity {c.capacity}</Badge>
                )}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link
                  className="btn btn-primary btn-sm"
                  style={{ width: 'auto', textDecoration: 'none' }}
                  to={`/coaches/${c.coachNumber}`}
                >
                  View profile
                </Link>
                <Link
                  className="btn btn-ghost btn-sm"
                  style={{ textDecoration: 'none' }}
                  to={`/subscriptions?coach=${c.coachNumber}`}
                >
                  See plans
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </StateBlock>
    </div>
  );
}
