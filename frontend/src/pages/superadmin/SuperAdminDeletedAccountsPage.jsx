import { useState } from 'react';
import {
  listDeletedAccounts,
  purgeDeletedAccount,
} from '../../api/superAdminApi.js';
import { getBackendMessage } from '../../api/errors.js';
import { useApi } from '../../hooks/useApi.js';
import { formatDate } from '../../utils/format.js';
import {
  Alert,
  Button,
  Modal,
  PageHeader,
  Pagination,
  StateBlock,
} from '../../components/ui.jsx';

// Deleted-accounts archive. Rows are backend data, shown as-is; purge calls
// DELETE /admin/deleted-accounts/:id (permanent — confirmed first).
export default function SuperAdminDeletedAccountsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data, error, loading, reload } = useApi(
    () => listDeletedAccounts({ page, pageSize }),
    [page, pageSize]
  );

  const [purging, setPurging] = useState(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState('');
  const [bannerError, setBannerError] = useState('');

  const items = data?.items ?? [];

  async function onPurge() {
    if (!purging) return;
    setBusy(true);
    setBanner('');
    setBannerError('');
    try {
      const envelope = await purgeDeletedAccount(purging.id);
      setBanner(envelope?.message || 'Archived account permanently deleted.');
      setPurging(null);
      reload();
    } catch (err) {
      setBannerError(getBackendMessage(err));
      setPurging(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Super Admin"
        title="Deleted accounts"
        sub="Self-deleted accounts archived by the server."
      />
      <Alert kind="success">{banner}</Alert>
      <Alert>{bannerError}</Alert>
      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading deleted accounts…"
        onRetry={reload}
        empty={data && !items.length ? 'No deleted accounts on record.' : null}
      >
        {!!items.length && (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role at deletion</th>
                  <th>Deleted at</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.username}</strong>
                      <div className="card-sub" style={{ margin: 0 }}>
                        id {r.originalId}
                      </div>
                    </td>
                    <td>{r.email}</td>
                    <td>{r.roleAtDeletion}</td>
                    <td>{formatDate(r.deletedAt)}</td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => setPurging(r)}
                      >
                        Purge…
                      </Button>
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

      {purging && (
        <Modal title="Purge archived account?" onClose={() => setPurging(null)}>
          <p className="card-sub">
            {purging.username} ({purging.email}) will be permanently removed
            from the archive. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" type="button" onClick={() => setPurging(null)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" type="button" loading={busy} onClick={onPurge}>
              Yes, purge
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
