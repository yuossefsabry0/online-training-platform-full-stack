import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listMyMembers } from '../../api/coachApi.js';
import { useApi } from '../../hooks/useApi.js';
import { formatDateShort } from '../../utils/format.js';
import { PageHeader, Pagination, StateBlock } from '../../components/ui.jsx';

// Own active members from GET /members/ with backend pagination.
// The list is server-scoped to the logged-in coach — no frontend filtering.
export default function CoachMembersPage() {
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
        title="My members"
        sub="Active subscribers assigned to you by the server."
      />
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading members…"
        onRetry={reload}
        empty={data && !items.length ? 'No active members right now.' : null}
      >
        {!!items.length && (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Member ID</th>
                  <th>Contact</th>
                  <th>Expires</th>
                  <th>Left</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.userId}>
                    <td>
                      <strong>{m.username}</strong>
                      {m.nickname && (
                        <div className="card-sub" style={{ margin: 0 }}>
                          {m.nickname}
                        </div>
                      )}
                    </td>
                    <td>{m.memberId}</td>
                    <td>{m.email}</td>
                    <td>{formatDateShort(m.expiresAt)}</td>
                    <td>{m.remainingDays}d</td>
                    <td>
                      <Link to={`/coach/members/${m.userId}`} state={{ member: m }}>
                        Manage
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
