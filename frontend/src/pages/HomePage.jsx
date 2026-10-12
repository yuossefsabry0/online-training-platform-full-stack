import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getSubscriptionStatus } from '../api/subscriptionsApi.js';
import { useApi } from '../hooks/useApi.js';
import { getLastPayment } from '../auth/sessionStore.js';
import { formatAmount, formatDate } from '../utils/format.js';
import { Alert, Badge, Card, SessionCountdown, StateBlock } from '../components/ui.jsx';

function roleBadgeTone(role) {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 'admin';
  if (role === 'MEMBER') return 'accent';
  return '';
}

// Authenticated hub: live role/subscription/coach state from
// GET /subscriptions/status plus the session card from TASK 1.
export default function HomePage() {
  const { user, sessionExpiresAt, patchUser } = useAuth();
  const statusQuery = useApi(() => getSubscriptionStatus());

  useEffect(() => {
    if (statusQuery.data?.role) patchUser({ role: statusQuery.data.role });
  }, [statusQuery.data?.role, patchUser]);

  const status = statusQuery.data;
  const sub = status?.subscription;
  const storedReceipt = getLastPayment();
  const receipt =
    storedReceipt &&
    (!storedReceipt.username || storedReceipt.username === user?.username)
      ? storedReceipt
      : null;

  return (
    <div>
      <section
        style={{
          border: '1px solid var(--line)',
          borderRadius: '20px',
          overflow: 'hidden',
          marginBottom: '1rem',
          background:
            'linear-gradient(180deg, rgba(10,10,11,.30) 0%, rgba(10,10,11,.90) 80%), url(https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1600&q=60) center/cover no-repeat, var(--charcoal)',
        }}
      >
        <div style={{ padding: 'clamp(1.75rem, 4vw, 3rem)' }}>
          <span className="auth-hero-eyebrow">IronPulse · Home</span>
          <h1 style={{ margin: '0.6rem 0 0.4rem', fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', letterSpacing: '-0.02em' }}>
            Welcome{user?.username ? `, ${user.username}` : ''}.
          </h1>
          <p style={{ margin: 0, color: '#d7d7da', maxWidth: '52ch' }}>
            {sub
              ? `Training with ${sub.coach?.name} · ${sub.remainingDays} day(s) left on your membership.`
              : 'Browse coaches and plans to start your membership.'}
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {user?.role && (
              <Badge tone={roleBadgeTone(user.role)}>{user.role}</Badge>
            )}
            {user?.isVerified ? (
              <Badge tone="accent">Verified</Badge>
            ) : (
              <Badge>Unverified</Badge>
            )}
            {status && (
              <Badge tone={status.plan === 'MEMBER' ? 'accent' : ''}>
                {status.plan} plan
              </Badge>
            )}
          </div>
        </div>
      </section>

      <StateBlock
        loading={statusQuery.loading}
        error=""
        loadingLabel="Loading your training state…"
      >
        {status?.expiringSoon && status.warning && (
          <Alert kind="error">{status.warning}</Alert>
        )}
        <div className="grid-2">
          <Card
            title="Current subscription"
            sub="Live state from the server."
          >
            {statusQuery.error ? (
              <Alert>{statusQuery.error}</Alert>
            ) : !sub ? (
              <>
                <p className="card-sub">No active subscription.</p>
                <Link className="btn btn-primary btn-sm" style={{ width: 'auto', textDecoration: 'none' }} to="/subscriptions">
                  Browse plans
                </Link>
              </>
            ) : (
              <>
                <dl className="kv">
                  <dt>Member ID</dt>
                  <dd>{sub.memberId}</dd>
                  <dt>Coach</dt>
                  <dd>
                    {sub.coach?.name} (#{sub.coach?.coachNumber})
                  </dd>
                  <dt>Expires</dt>
                  <dd>{formatDate(sub.expiresAt)}</dd>
                  <dt>Remaining</dt>
                  <dd>{sub.remainingDays} day(s)</dd>
                </dl>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  <Link className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }} to="/my-subscription">
                    Details
                  </Link>
                  <Link className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }} to={`/subscriptions?coach=${sub.coach?.coachNumber}`}>
                    Renew / extend
                  </Link>
                </div>
              </>
            )}
          </Card>

          <Card title="Next steps" sub="Where to go from here.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <Link to="/coaches">Browse coaches →</Link>
              <Link to="/subscriptions">Browse subscription plans →</Link>
              {receipt && (
                <Link to="/payment/pending">
                  Pending payment ({formatAmount(receipt.amount)} · {receipt.packageName}) →
                </Link>
              )}
              {status?.contactUsAccess && <Link to="/contact">Contact us →</Link>}
              <Link to="/profile">View profile →</Link>
            </div>
          </Card>
        </div>
      </StateBlock>

      <div className="grid-2" style={{ marginTop: '1rem' }}>
        <Card
          title="Your account"
          sub="Identity as reported by the backend at login."
        >
          <dl className="kv">
            <dt>Username</dt>
            <dd>{user?.username ?? '—'}</dd>
            <dt>Email</dt>
            <dd>{user?.email ?? '—'}</dd>
            <dt>Nickname</dt>
            <dd>{user?.nickname ?? '—'}</dd>
            <dt>Role</dt>
            <dd>{user?.role ?? '—'}</dd>
            <dt>Member ID</dt>
            <dd>{user?.memberId ?? sub?.memberId ?? '—'}</dd>
            <dt>Coach ID</dt>
            <dd>{user?.coachId ?? sub?.coach?.coachId ?? '—'}</dd>
          </dl>
        </Card>

        <Card title="Session" sub="24-hour access-token session (backend contract).">
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              <SessionCountdown expiresAt={sessionExpiresAt} />
              {!sessionExpiresAt && 'Active'}
            </dd>
            <dt>Expires at</dt>
            <dd>
              {sessionExpiresAt
                ? new Date(sessionExpiresAt).toLocaleString()
                : 'Provided by the backend'}
            </dd>
            <dt>Token storage</dt>
            <dd>sessionStorage (never localStorage)</dd>
          </dl>
          <p className="card-sub" style={{ marginTop: '1rem', marginBottom: 0 }}>
            Expired sessions refresh once inside the 24h window, otherwise you
            return to <Link to="/login">login</Link>.
          </p>
        </Card>
      </div>
    </div>
  );
}
