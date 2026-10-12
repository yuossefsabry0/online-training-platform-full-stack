import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { submitPayment } from '../api/paymentsApi.js';
import { getBackendMessage, getErrorCode, getFieldErrors } from '../api/errors.js';
import { validatePayment } from '../utils/validation.js';
import { setLastPayment } from '../auth/sessionStore.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Alert, Button, PageHeader, TextInput } from '../components/ui.jsx';

// Payment submission. Only backend-required fields are sent:
// holderName, reference, amount, packageName, coachNumber.
// NEW vs EXTENSION, uniqueness, capacity etc. are decided server-side.
export default function PaymentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    holderName: '',
    reference: '',
    amount: params.get('amount') || '',
    packageName: params.get('package') || '',
    coachNumber: params.get('coach') || '',
  });
  const [touched, setTouched] = useState(false);
  const [serverFields, setServerFields] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const errors = { ...(touched ? validatePayment(form) : {}), ...serverFields };

  // Price/duration/coach are FIXED by the confirmed plan selection and are
  // never user-editable here: they render as read-only summary rows below
  // and are submitted exactly as confirmed. Opening /payment without a
  // confirmed selection shows a guard instead of an editable form.
  const hasSelection = Boolean(
    (params.get('amount') ?? '') !== '' &&
      (params.get('package') ?? '').trim() !== '' &&
      (params.get('coach') ?? '') !== ''
  );

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setTouched(true);
    setError('');
    setServerFields({});
    if (Object.keys(validatePayment(form)).length) return;
    setLoading(true);
    try {
      const envelope = await submitPayment({
        holderName: form.holderName.trim(),
        reference: form.reference.trim(),
        amount: form.amount,
        packageName: form.packageName.trim(),
        coachNumber: form.coachNumber,
      });
      const receipt = {
        ...(envelope?.data || {}),
        coachNumber: Number(form.coachNumber),
        submittedAt: new Date().toISOString(),
        username: user?.username || null,
      };
      setLastPayment(receipt);
      navigate('/payment/pending', { replace: true });
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'PENDING_PAYMENT_EXISTS') {
        navigate('/payment/pending?exists=1', { replace: true });
        return;
      }
      setServerFields(getFieldErrors(err));
      setError(getBackendMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Payment"
        title="Submit payment"
        sub="Send your transfer receipt. Your coach approves it — approval is never instant or automatic."
      />
      <Alert>{error}</Alert>
      {!hasSelection && (
        <Alert kind="info">
          Choose a plan first — price and duration are fixed at selection and
          cannot be entered manually. <Link to="/subscriptions">Browse plans</Link>
        </Alert>
      )}
      {hasSelection && (
      <form onSubmit={onSubmit} noValidate style={{ maxWidth: '560px' }}>
        <dl className="kv" aria-label="Confirmed plan (fixed)">
          <dt>Package</dt>
          <dd>{form.packageName}</dd>
          <dt>Amount</dt>
          <dd>{form.amount}</dd>
          <dt>Coach</dt>
          <dd>#{form.coachNumber}</dd>
        </dl>
        <p className="field-hint" style={{ marginBottom: '1rem' }}>
          Fixed by your confirmed selection — these cannot be changed here. To
          pick something else, <Link to="/subscriptions">choose another plan</Link>.
        </p>
        <TextInput
          id="pay-holder"
          label="Account holder name"
          autoComplete="name"
          placeholder="Name on the payment account"
          value={form.holderName}
          onChange={(e) => setField('holderName', e.target.value)}
          error={errors.holderName}
          required
        />
        <TextInput
          id="pay-ref"
          label="Payment reference"
          placeholder="e.g. TXN-8F42KD"
          value={form.reference}
          onChange={(e) => setField('reference', e.target.value)}
          error={errors.reference}
          hint="Letters, digits, dashes and underscores only. Each reference can be used once."
          required
        />
        {/* Amount, package and coach travel in form state exactly as
            confirmed — there are intentionally no inputs for them. */}
        <Button type="submit" loading={loading}>
          {loading ? 'Submitting…' : 'Submit payment request'}
        </Button>
      </form>
      )}
      <div className="form-foot">
        <span>
          Already submitted? <Link to="/payment/pending">Check pending request</Link>
        </span>
      </div>
    </div>
  );
}
