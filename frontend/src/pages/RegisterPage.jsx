import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { getBackendMessage, getFieldErrors } from '../api/errors.js';
import { validateRegister } from '../utils/validation.js';
import { Alert, Button, TextInput } from '../components/ui.jsx';
import { AuthShell, AuthFoot } from './AuthShell.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [touched, setTouched] = useState(false);
  const [serverFields, setServerFields] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clientErrors = touched ? validateRegister(form) : {};
  const errors = { ...clientErrors, ...serverFields };

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setTouched(true);
    setError('');
    setSuccess('');
    setServerFields({});
    if (Object.keys(validateRegister(form)).length) return;
    setLoading(true);
    try {
      const { message } = await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setSuccess(
        message ||
          'Account created. Check your email for the verification link.'
      );
      setTimeout(() => navigate('/verify-email', { replace: true }), 1600);
    } catch (err) {
      setServerFields(getFieldErrors(err));
      setError(getBackendMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      heroClass="kb-2"
      eyebrow="Join IronPulse"
      title="Your strongest self starts here."
      sub="Create an account, verify your email, and start training with elite coaches."
    >
      <h2>Create account</h2>
      <p className="auth-sub">Register → Verify email → Login → Home.</p>

      <Alert kind="success">{success}</Alert>
      <Alert>{error}</Alert>

      <form onSubmit={onSubmit} noValidate>
        <TextInput
          id="reg-username"
          label="Username"
          autoComplete="username"
          placeholder="e.g. omar_trains"
          value={form.username}
          onChange={(e) => setField('username', e.target.value)}
          error={errors.username}
          hint="4–32 characters."
          required
        />
        <TextInput
          id="reg-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          error={errors.email}
          required
        />
        <TextInput
          id="reg-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="Minimum 8 characters"
          value={form.password}
          onChange={(e) => setField('password', e.target.value)}
          error={errors.password}
          hint="At least 8 characters."
          required
        />
        <Button type="submit" loading={loading}>
          {loading ? 'Creating account…' : 'Register'}
        </Button>
      </form>

      <div className="form-foot">
        <span>
          Already verified? <Link to="/login">Login</Link>
        </span>
        <AuthFoot
          to="/verify-email"
          prompt="Registered but not verified?"
          cta="Verify your email"
        />
      </div>
    </AuthShell>
  );
}
