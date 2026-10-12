import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listPaymentRequests } from '../../api/coachApi.js';
import { useApi } from '../../hooks/useApi.js';
import { formatAmount, formatDateShort } from '../../utils/format.js';
import { PageHeader, Pagination, PaymentStatusBadge, StateBlock } from '../../components/ui.jsx';
import DecideControls from './DecideControls.jsx';

// Payment requests addressed to the logged-in coach (server-scoped) with
// backend pagination. PENDING rows carry inline approve/reject controls;
// every row links to the full detail view.
export default function CoachPaymentRequestsPage() {
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
        title="Payment requests"
        sub="Requests from users who chose you. The server re-validates every decision."
      />
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading requests…"
        onRetry={reload}
        empty={data && !items.length ? 'No payment requests yet.' : null}
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
                  <th>Decision</th>
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
                        <strong>{p.user?.username}</strong>
                      </Link>
                      <div className="card-sub" style={{ margin: 0 }}>
                        {p.user?.email}
                      </div>
                    </td>
                    <td>{p.packageName}</td>
                    <td>{formatAmount(p.amount)}</td>
                    <td style={{ wordBreak: 'break-all' }}>{p.reference}</td>
                    <td>{p.isExtension ? 'EXTENSION' : 'NEW'}</td>
                    <td>
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td>
                      {p.status === 'PENDING' ? (
                        <DecideControls
                          paymentId={p.id}
                          compact
                          onDecided={() => reload()}
                        />
                      ) : (
                        <span className="card-sub">
                          {formatDateShort(p.decidedAt)}
                        </span>
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
