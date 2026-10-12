// Client-side UX validation mirroring the backend Zod contract.
// Backend remains authoritative; these only give instant feedback.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegister({ username, email, password }) {
  const errors = {};
  if (!username || username.trim().length < 4)
    errors.username = 'Username must be at least 4 characters.';
  else if (username.trim().length > 32)
    errors.username = 'Username must be at most 32 characters.';
  if (!email || !EMAIL_RE.test(email.trim()))
    errors.email = 'Enter a valid email address.';
  if (!password || password.length < 8)
    errors.password = 'Password must be at least 8 characters.';
  else if (password.length > 72)
    errors.password = 'Password must be at most 72 characters.';
  return errors;
}

export function validateLogin({ username, password }) {
  const errors = {};
  if (!username?.trim()) errors.username = 'Enter your username.';
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

export function validateEmailOnly(email) {
  const errors = {};
  if (!email || !EMAIL_RE.test(email.trim()))
    errors.email = 'Enter a valid email address.';
  return errors;
}

export function validateReset({ token, newPassword, confirm }) {
  const errors = {};
  if (!token || token.trim().length < 10)
    errors.token = 'Reset token is required.';
  if (!newPassword || newPassword.length < 8)
    errors.newPassword = 'Password must be at least 8 characters.';
  else if (newPassword.length > 72)
    errors.newPassword = 'Password must be at most 72 characters.';
  if (confirm !== undefined && newPassword !== confirm)
    errors.confirm = 'Passwords do not match.';
  return errors;
}

export function validateVerify(token) {
  const errors = {};
  if (!token || token.trim().length < 10)
    errors.token = 'Verification token is required.';
  return errors;
}

// Mirrors backend submitPaymentSchema (UX only; backend authoritative).
export function validatePayment({ holderName, reference, amount, packageName, coachNumber }) {
  const errors = {};
  if (!holderName || holderName.trim().length < 2)
    errors.holderName = 'Enter the name on the payment.';
  else if (holderName.trim().length > 80)
    errors.holderName = 'Name must be at most 80 characters.';
  if (!reference || reference.trim().length < 4)
    errors.reference = 'Payment reference is required (min 4 characters).';
  else if (reference.trim().length > 64)
    errors.reference = 'Reference must be at most 64 characters.';
  else if (!/^[A-Za-z0-9-_]+$/.test(reference.trim()))
    errors.reference = 'Reference may contain only letters, digits, dashes and underscores.';
  const n = Number(amount);
  if (amount === '' || amount == null || Number.isNaN(n) || n <= 0)
    errors.amount = 'Amount must be a positive number.';
  if (!packageName || packageName.trim().length < 2)
    errors.packageName = 'Package name is required.';
  else if (packageName.trim().length > 50)
    errors.packageName = 'Package name must be at most 50 characters.';
  if (!coachNumber || Number.isNaN(Number(coachNumber)) || Number(coachNumber) < 1)
    errors.coachNumber = 'Choose a coach.';
  return errors;
}

export function validateNickname(nickname) {
  const errors = {};
  if (!nickname || !nickname.trim()) errors.nickname = 'Nickname is required.';
  else if (nickname.trim().length > 50)
    errors.nickname = 'Nickname must be at most 50 characters.';
  return errors;
}

export const VALID_MONTHS = [1, 3, 6, 12];

// Mirrors backend coachSchemas (UX only; backend authoritative).
export function validateExtend(months) {
  const errors = {};
  const n = Number(months);
  if (!Number.isInteger(n) || n < 1 || n > 36)
    errors.months = 'Months must be a whole number between 1 and 36.';
  return errors;
}

export function validateChangePlan(months) {
  const errors = {};
  if (!VALID_MONTHS.includes(Number(months)))
    errors.months = 'Plan must be 1, 3, 6 or 12 months.';
  return errors;
}

export function validateReduce(days) {
  const errors = {};
  const n = Number(days);
  if (!Number.isInteger(n) || n < 1 || n > 365 * 3)
    errors.days = 'Days must be a whole number between 1 and 1095.';
  return errors;
}

export function validateDecide({ action, note }) {
  const errors = {};
  if (action !== 'approve' && action !== 'reject')
    errors.action = 'Choose approve or reject.';
  if (note && note.length > 255)
    errors.note = 'Note must be at most 255 characters.';
  return errors;
}

// Mirrors backend createCoachSchema / updateCoachSchema (UX only).
export function validateCoachCreate({ userId, coachNumber, name, bio, specialty, capacity }) {
  const errors = {};
  if (!userId || String(userId).trim().length < 6)
    errors.userId = 'The existing ADMIN user id is required.';
  const cn = Number(coachNumber);
  if (!Number.isInteger(cn) || cn < 1)
    errors.coachNumber = 'Coach number must be a positive whole number.';
  if (!name || name.trim().length < 2)
    errors.name = 'Name must be at least 2 characters.';
  else if (name.trim().length > 60)
    errors.name = 'Name must be at most 60 characters.';
  if (bio && bio.length > 2000)
    errors.bio = 'Bio must be at most 2000 characters.';
  if (specialty && specialty.length > 120)
    errors.specialty = 'Specialty must be at most 120 characters.';
  if (capacity !== '' && capacity != null) {
    const c = Number(capacity);
    if (!Number.isInteger(c) || c < 1)
      errors.capacity = 'Capacity must be a positive whole number, or empty for unlimited.';
  }
  return errors;
}

export function validateCoachUpdate({ bio, specialty, capacity }) {
  const errors = {};
  if (bio != null && bio.length > 2000)
    errors.bio = 'Bio must be at most 2000 characters.';
  if (specialty != null && specialty.length > 120)
    errors.specialty = 'Specialty must be at most 120 characters.';
  if (capacity !== '' && capacity != null) {
    const c = Number(capacity);
    if (!Number.isInteger(c) || c < 1)
      errors.capacity = 'Capacity must be a positive whole number, or empty for unlimited.';
  }
  return errors;
}
