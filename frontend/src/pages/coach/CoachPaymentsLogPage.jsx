import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listPaymentRequests } from '../../api/coachApi.js';
import { useApi } from '../../hooks/useApi.js';
import { formatAmount, formatDateShort } from '../../utils/format.js';
import { PageHeader, Pagination, PaymentStatusBadge, StateBlock } from '../../components/ui.jsx';

// Coach-scoped payments log (GET /payments/ — same scoped source as the
// requests view, presented here as the full paginated record).
export default function CoachPaymentsLogPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data, error, loading, reload } = useApi(
    () => listPaymentRequests({ page, pageSize }),
    [page, pageSize]
  );

  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Coach"
        title="Payments log"
        sub="Every request addressed to you, newest first."
      />
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading payments…"
        onRetry={reload}
        empty={data && !items.length ? 'No payments on record.' : null}
      >
        {!!items.length && (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>User</th>
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
                      <Link
                        to={`/coach/payment-requests/${p.id}`}
                        state={{ payment: p }}
                      >
                        {p.user?.username}
                      </Link>
                      <div className="card-sub" style={{ margin: 0 }}>
                        {p.holderName}
                      </div>
                    </td>
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
