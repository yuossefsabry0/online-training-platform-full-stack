import { useState } from 'react';
import {
  cancelMember,
  changeMemberPlan,
  extendMember,
  reduceMember,
} from '../../api/coachApi.js';
import { getBackendMessage } from '../../api/errors.js';
import {
  validateChangePlan,
  validateExtend,
  validateReduce,
  VALID_MONTHS,
} from '../../utils/validation.js';
import { Alert, Button, Card, Modal, TextInput } from '../../components/ui.jsx';

// Coach member-management actions. Each form submits the requested action;
// the backend enforces eligibility, durations and expiration. `onChanged`
// reloads the parent view so only server-confirmed state is shown.
export default function MemberActions({ userId, memberLabel, onChanged }) {
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [months, setMonths] = useState(1);
  const [planMonths, setPlanMonths] = useState(3);
  const [days, setDays] = useState(7);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  async function run(kind, fn) {
    setBusy(kind);
    setResult('');
    setError('');
    try {
      const envelope = await fn();
      setResult(envelope?.message || 'Done.');
      onChanged?.();
    } catch (err) {
      setError(getBackendMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function doExtend(e) {
    e.preventDefault();
    const errs = validateExtend(months);
    if (Object.keys(errs).length) return setError(errs.months);
    run('extend', () => extendMember(userId, months));
  }

  function doChangePlan(e) {
    e.preventDefault();
    const errs = validateChangePlan(planMonths);
    if (Object.keys(errs).length) return setError(errs.months);
    run('change', () => changeMemberPlan(userId, planMonths));
  }

  function doReduce(e) {
    e.preventDefault();
    const errs = validateReduce(days);
    if (Object.keys(errs).length) return setError(errs.days);
    run('reduce', () => reduceMember(userId, days));
  }

  function doCancel() {
    setConfirmingCancel(false);
    run('cancel', () => cancelMember(userId));
  }

  return (
    <div>
      <Alert kind="success">{result}</Alert>
      <Alert>{error}</Alert>

      <div className="grid-2">
        <Card title="Extend" sub="Add months on top of remaining time (1–36).">
          <form onSubmit={doExtend}>
            <TextInput
              id={`ext-${userId}`}
              label="Months"
              type="number"
              min="1"
              max="36"
              step="1"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              required
            />
            <Button type="submit" loading={busy === 'extend'}>
              Extend subscription
            </Button>
          </form>
        </Card>

        <Card title="Change plan" sub="Recompute expiry from today (replaces remaining time).">
          <form onSubmit={doChangePlan}>
            <div className="field">
              <label htmlFor={`plan-${userId}`}>New duration</label>
              <select
                id={`plan-${userId}`}
                className="input"
                value={planMonths}
                onChange={(e) => setPlanMonths(Number(e.target.value))}
              >
                {VALID_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m} month{m === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" loading={busy === 'change'}>
              Change plan
            </Button>
          </form>
        </Card>

        <Card title="Reduce" sub="Subtract days (1–1095). Zero or less ends the membership server-side.">
          <form onSubmit={doReduce}>
            <TextInput
              id={`red-${userId}`}
              label="Days"
              type="number"
              min="1"
              max="1095"
              step="1"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              required
            />
            <Button type="submit" loading={busy === 'reduce'}>
              Reduce subscription
            </Button>
          </form>
        </Card>

        <Card title="Cancel" sub="End the membership immediately (server performs full expiration).">
          <Button
            variant="ghost"
            type="button"
            disabled={busy !== null}
            onClick={() => setConfirmingCancel(true)}
          >
            Cancel membership…
          </Button>
        </Card>
      </div>

      {confirmingCancel && (
        <Modal title="Cancel membership?" onClose={() => setConfirmingCancel(false)}>
          <p className="card-sub">
            {memberLabel ? `This ends ${memberLabel}'s membership now. ` : ''}
            The server revokes the member ID, reverts the role and records history.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" type="button" onClick={() => setConfirmingCancel(false)}>
              Keep it
            </Button>
            <Button size="sm" type="button" loading={busy === 'cancel'} onClick={doCancel}>
              Yes, cancel now
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
