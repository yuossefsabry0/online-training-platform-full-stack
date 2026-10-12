import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/authApi.js';
import { getBackendMessage } from '../api/errors.js';
import { validateReset } from '../utils/validation.js';
import { Alert, Button, TextInput } from '../components/ui.jsx';
import { AuthShell, AuthFoot } from './AuthShell.jsx';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    token: params.get('token') || '',
    newPassword: '',
    confirm: '',
  });
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const errors = touched ? validateReset(form) : {};

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setTouched(true);
    setError('');
    setSuccess('');
    if (Object.keys(validateReset(form)).length) return;
    setLoading(true);
    try {
      const envelope = await resetPassword({
        token: form.token.trim(),
        newPassword: form.newPassword,
      });
      setSuccess(
        envelope?.message ||
          'Password has been reset. You can now log in with your new password.'
      );
      setTimeout(() => navigate('/login?reset=1', { replace: true }), 1800);
    } catch (err) {
      setError(getBackendMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Recovery"
      title="Set a new password."
      sub="Paste your reset token and choose a strong new password."
    >
      <h2>Reset password</h2>
      <p className="auth-sub">Reset tokens expire 1 hour after they are sent.</p>

      <Alert kind="success">{success}</Alert>
      <Alert>{error}</Alert>

      <form onSubmit={onSubmit} noValidate>
        <TextInput
          id="reset-token"
          label="Reset token"
          autoComplete="one-time-code"
          placeholder="Paste your token"
          value={form.token}
          onChange={(e) => setField('token', e.target.value)}
          error={errors.token}
          required
        />
        <TextInput
          id="reset-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="Minimum 8 characters"
          value={form.newPassword}
          onChange={(e) => setField('newPassword', e.target.value)}
          error={errors.newPassword}
          required
        />
        <TextInput
          id="reset-confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat the password"
          value={form.confirm}
          onChange={(e) => setField('confirm', e.target.value)}
          error={errors.confirm}
          required
        />
        <Button type="submit" loading={loading}>
          {loading ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>

      <div className="form-foot">
        <AuthFoot to="/login" prompt="Done?" cta="Back to login" />
      </div>
    </AuthShell>
  );
}
