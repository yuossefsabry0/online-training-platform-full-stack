// Role-awareness foundation (UX/navigation only — never security).
// Backend roles: BASIC | MEMBER | ADMIN | SUPER_ADMIN.
// Backend authorization remains authoritative; these helpers only decide
// which frontend routes/sections to show.

export const ROLES = Object.freeze({
  BASIC: 'BASIC',
  MEMBER: 'MEMBER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
});

const RANK = {
  BASIC: 0,
  MEMBER: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function roleRank(role) {
  return RANK[role] ?? -1;
}

export function hasRole(user, ...allowed) {
  if (!user?.role) return false;
  // SUPER_ADMIN implicitly passes ADMIN gates (mirrors backend roleGuard).
  if (user.role === ROLES.SUPER_ADMIN && allowed.includes(ROLES.ADMIN)) return true;
  return allowed.includes(user.role);
}

export function hasMinRole(user, minimum) {
  return roleRank(user?.role) >= roleRank(minimum);
}

// Navigation model. TASK 2 BASIC/MEMBER experience + TASK 3 coach areas.
// Frontend navigation is UX only — backend authorization is authoritative.
export function getNavForRole(role) {
  const basic = [
    { to: '/home', label: 'Home', roles: null },
    { to: '/coaches', label: 'Coaches', roles: null },
    { to: '/subscriptions', label: 'Subscriptions', roles: null },
    { to: '/my-subscription', label: 'My Subscription', roles: null },
    { to: '/profile', label: 'Profile', roles: null },
  ];
  const memberExtra = [
    { to: '/contact', label: 'Contact Us', roles: null },
  ];
  // NOTE: the member "History" page is intentionally NOT listed here. The
  // backend route guard (requireRole('ADMIN')) rejects BASIC/MEMBER callers
  // with 403 even for their own history, so exposing it in member
  // navigation only leads to an error. The /subscription-history route
  // itself is kept (with its honest error state) in case backend
  // self-access is ever granted.
  // TASK 3 coach navigation (ADMIN; SUPER_ADMIN passes ADMIN gates too —
  // per-endpoint backend enforcement still applies, e.g. coach profile).
  const coachNav = [
    { to: '/coach/dashboard', label: 'Dashboard', roles: null },
    { to: '/coach/members', label: 'Members', roles: null },
    { to: '/coach/payment-requests', label: 'Requests', roles: null },
    { to: '/coach/payments', label: 'Payments', roles: null },
    { to: '/coach/subscription-history', label: 'Histories', roles: null },
    { to: '/profile', label: 'Profile', roles: null },
  ];
  // TASK 4 SUPER_ADMIN navigation. Backend authorization authoritative.
  const superAdminNav = [
    { to: '/super-admin/dashboard', label: 'Dashboard', roles: null },
    { to: '/super-admin/coaches', label: 'Coaches', roles: null },
    { to: '/super-admin/payments', label: 'Payments', roles: null },
    { to: '/super-admin/deleted-accounts', label: 'Deleted', roles: null },
    { to: '/super-admin/audit-logs', label: 'Audit', roles: null },
    { to: '/profile', label: 'Profile', roles: null },
  ];
  if (role === ROLES.MEMBER) return [...basic, ...memberExtra];
  if (role === ROLES.BASIC) return basic;
  if (role === ROLES.ADMIN) return coachNav;
  if (role === ROLES.SUPER_ADMIN) return superAdminNav;
  return [{ to: '/home', label: 'Home', roles: null }];
}
