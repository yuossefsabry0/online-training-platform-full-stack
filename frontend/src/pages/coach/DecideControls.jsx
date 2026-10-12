import { useState } from 'react';
import { decidePayment } from '../../api/coachApi.js';
import { getBackendMessage } from '../../api/errors.js';
import { validateDecide } from '../../utils/validation.js';
import { Alert, Button, TextInput } from '../../components/ui.jsx';

// Approve / reject controls for a PENDING request. The backend re-checks
// capacity, conflicts and request state — the UI only collects the decision
// and an optional note, then reports the server verdict.
export default function DecideControls({ paymentId, onDecided, compact = false }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function decide(action) {
    const errs = validateDecide({ action, note: note.trim() });
    if (Object.keys(errs).length) {
      setError(errs.action || errs.note);
      return;
    }
    setBusy(action);
    setError('');
    setDone('');
    try {
      const envelope = await decidePayment(paymentId, {
        action,
        note: note.trim() || undefined,
      });
      const status = envelope?.data?.status || (action === 'approve' ? 'APPROVED' : 'REJECTED');
      setDone(envelope?.message || `Request ${status.toLowerCase()}.`);
      onDecided?.(status);
    } catch (err) {
      setError(getBackendMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ marginTop: compact ? '0.5rem' : '1rem' }}>
      <Alert kind="success">{done}</Alert>
      <Alert>{error}</Alert>
      <div className="field" style={{ marginBottom: '0.6rem' }}>
        <TextInput
          id={`note-${paymentId}`}
          label="Decision note (optional)"
          placeholder="Visible in the audit trail"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Button
          size="sm"
          type="button"
          loading={busy === 'approve'}
          disabled={busy !== null}
          onClick={() => decide('approve')}
        >
          Approve
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          loading={busy === 'reject'}
          disabled={busy !== null}
          onClick={() => decide('reject')}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
