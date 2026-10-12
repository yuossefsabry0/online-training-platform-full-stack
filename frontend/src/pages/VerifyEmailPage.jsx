import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { verifyEmailGet, verifyEmailPost } from '../api/authApi.js';
import { getBackendMessage } from '../api/errors.js';
import { validateVerify } from '../utils/validation.js';
import { Alert, Button, TextInput } from '../components/ui.jsx';
import { AuthShell, AuthFoot } from './AuthShell.jsx';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get('token') || '');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [autoTried, setAutoTried] = useState(false);

  const fieldErrors = touched ? validateVerify(token) : {};

  async function verify(value) {
    const t = (value || '').trim();
    setTouched(true);
    setError('');
    setSuccess('');
    if (Object.keys(validateVerify(t)).length) return;
    setLoading(true);
    try {
      // Backend accepts GET (query) and POST (body); try GET first.
      let envelope;
      try {
        envelope = await verifyEmailGet(t);
      } catch (getErr) {
        if (getErr?.response?.status === 404) {
          envelope = await verifyEmailPost(t);
        } else {
          throw getErr;
        }
      }
      setSuccess(
        envelope?.message || 'Email verified successfully. You can now log in.'
      );
      setTimeout(
        () => navigate('/login?verified=1', { replace: true }),
        1800
      );
    } catch (err) {
      setError(getBackendMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // Auto-verify when the emailed link (?token=…) opens this page.
  useEffect(() => {
    const q = params.get('token');
    if (q && !autoTried) {
      setAutoTried(true);
      verify(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthShell
      eyebrow="Email verification"
      title="One step. Then you lift."
      sub="Paste the token from your verification email, or open the emailed link directly."
    >
      <h2>Verify email</h2>
      <p className="auth-sub">
        The verification email contains a link like{' '}
        <code>/api/auth/verify-email?token=…</code> — copy the token part here.
      </p>

      <Alert kind="success">{success}</Alert>
      <Alert>{error}</Alert>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify(token);
        }}
        noValidate
      >
        <TextInput
          id="verify-token"
          label="Verification token"
          autoComplete="one-time-code"
          placeholder="Paste your token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          error={fieldErrors.token}
          required
        />
        <Button type="submit" loading={loading}>
          {loading ? 'Verifying…' : 'Verify email'}
        </Button>
      </form>

      <div className="form-foot">
        <AuthFoot
          to="/login?verified=1"
          prompt="Already verified?"
          cta="Login"
        />
        <span>
          No account yet? <Link to="/register">Register</Link>
        </span>
      </div>
    </AuthShell>
  );
}
