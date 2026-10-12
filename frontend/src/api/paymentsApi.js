import client from './client.js';

// Payment submission (any authenticated role).
// POST /payments/ { holderName, reference, amount, packageName, coachNumber }
//   -> 201 { id, status, isExtension, packageName, amount }
// NEW vs EXTENSION, reference uniqueness, pending-payment and capacity rules
// are all decided server-side.
// NOTE: the backend exposes NO endpoint for a regular user to list their own
// payment requests (GET /payments is ADMIN-only). The "pending" view is
// therefore built from the 201 submission receipt returned by the backend
// (stored client-side in sessionStorage), plus backend conflict signals
// such as PENDING_PAYMENT_EXISTS on re-submit. Nothing is fabricated.

export async function submitPayment(payload) {
  const res = await client.post('/payments/', {
    holderName: payload.holderName,
    reference: payload.reference,
    amount: Number(payload.amount),
    packageName: payload.packageName,
    coachNumber: Number(payload.coachNumber),
  });
  return res.data;
}
