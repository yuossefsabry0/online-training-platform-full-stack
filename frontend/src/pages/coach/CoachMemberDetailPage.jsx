import { Link, useLocation, useParams } from 'react-router-dom';
import { getMemberHistory } from '../../api/coachApi.js';
import { useApi } from '../../hooks/useApi.js';
import { formatDate, formatDateShort } from '../../utils/format.js';
import { Alert, Badge, Card, PageHeader, StateBlock } from '../../components/ui.jsx';
import MemberActions from './MemberActions.jsx';

// Member workspace. No single-member endpoint exists, so:
// - the current-subscription header uses the snapshot passed from the
//   members list (labelled as such), refreshed by action results;
// - history comes live from GET /admin/members/:userId/history (own
//   members only, server-enforced);
// - extend / change-plan / reduce / cancel submit straight to the backend.
export default function CoachMemberDetailPage() {
  const { memberId } = useParams();
  const location = useLocation();
  const snapshot = location.state?.member || null;

  const historyQuery = useApi(() => getMemberHistory(memberId), [memberId]);

  return (
    <div>
      <PageHeader
        eyebrow="Member"
        title={snapshot?.username || 'Member details'}
        sub={
          snapshot
            ? `Snapshot from your members list · ${snapshot.memberId}`
            : 'Member workspace — history and actions below.'
        }
      />
      <p className="card-sub">
        <Link to="/coach/members">← All members</Link>
      </p>

      {snapshot && (
        <Card title="Current subscription" sub="As listed — actions below refresh this view.">
          <dl className="kv">
            <dt>Username</dt>
            <dd>{snapshot.username}</dd>
            <dt>Email</dt>
            <dd>{snapshot.email}</dd>
            <dt>Nickname</dt>
            <dd>{snapshot.nickname ?? '—'}</dd>
            <dt>Member ID</dt>
            <dd>{snapshot.memberId}</dd>
            <dt>Started</dt>
            <dd>{formatDate(snapshot.startsAt)}</dd>
            <dt>Expires</dt>
            <dd>{formatDate(snapshot.expiresAt)}</dd>
            <dt>Remaining</dt>
            <dd>{snapshot.remainingDays} day(s)</dd>
          </dl>
        </Card>
      )}

      <Card title="Manage subscription" sub="The server validates every action.">
        <MemberActions
          userId={memberId}
          memberLabel={snapshot?.username}
          onChanged={() => historyQuery.reload()}
        />
      </Card>

      <Card title="Subscription history" sub="Server record for this member.">
        <StateBlock
          loading={historyQuery.loading}
          error={historyQuery.error}
          loadingLabel="Loading history…"
          onRetry={historyQuery.reload}
          empty={
            historyQuery.data && !historyQuery.data.length
              ? 'No history entries for this member yet.'
              : null
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(historyQuery.data || []).map((h) => (
              <div key={h.id}>
                <strong>
                  {h.planName} · {h.months}mo
                </strong>{' '}
                <Badge>{h.endReason}</Badge>
                <div className="card-sub">
                  {formatDateShort(h.startedAt)} → {formatDateShort(h.endedAt)}
                  {' · '}with {h.coachName || '—'}
                </div>
              </div>
            ))}
          </div>
        </StateBlock>
      </Card>

      {!snapshot && (
        <Alert kind="info">
          Opened directly without a list snapshot — history and actions above
          still work; the current-subscription header appears when you arrive
          from <Link to="/coach/members">My members</Link>.
        </Alert>
      )}
    </div>
  );
}
