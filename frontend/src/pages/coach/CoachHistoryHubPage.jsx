import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listMyMembers } from '../../api/coachApi.js';
import { useApi } from '../../hooks/useApi.js';
import { PageHeader, Pagination, StateBlock } from '../../components/ui.jsx';

// Subscription-history hub. History is per-member on the backend
// (GET /admin/members/:userId/history), so this page lists your members
// with backend pagination — each row opens that member's record.
export default function CoachHistoryHubPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data, error, loading, reload } = useApi(
    () => listMyMembers({ page, pageSize }),
    [page, pageSize]
  );

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Coach"
        title="Subscription histories"
        sub="Pick a member to see their server-side subscription record."
      />
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading members…"
        onRetry={reload}
        empty={data && !items.length ? 'No members to show history for.' : null}
      >
        {!!items.length && (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Member ID</th>
                  <th>Remaining</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.userId}>
                    <td>
                      <strong>{m.username}</strong>
                      <div className="card-sub" style={{ margin: 0 }}>
                        {m.email}
                      </div>
                    </td>
                    <td>{m.memberId}</td>
                    <td>{m.remainingDays}d</td>
                    <td>
                      <Link to={`/coach/members/${m.userId}`} state={{ member: m }}>
                        View history
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          pagination={data?.pagination}
          onPage={(p) => setPage(p)}
          onPageSize={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </StateBlock>
    </div>
  );
}
