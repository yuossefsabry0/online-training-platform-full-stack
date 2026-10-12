import { Link } from 'react-router-dom';

// Shared split-screen shell: gym imagery + overlay on the left,
// form content on the right. Keeps every auth page visually consistent.
export function AuthShell({ eyebrow, title, sub, heroClass = '', children }) {
  return (
    <div className="auth-wrap">
      <div className={`auth-hero ${heroClass}`} aria-hidden="true">
        <div>
          <span className="auth-hero-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{sub}</p>
          <div className="auth-hero-stats">
            <div>
              <strong>24h</strong>
              <span>Secure sessions</span>
            </div>
            <div>
              <strong>3</strong>
              <span>Elite coaches</span>
            </div>
            <div>
              <strong>12</strong>
              <span>Training plans</span>
            </div>
          </div>
        </div>
      </div>
      <div className="auth-panel">{children}</div>
    </div>
  );
}

export function AuthFoot({ to, cta, prompt }) {
  return (
    <div className="form-foot">
      <span>
        {prompt} <Link to={to}>{cta}</Link>
      </span>
    </div>
  );
}
