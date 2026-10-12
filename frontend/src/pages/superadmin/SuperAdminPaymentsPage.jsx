import { useState } from 'react';
import { listAllPayments } from '../../api/superAdminApi.js';
import { useApi } from '../../hooks/useApi.js';
import { formatAmount, formatDateShort } from '../../utils/format.js';
import { PageHeader, Pagination, PaymentStatusBadge, StateBlock } from '../../components/ui.jsx';

// System-wide payments log (SUPER_ADMIN sees every request with its target
// coach — unlike the coach-scoped log). Backend pagination throughout.
export default function SuperAdminPaymentsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data, error, loading, reload } = useApi(
    () => listAllPayments({ page, pageSize }),
    [page, pageSize]
  );

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Super Admin"
        title="All payments"
        sub="Every payment request system-wide, newest first."
      />
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading payments…"
        onRetry={reload}
        empty={data && !items.length ? 'No payment requests on record.' : null}
      >
        {!!items.length && (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Coach</th>
                  <th>Package</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Decided</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.user?.username}</strong>
                      <div className="card-sub" style={{ margin: 0 }}>
                        {p.user?.email} · {p.holderName}
                      </div>
                    </td>
                    <td>{p.coach?.name} (#{p.coach?.coachNumber})</td>
                    <td>{p.packageName}</td>
                    <td>{formatAmount(p.amount)}</td>
                    <td style={{ wordBreak: 'break-all' }}>{p.reference}</td>
                    <td>{p.isExtension ? 'EXT' : 'NEW'}</td>
                    <td>
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td>
                      {p.decidedAt ? formatDateShort(p.decidedAt) : '—'}
                      {p.rejectionNote && (
                        <div className="card-sub" style={{ margin: 0 }}>
                          {p.rejectionNote}
                        </div>
                      )}
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
