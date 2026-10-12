import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getBackendMessage, getErrorCode } from '../api/errors.js';
import { validateLogin } from '../utils/validation.js';
import { Alert, Button, TextInput } from '../components/ui.jsx';
import { AuthShell, AuthFoot } from './AuthShell.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const params = new URLSearchParams(location.search);
  const [notice, setNotice] = useState(
    location.state?.notice ||
      (params.get('verified')
        ? 'Email verified. Log in with your credentials.'
        : params.get('reset')
          ? 'Password reset. Log in with your new password.'
          : '')
  );

  const fieldErrors = touched ? validateLogin(form) : {};

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setTouched(true);
    setError('');
    setNotice('');
    const errs = validateLogin(form);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      await login({ username: form.username.trim(), password: form.password });
      navigate(location.state?.from || '/home', { replace: true });
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'EMAIL_NOT_VERIFIED') {
        setError(
          'Email not verified yet. Check your inbox for the verification link, then verify below.'
        );
      } else {
        setError(getBackendMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Train harder. Track smarter."
      sub="Log in to your IronPulse account to manage your training journey."
    >
      <h2>Login</h2>
      <p className="auth-sub">Your session stays active for 24 hours.</p>

      <Alert kind="success">{notice}</Alert>
      <Alert>{error}</Alert>
      {error.includes('not verified') && (
        <p className="auth-sub">
          <Link to="/verify-email">Go to email verification →</Link>
        </p>
      )}

      <form onSubmit={onSubmit} noValidate>
        <TextInput
          id="login-username"
          label="Username"
          autoComplete="username"
          placeholder="your-username"
          value={form.username}
          onChange={(e) => setField('username', e.target.value)}
          error={fieldErrors.username}
          required
        />
        <TextInput
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={form.password}
          onChange={(e) => setField('password', e.target.value)}
          error={fieldErrors.password}
          required
        />
        <Button type="submit" loading={loading}>
          {loading ? 'Logging in…' : 'Login'}
        </Button>
      </form>

      <div className="form-foot">
        <Link to="/forgot-password">Forgot your password?</Link>
        <AuthFoot to="/register" prompt="New here?" cta="Create an account" />
      </div>
    </AuthShell>
  );
}
