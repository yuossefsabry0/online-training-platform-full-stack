import { useState } from 'react';
import { listAuditLog } from '../../api/superAdminApi.js';
import { useApi } from '../../hooks/useApi.js';
import { formatDate } from '../../utils/format.js';
import { Badge, PageHeader, Pagination, StateBlock } from '../../components/ui.jsx';

// Audit log. Read-only: entries are backend records (actor, action, target,
// details, timestamp) — the UI renders them and never edits or creates any.
export default function SuperAdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data, error, loading, reload } = useApi(
    () => listAuditLog({ page, pageSize }),
    [page, pageSize]
  );

  const items = data?.items ?? [];

  function renderDetails(details) {
    if (details == null) return '—';
    if (typeof details === 'string') return details;
    try {
      return JSON.stringify(details);
    } catch {
      return '—';
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Super Admin"
        title="Audit log"
        sub="Every recorded admin action, newest first."
      />
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading audit log…"
        onRetry={reload}
        empty={data && !items.length ? 'No audit entries yet.' : null}
      >
        {!!items.length && (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.createdAt)}</td>
                    <td>
                      <Badge>{a.action}</Badge>
                    </td>
                    <td>
                      {a.actor || '—'}
                      {a.actorRole && (
                        <div className="card-sub" style={{ margin: 0 }}>
                          {a.actorRole}
                        </div>
                      )}
                    </td>
                    <td>{a.targetUser || '—'}</td>
                    <td style={{ wordBreak: 'break-word', minWidth: '180px' }}>
                      <span className="card-sub">{renderDetails(a.details)}</span>
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
