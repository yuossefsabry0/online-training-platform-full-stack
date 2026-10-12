import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { confirmSelection } from '../api/subscriptionsApi.js';
import { getBackendMessage } from '../api/errors.js';
import { formatAmount } from '../utils/format.js';
import { Alert, Badge, Button, Card, PageHeader, FullPageLoader } from '../components/ui.jsx';

// Review step. POST /subscriptions/confirm { coachNumber, months }.
// The backend decides NEW vs EXTENSION, conflicts and capacity —
// this page only displays the backend verdict.
export default function ConfirmSubscriptionPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const coachNumber = params.get('coach');
  const months = params.get('months');
  const [state, setState] = useState({ loading: true, error: '', result: null, message: '' });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!coachNumber || !months) {
        setState({ loading: false, error: 'Choose a coach and a plan first.', result: null, message: '' });
        return;
      }
      setState({ loading: true, error: '', result: null, message: '' });
      try {
        const envelope = await confirmSelection({ coachNumber, months });
        if (!cancelled)
          setState({ loading: false, error: '', result: envelope?.data || null, message: envelope?.message || '' });
      } catch (err) {
        if (!cancelled)
          setState({ loading: false, error: getBackendMessage(err), result: null, message: '' });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [coachNumber, months]);

  const { loading, error, result, message } = state;

  function proceedToPayment() {
    const q = new URLSearchParams({
      coach: String(result.coach.coachNumber),
      months: String(result.plan.months),
      package: result.plan.name,
      amount: String(result.plan.priceCents / 100),
    });
    navigate(`/payment?${q.toString()}`);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Review"
        title="Confirm your selection"
        sub="The backend validates eligibility and tells us whether this is new or an extension."
      />
      {loading && <FullPageLoader label="Confirming with the server…" />}
      {!loading && error && (
        <>
          <Alert>{error}</Alert>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }} to="/subscriptions">
              Back to plans
            </Link>
            <Link className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }} to="/my-subscription">
              My subscription
            </Link>
          </div>
        </>
      )}
      {!loading && !error && !result && (
        <Alert kind="info">
          No selection to confirm. <Link to="/subscriptions">Browse plans</Link>
        </Alert>
      )}
      {!loading && result && (
        <Card title="Selection confirmed" sub={message}>
          <dl className="kv">
            <dt>Type</dt>
            <dd>
              <Badge tone={result.mode === 'EXTENSION' ? 'accent' : ''}>{result.mode}</Badge>
            </dd>
            <dt>Coach</dt>
            <dd>{result.coach.name} (#{result.coach.coachNumber})</dd>
            <dt>Plan</dt>
            <dd>{result.plan.name} · {result.plan.months} month{result.plan.months === 1 ? '' : 's'}</dd>
            <dt>Price</dt>
            <dd>{formatAmount(result.plan.priceCents / 100)}</dd>
          </dl>
          {result.mode === 'EXTENSION' && (
            <Alert kind="info">
              This extends your current subscription — time is added on top of your remaining time.
            </Alert>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <Button type="button" onClick={proceedToPayment}>
              Proceed to payment
            </Button>
            <Link className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }} to="/subscriptions">
              Change selection
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
