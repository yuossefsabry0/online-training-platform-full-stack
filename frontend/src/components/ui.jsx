import { useState } from 'react';

export function Button({
  children,
  variant = 'primary',
  size = '',
  loading = false,
  ...props
}) {
  const cls = `btn btn-${variant}${size ? ` btn-${size}` : ''}`;
  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function TextInput({ label, hint, error, id, ...props }) {
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        className="input"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        }
        {...props}
      />
      {error && (
        <span id={`${id}-error`} role="alert" className="field-error">
          {error}
        </span>
      )}
      {!error && hint && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${kind}`} role="alert">
      {children}
    </div>
  );
}

export function Card({ title, sub, children }) {
  return (
    <section className="card">
      {title && <h3 className="card-title">{title}</h3>}
      {sub && <p className="card-sub">{sub}</p>}
      {children}
    </section>
  );
}

export function Badge({ tone = '', children }) {
  return <span className={`badge${tone ? ` badge-${tone}` : ''}`}>{children}</span>;
}

export function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="full-loader" role="status" aria-live="polite">
      <span className="spinner spinner-light" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="card-title">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function SessionCountdown({ expiresAt }) {
  const [now] = useState(() => Date.now());
  void now;
  if (!expiresAt) return null;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return null;
  const ms = t - Date.now();
  if (ms <= 0) return <span>Session ended — please log in again.</span>;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return (
    <span>
      Session ends in {h}h {m}m
    </span>
  );
}

// Page heading block shared by feature pages.
export function PageHeader({ eyebrow, title, sub }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {eyebrow && <span className="auth-hero-eyebrow">{eyebrow}</span>}
      <h1
        style={{
          margin: '0.4rem 0 0.3rem',
          fontSize: 'clamp(1.4rem, 3vw, 2rem)',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h1>
      {sub && <p className="card-sub" style={{ margin: 0 }}>{sub}</p>}
    </div>
  );
}

// Consistent loading / error / empty states for API-driven pages.
export function StateBlock({ loading, error, empty, loadingLabel, onRetry, children }) {
  if (loading) {
    return (
      <div className="full-loader" role="status" aria-live="polite">
        <span className="spinner spinner-light" aria-hidden="true" />
        <span>{loadingLabel || 'Loading…'}</span>
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <Alert kind="error">{error}</Alert>
        {onRetry && (
          <Button variant="ghost" size="sm" type="button" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }
  if (empty) {
    return <Alert kind="info">{empty}</Alert>;
  }
  return children;
}

// Backend-pagination controls. `pagination` is the server's
// { page, pageSize, total, totalPages } object — never computed locally.
export function Pagination({ pagination, onPage, onPageSize }) {
  if (!pagination) return null;
  const { page, pageSize, total, totalPages } = pagination;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
        marginTop: '1rem',
      }}
    >
      <span className="card-sub" style={{ margin: 0 }}>
        Showing {from}–{to} of {total}
      </span>
      <span style={{ flex: 1 }} />
      {onPageSize && (
        <label className="card-sub" style={{ margin: 0 }}>
          Per page:{' '}
          <select
            className="input"
            style={{ width: 'auto', display: 'inline-block', padding: '0.35rem 0.5rem' }}
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {[5, 10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button
        variant="ghost"
        size="sm"
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        ← Prev
      </Button>
      <span className="card-sub" style={{ margin: 0 }}>
        Page {page} of {Math.max(totalPages, 1)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next →
      </Button>
    </div>
  );
}

// Status pill for payment lifecycles (backend-provided statuses only).
export function PaymentStatusBadge({ status }) {
  const tone = status === 'APPROVED' ? 'accent' : status === 'PENDING' ? '' : 'admin';
  return <Badge tone={tone}>{status}</Badge>;
}
