import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSubscriptionStatus } from '../api/subscriptionsApi.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { formatDate } from '../utils/format.js';
import { Alert, Badge, Card, PageHeader, StateBlock } from '../components/ui.jsx';

// Live subscription state from GET /subscriptions/status. Everything shown
// (member id, coach, dates, remaining days, expiry warning) is backend data.
export default function MySubscriptionPage() {
  const { patchUser } = useAuth();
  const { data, error, loading, reload } = useApi(() => getSubscriptionStatus());

  // Reflect backend-driven role changes (e.g. MEMBER→BASIC on expiry).
  useEffect(() => {
    if (data?.role) patchUser({ role: data.role });
  }, [data?.role, patchUser]);

  return (
    <div>
      <PageHeader
        eyebrow="Membership"
        title="My subscription"
        sub="Live state from the server — never calculated locally."
      />
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading subscription…"
        onRetry={reload}
      >
        {data && <StatusBody status={data} />}
      </StateBlock>
    </div>
  );
}

function StatusBody({ status }) {
  const sub = status.subscription;
  return (
    <div>
      <p>
        <Badge tone={status.plan === 'MEMBER' ? 'accent' : ''}>
          {status.plan} plan
        </Badge>{' '}
        <Badge>{status.role}</Badge>
      </p>
      {status.expiringSoon && status.warning && (
        <Alert kind="error">{status.warning}</Alert>
      )}
      {!sub && (
        <Alert kind="info">
          No active subscription. <Link to="/subscriptions">Browse plans</Link> to get started.
        </Alert>
      )}
      {sub && (
        <Card title="Active subscription" sub={`Member ID ${sub.memberId}`}>
          <dl className="kv">
            <dt>Member ID</dt>
            <dd>{sub.memberId}</dd>
            <dt>Coach</dt>
            <dd>
              {sub.coach?.name} (#{sub.coach?.coachNumber}){' '}
              <Link to={`/coaches/${sub.coach?.coachNumber}`}>View</Link>
            </dd>
            <dt>Started</dt>
            <dd>{formatDate(sub.startsAt)}</dd>
            <dt>Expires</dt>
            <dd>{formatDate(sub.expiresAt)}</dd>
            <dt>Remaining</dt>
            <dd>{sub.remainingDays} day(s)</dd>
            <dt>Contact access</dt>
            <dd>{status.contactUsAccess ? 'Granted' : 'Not granted'}</dd>
          </dl>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <Link
              className="btn btn-ghost btn-sm"
              style={{ textDecoration: 'none' }}
              to={`/subscriptions?coach=${sub.coach?.coachNumber}`}
            >
              Renew / extend
            </Link>
            {status.contactUsAccess && (
              <Link className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }} to="/contact">
                Contact us
              </Link>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
