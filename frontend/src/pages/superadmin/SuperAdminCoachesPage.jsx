import { useState } from 'react';
import {
  createCoach,
  listAllCoaches,
  removeCoach,
  updateCoach,
} from '../../api/superAdminApi.js';
import { getBackendMessage, getFieldErrors } from '../../api/errors.js';
import {
  validateCoachCreate,
  validateCoachUpdate,
} from '../../utils/validation.js';
import { useApi } from '../../hooks/useApi.js';
import {
  Alert,
  Badge,
  Button,
  Card,
  Modal,
  PageHeader,
  StateBlock,
  TextInput,
} from '../../components/ui.jsx';

// Coach CRUD against the real endpoints. The backend enforces ADMIN-role
// users for promotion, unique numbers, strict update schema and the
// active-members guard on removal — every verdict is displayed as-is.
export default function SuperAdminCoachesPage() {
  const { data, error, loading, reload } = useApi(() => listAllCoaches());

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [banner, setBanner] = useState('');
  const [bannerError, setBannerError] = useState('');

  const coaches = data ?? [];

  function done(message) {
    setBanner(message);
    setBannerError('');
    setCreating(false);
    setEditing(null);
    setRemoving(null);
    reload();
  }

  function failed(message) {
    setBanner('');
    setBannerError(message);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Super Admin"
        title="Coach management"
        sub="Promote ADMIN users to coaches, edit profiles, remove coaches."
      />
      <Alert kind="success">{banner}</Alert>
      <Alert>{bannerError}</Alert>

      <div style={{ marginBottom: '1rem' }}>
        <Button type="button" onClick={() => setCreating(true)}>
          Add coach
        </Button>
      </div>

      <StateBlock
        loading={loading}
        error={error}
        loadingLabel="Loading coaches…"
        onRetry={reload}
        empty={data && !coaches.length ? 'No coaches yet. Add the first one above.' : null}
      >
        {!!coaches.length && (
          <div className="grid-2">
            {coaches.map((c) => (
              <Card
                key={c.coachId}
                title={`${c.name} · #${c.coachNumber}`}
                sub={c.specialty || 'General training'}
              >
                <p className="card-sub" style={{ marginTop: 0 }}>
                  {c.bio || 'No bio.'}
                </p>
                <p>
                  <Badge>{c.capacity == null ? 'Unlimited' : `Capacity ${c.capacity}`}</Badge>
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(c)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setRemoving(c)}>
                    Remove…
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </StateBlock>

      {creating && (
        <CoachCreateModal onClose={() => setCreating(false)} onDone={done} onFailed={failed} />
      )}
      {editing && (
        <CoachEditModal
          coach={editing}
          onClose={() => setEditing(null)}
          onDone={done}
          onFailed={failed}
        />
      )}
      {removing && (
        <CoachRemoveModal
          coach={removing}
          onClose={() => setRemoving(null)}
          onDone={done}
          onFailed={failed}
        />
      )}
    </div>
  );
}

function CoachCreateModal({ onClose, onDone, onFailed }) {
  const [form, setForm] = useState({
    userId: '',
    coachNumber: '',
    name: '',
    bio: '',
    specialty: '',
    capacity: '',
  });
  const [touched, setTouched] = useState(false);
  const [serverFields, setServerFields] = useState({});
  const [saving, setSaving] = useState(false);

  const errors = { ...(touched ? validateCoachCreate(form) : {}), ...serverFields };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e) {
    e.preventDefault();
    setTouched(true);
    setServerFields({});
    if (Object.keys(validateCoachCreate(form)).length) return;
    setSaving(true);
    try {
      const envelope = await createCoach({
        userId: form.userId.trim(),
        coachNumber: form.coachNumber,
        name: form.name.trim(),
        bio: form.bio.trim(),
        specialty: form.specialty.trim(),
        capacity: form.capacity,
      });
      onDone(envelope?.message || `Coach ${envelope?.data?.name || ''} created.`);
    } catch (err) {
      setServerFields(getFieldErrors(err));
      onFailed(getBackendMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal title="Add coach" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        <TextInput
          id="cc-user"
          label="ADMIN user id"
          placeholder="Existing user id with ADMIN role"
          value={form.userId}
          onChange={(e) => set('userId', e.target.value)}
          error={errors.userId}
          hint="Only users whose role is already ADMIN can be promoted."
          required
        />
        <div className="grid-2">
          <TextInput
            id="cc-num"
            label="Coach number"
            type="number"
            min="1"
            step="1"
            value={form.coachNumber}
            onChange={(e) => set('coachNumber', e.target.value)}
            error={errors.coachNumber}
            required
          />
          <TextInput
            id="cc-name"
            label="Display name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            error={errors.name}
            required
          />
        </div>
        <TextInput
          id="cc-spec"
          label="Specialty (optional)"
          value={form.specialty}
          onChange={(e) => set('specialty', e.target.value)}
          error={errors.specialty}
        />
        <TextInput
          id="cc-bio"
          label="Bio (optional)"
          value={form.bio}
          onChange={(e) => set('bio', e.target.value)}
          error={errors.bio}
        />
        <TextInput
          id="cc-cap"
          label="Capacity (optional)"
          type="number"
          min="1"
          step="1"
          placeholder="Empty = unlimited"
          value={form.capacity}
          onChange={(e) => set('capacity', e.target.value)}
          error={errors.capacity}
        />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" loading={saving}>
            Create coach
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CoachEditModal({ coach, onClose, onDone, onFailed }) {
  const [form, setForm] = useState({
    bio: coach.bio || '',
    specialty: coach.specialty || '',
    capacity: coach.capacity == null ? '' : String(coach.capacity),
  });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = touched ? validateCoachUpdate(form) : {};
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(validateCoachUpdate(form)).length) return;
    setSaving(true);
    try {
      const patch = {
        bio: form.bio,
        specialty: form.specialty,
        capacity: form.capacity === '' ? null : Number(form.capacity),
      };
      await updateCoach(coach.coachId, patch);
      onDone(`Coach ${coach.name} updated.`);
    } catch (err) {
      onFailed(getBackendMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit ${coach.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        <TextInput
          id="ce-spec"
          label="Specialty"
          value={form.specialty}
          onChange={(e) => set('specialty', e.target.value)}
          error={errors.specialty}
        />
        <TextInput
          id="ce-bio"
          label="Bio"
          value={form.bio}
          onChange={(e) => set('bio', e.target.value)}
          error={errors.bio}
        />
        <TextInput
          id="ce-cap"
          label="Capacity"
          type="number"
          min="1"
          step="1"
          placeholder="Empty = unlimited"
          value={form.capacity}
          onChange={(e) => set('capacity', e.target.value)}
          error={errors.capacity}
          hint="Only bio, specialty and capacity are editable (backend rule)."
        />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" loading={saving}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CoachRemoveModal({ coach, onClose, onDone, onFailed }) {
  const [busy, setBusy] = useState(false);

  async function onConfirm() {
    setBusy(true);
    try {
      const envelope = await removeCoach(coach.coachId);
      onDone(envelope?.message || `Coach ${coach.name} removed.`);
    } catch (err) {
      onFailed(getBackendMessage(err));
      onClose();
    }
  }

  return (
    <Modal title={`Remove ${coach.name}?`} onClose={onClose}>
      <p className="card-sub">
        Coach #{coach.coachNumber} and their plans will be deleted. The server
        refuses while active members remain linked.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={busy}>
          Keep
        </Button>
        <Button size="sm" type="button" loading={busy} onClick={onConfirm}>
          Yes, remove
        </Button>
      </div>
    </Modal>
  );
}
