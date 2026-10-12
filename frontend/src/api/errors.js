// Maps the backend error envelope to a user-friendly message.
// Success envelope: { status: "success", message, data }
// Error envelope:   { status: "error", error: { statusCode, code, message, details[] } }
export function getBackendMessage(error) {
  const err = error?.response?.data?.error;
  if (err?.message) return err.message;
  const successMsg = error?.response?.data?.message;
  if (typeof successMsg === 'string' && successMsg) return successMsg;
  const status = error?.response?.status;
  if (status === 400) return 'Please check the highlighted fields and try again.';
  if (status === 401) return 'Invalid username or password.';
  if (status === 403) return 'You do not have access. Please verify your email first.';
  if (status === 404) return 'Not found. The link may be invalid or expired.';
  if (status === 429)
    return 'Too many attempts. Please wait a few minutes and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again later.';
  return 'Something went wrong. Please try again.';
}

export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  const map = {};
  for (const item of details) {
    const field =
      item?.path?.[0] ?? item?.field ?? (typeof item?.path === 'string' ? item.path : null);
    if (field && typeof item?.message === 'string') map[field] = item.message;
  }
  return map;
}

export function getErrorCode(error) {
  return error?.response?.data?.error?.code ?? null;
}
