import client from './client.js';

// Coach browsing. NOTE: the backend exposes no coach LIST endpoint —
// `listCoaches` exists server-side but is only wired to SUPER_ADMIN routes.
// The plans endpoint below is the real source of coach data for regular
// users (coachNumber, coachName, specialty, capacity + plans).
// Detail: GET /coaches/:coachNumber (any authenticated role) ->
//   { coachId, coachNumber, name, bio, specialty }

export async function getCoachProfile(coachNumber) {
  const res = await client.get(`/coaches/${encodeURIComponent(coachNumber)}`);
  return res.data;
}
