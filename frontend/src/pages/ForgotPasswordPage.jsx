import { useState } from 'react';
import { forgotPassword } from '../api/authApi.js';
import { getBackendMessage } from '../api/errors.js';
import { validateEmailOnly } from '../utils/validation.js';
import { Alert, Button, TextInput } from '../components/ui.jsx';
import { AuthShell, AuthFoot } from './AuthShell.jsx';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fieldErrors = touched ? validateEmailOnly(email) : {};

  async function onSubmit(e) {
    e.preventDefault();
    setTouched(true);
    setError('');
    setSuccess('');
    if (Object.keys(validateEmailOnly(email)).length) return;
    setLoading(true);
    try {
      // Generic response by design (no account enumeration) — show it as-is.
      const envelope = await forgotPassword(email.trim());
      setSuccess(
        envelope?.message ||
          'If that email is registered, a password reset link has been sent.'
      );
    } catch (err) {
      setError(getBackendMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      heroClass="kb-2"
      eyebrow="Recovery"
      title="Forgot your password?"
      sub="Enter your account email and we will send you a reset token, valid for 1 hour."
    >
      <h2>Forgot password</h2>
      <p className="auth-sub">We never reveal whether an email is registered.</p>

      <Alert kind="success">{success}</Alert>
      <Alert>{error}</Alert>

      <form onSubmit={onSubmit} noValidate>
        <TextInput
          id="forgot-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          required
        />
        <Button type="submit" loading={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <div className="form-foot">
        <AuthFoot
          to="/reset-password"
          prompt="Already have a reset token?"
          cta="Reset password"
        />
        <AuthFoot to="/login" prompt="Remembered it?" cta="Back to login" />
      </div>
    </AuthShell>
  );
}
