import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteOwnAccount, updateNickname } from '../api/accountApi.js';
import { getBackendMessage } from '../api/errors.js';
import { validateNickname } from '../utils/validation.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { getSubscriptionStatus } from '../api/subscriptionsApi.js';
import { useApi } from '../hooks/useApi.js';
import { Alert, Badge, Button, Card, Modal, PageHeader, TextInput } from '../components/ui.jsx';

// Self-service profile. The backend supports nickname updates ONLY —
// every other field is read-only. Account deletion is backend-gated
// (BASIC role, no active subscription, no pending payment).
export default function ProfilePage() {
  const { user, patchUser, logout } = useAuth();
  const navigate = useNavigate();
  const statusQuery = useApi(() => getSubscriptionStatus());

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const nickErrors = touched ? validateNickname(nickname) : {};

  async function onSaveNickname(e) {
    e.preventDefault();
    setTouched(true);
    setNotice('');
    setError('');
    if (Object.keys(validateNickname(nickname)).length) return;
    setSaving(true);
    try {
      const envelope = await updateNickname(nickname.trim());
      const updated = envelope?.data || {};
      if (updated.nickname !== undefined) patchUser({ nickname: updated.nickname });
      setNotice(envelope?.message || 'Nickname updated.');
    } catch (err) {
      setError(getBackendMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteOwnAccount();
      await logout();
      navigate('/register', { replace: true });
    } catch (err) {
      setDeleteError(getBackendMessage(err));
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Profile"
        sub="Your identity as stored on the server."
      />

      <Card title="Account details" sub="Read-only — the backend offers no other profile edits.">
        <dl className="kv">
          <dt>Username</dt>
          <dd>{user?.username ?? '—'}</dd>
          <dt>Email</dt>
          <dd>{user?.email ?? '—'}</dd>
          <dt>Role</dt>
          <dd><Badge>{user?.role ?? '—'}</Badge></dd>
          <dt>Verified</dt>
          <dd>{user?.isVerified ? 'Yes' : 'No'}</dd>
          <dt>Member ID</dt>
          <dd>{statusQuery.data?.subscription?.memberId ?? user?.memberId ?? '—'}</dd>
        </dl>
      </Card>

      <Card title="Nickname" sub="The only profile field the backend lets you change.">
        <Alert kind="success">{notice}</Alert>
        <Alert>{error}</Alert>
        <form onSubmit={onSaveNickname} noValidate>
          <TextInput
            id="profile-nickname"
            label="Nickname"
            autoComplete="nickname"
            placeholder="How should coaches address you?"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            error={nickErrors.nickname}
            required
          />
          <Button type="submit" loading={saving}>
            {saving ? 'Saving…' : 'Save nickname'}
          </Button>
        </form>
      </Card>

      <Card
        title="Delete account"
        sub="The server allows deletion only for BASIC accounts with no active subscription and no pending payment."
      >
        <Alert>{deleteError}</Alert>
        {statusQuery.data && !statusQuery.data.subscription && (
          <p className="card-sub">No active subscription on record.</p>
        )}
        <Button
          variant="ghost"
          type="button"
          onClick={() => {
            setDeleteError('');
            setConfirmingDelete(true);
          }}
        >
          Delete my account…
        </Button>
        <p className="card-sub" style={{ marginBottom: 0 }}>
          Prefer to keep training? <Link to="/subscriptions">Browse plans</Link>
        </p>
      </Card>

      {confirmingDelete && (
        <Modal title="Delete account?" onClose={() => setConfirmingDelete(false)}>
          <p className="card-sub">
            Your account will be archived by the server. This cannot be undone.
            If the server refuses (active subscription or pending payment), its
            reason will be shown.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button size="sm" type="button" loading={deleting} onClick={onDelete}>
              {deleting ? 'Deleting…' : 'Yes, delete it'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
