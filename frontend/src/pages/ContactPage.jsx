import { getContactInfo } from '../api/accountApi.js';
import { useApi } from '../hooks/useApi.js';
import { Card, PageHeader, StateBlock } from '../components/ui.jsx';

// Contact Us. GET /contact/ is MEMBER-only with an active subscription —
// both enforced server-side. This page only renders what the backend
// returns (or its error, e.g. SUBSCRIPTION_INACTIVE for BASIC users).
export default function ContactPage() {
  const { data, error, loading, reload } = useApi(() => getContactInfo());

  return (
    <div>
      <PageHeader
        eyebrow="Support"
        title="Contact us"
        sub="Gym contact details, unlocked by an active membership."
      />
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading contact info…"
        onRetry={reload}
      >
        {data && (
          <Card title="Reach the gym" sub={`Member ID ${data.memberId}`}>
            <dl className="kv">
              <dt>Phone</dt>
              <dd>{data.gymPhone}</dd>
              <dt>Email</dt>
              <dd>{data.gymEmail}</dd>
              <dt>Address</dt>
              <dd>{data.address}</dd>
              <dt>Hours</dt>
              <dd>{data.hours}</dd>
            </dl>
          </Card>
        )}
      </StateBlock>
    </div>
  );
}
