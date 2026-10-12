import { useEffect, useState } from 'react';
import { getBackendMessage } from '../api/errors.js';

// Minimal GET-state hook: { data, error, loading, reload }.
// Backend remains authoritative; this only manages UX state.
export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.resolve()
      .then(fetcher)
      .then((envelope) => {
        if (!cancelled) setData(envelope?.data ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(getBackendMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}
