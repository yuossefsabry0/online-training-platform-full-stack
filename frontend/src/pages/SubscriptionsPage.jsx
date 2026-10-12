import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listPlans } from '../api/subscriptionsApi.js';
import { useApi } from '../hooks/useApi.js';
import { formatAmount } from '../utils/format.js';
import { VALID_MONTHS } from '../utils/validation.js';
import { Badge, Card, PageHeader, StateBlock } from '../components/ui.jsx';

// Plan browsing from GET /subscriptions/plans (backend-provided prices).
// Selection moves to /subscriptions/confirm — the backend validates
// eligibility, conflicts and capacity there.
export default function SubscriptionsPage() {
  const [params] = useSearchParams();
  const focusCoach = params.get('coach');
  const { data, error, loading, reload } = useApi(() => listPlans());
  const [months, setMonths] = useState(3);

  const coaches = useMemo(() => {
    if (!data) return [];
    if (!focusCoach) return data;
    return data.filter((c) => String(c.coachNumber) === String(focusCoach));
  }, [data, focusCoach]);

  return (
    <div>
      <PageHeader
        eyebrow="Subscriptions"
        title="Choose your plan"
        sub="1, 3, 6 or 12 months with any coach. Prices come from the backend."
      />
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading plans…"
        onRetry={reload}
        empty={data && !data.length ? 'No subscription plans are available right now.' : null}
      >
        {focusCoach && (
          <p className="card-sub">
            Showing coach #{focusCoach} · <Link to="/subscriptions">Show all coaches</Link>
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }} role="group" aria-label="Duration">
          {VALID_MONTHS.map((m) => (
            <button
              key={m}
              type="button"
              className={`btn btn-sm ${months === m ? 'btn-primary' : 'btn-ghost'}`}
              style={months === m ? { width: 'auto' } : undefined}
              onClick={() => setMonths(m)}
              aria-pressed={months === m}
            >
              {m === 12 ? '12 mo (1 yr)' : `${m} mo`}
            </button>
          ))}
        </div>
        <div className="grid-2">
          {coaches.map((c) => {
            const plan = c.plans?.find((p) => p.months === months);
            return (
              <Card
                key={c.coachNumber}
                title={`${c.coachName} · #${c.coachNumber}`}
                sub={c.specialty || 'General training'}
              >
                {plan ? (
                  <>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '1.6rem', fontWeight: 800 }}>
                      {formatAmount(plan.price)}
                    </p>
                    <p className="card-sub" style={{ marginTop: 0 }}>
                      {plan.name} · {plan.months} month{plan.months === 1 ? '' : 's'}
                      {' · '}
                      {c.capacity == null ? (
                        <Badge tone="accent">Open enrollment</Badge>
                      ) : (
                        <Badge>Capacity {c.capacity}</Badge>
                      )}
                    </p>
                    <Link
                      className="btn btn-primary btn-sm"
                      style={{ width: 'auto', textDecoration: 'none' }}
                      to={`/subscriptions/confirm?coach=${c.coachNumber}&months=${months}`}
                    >
                      Select plan
                    </Link>
                  </>
                ) : (
                  <p className="card-sub">
                    No {months}-month plan offered by this coach.{' '}
                    <Link to={`/coaches/${c.coachNumber}`}>View profile</Link>
                  </p>
                )}
              </Card>
            );
          })}
        </div>
        {data && focusCoach && !coaches.length && (
          <p className="card-sub">
            Unknown coach #{focusCoach}. <Link to="/subscriptions">Show all coaches</Link>
          </p>
        )}
      </StateBlock>
    </div>
  );
}
