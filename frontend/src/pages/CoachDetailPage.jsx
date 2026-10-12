import { Link, useParams } from 'react-router-dom';
import { getCoachProfile } from '../api/coachesApi.js';
import { useApi } from '../hooks/useApi.js';
import { Badge, Card, PageHeader, StateBlock } from '../components/ui.jsx';

export default function CoachDetailPage() {
  const { coachId } = useParams();
  const { data, error, loading, reload } = useApi(
    () => getCoachProfile(coachId),
    [coachId]
  );

  return (
    <div>
      <PageHeader
        eyebrow={`Coach #${coachId}`}
        title={data?.name || 'Coach profile'}
        sub={data ? data.specialty || 'General training' : 'Loading profile…'}
      />
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading coach…"
        onRetry={reload}
      >
        {data && (
          <>
            <Card title={data.name} sub={data.specialty}>
              <p style={{ marginTop: 0 }}>{data.bio || 'No bio provided.'}</p>
              <p>
                <Badge>Coach #{data.coachNumber}</Badge>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link
                  className="btn btn-primary btn-sm"
                  style={{ width: 'auto', textDecoration: 'none' }}
                  to={`/subscriptions?coach=${data.coachNumber}`}
                >
                  View {data.name}&rsquo;s plans
                </Link>
                <Link
                  className="btn btn-ghost btn-sm"
                  style={{ textDecoration: 'none' }}
                  to="/coaches"
                >
                  All coaches
                </Link>
              </div>
            </Card>
          </>
        )}
      </StateBlock>
    </div>
  );
}
