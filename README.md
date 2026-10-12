# gym-api

Backend-only gym management platform: Express + Prisma 6 + MySQL + Zod v4 + JWT.
JSON responses only — no frontend, no views. Every response follows one envelope:

```jsonc
// success
{ "status": "success", "message": "...",   "data": { } }
// error
{ "status": "error", "error": { "statusCode": 409, "code": "USERNAME_TAKEN", "message": "...", "details": [] } }
```

## Quick start

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL with your MySQL creds
npx prisma migrate dev --name init
npm run seed                  # 3 coaches + super admin + 12 plans
npm start                     # http://localhost:3000
```

> The host machine has no MySQL installed yet. Install/start one (or point
> `DATABASE_URL` at any reachable MySQL), create the `gym_db` database, then run
> the migration. After that run `npm run smoke-test` in a second terminal.

### Seeded accounts (development/test only)

| Username     | Password    | Role        |
| ------------ | ----------- | ----------- |
| superadmin   | Super@123   | SUPER_ADMIN |
| ahmed (#1)   | Coach@123   | ADMIN       |
| mohamed (#2) | Coach@123   | ADMIN       |
| osama (#3)   | Coach@123   | ADMIN       |

> These credentials exist solely for local development and automated smoke
> testing. **Do not use them in production.** Override them via environment
> variables when deploying (see `.env.example`).

Coach capacity: Ahmed 30, Mohamed 25, Osama unlimited (configurable via admin API).

## API surface (`/api` prefix)

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | /health | public | liveness |
| POST | /auth/signup | public | register (BASIC, unverified) + emails verify link |
| GET/POST | /auth/verify-email | public | confirm emailed token |
| POST | /auth/login | public | rate-limited; issues access+refresh tokens (24h session) |
| POST | /auth/forgot-password | public | emails reset token |
| POST | /auth/reset-password | public | token + newPassword (the ONLY password change path) |
| POST | /auth/refresh | public* | new access token within original 24h window only |
| POST | /auth/logout | auth | blacklists access+refresh server-side |
| PATCH | /auth/profile | auth | **nickname ONLY** (strict schema) |
| DELETE | /auth/account | auth | self-delete (needs BASIC role + no pending payment); archived to deleted_accounts |
| GET | /coaches/:coachNumber | auth | public coach profile (bio/specialty) |
| GET | /subscriptions/status | auth | free plan or active plan + remaining days + expiry warning |
| GET | /subscriptions/plans | auth | 4 durations x 3 coaches, prices |
| POST | /subscriptions/confirm | auth | validates selection, one-coach rule, soft capacity check |
| POST | /payments/ | auth | submit pending request (unique reference; NEW/EXTENSION decided server-side) |
| PATCH | /payments/:id/decide | coach | approve/reject with authoritative re-checks |
| GET | /admin/payments | coach(all)/superadmin | payments log, paginated |
| GET | /members/ | coach | All Members: OWN active subscribers only, paginated |
| POST | /members/:userId/extend | coach | add months |
| POST | /members/:userId/change-plan | coach | replace duration |
| POST | /members/:userId/reduce | coach | subtract days; ≤0 triggers full expiration logic |
| POST | /members/:userId/cancel | coach | immediate expiration logic |
| GET | /admin/members/:userId/history | coach(own)/member(self)/superadmin | subscription history incl. end reason |
| GET | /contact | MEMBER only | Contact-Us data (granted on approval, removed on expiry) |
| GET | /admin/audit-log | superadmin | every admin action, paginated |
| GET/DELETE | /admin/deleted-accounts | superadmin | review/purge archived accounts |
| GET/POST/PATCH/DELETE | /admin/coaches | superadmin | coach CRUD (capacity, bio, etc.) |

\* refresh takes `{ refreshToken }`; no Bearer header needed.

## Cross-cutting implementation notes

- **Role guard** — single reusable factory `requireRole(...roles)` in
  `src/middlewares/roleGuard.js`; SUPER_ADMIN implicitly passes ADMIN gates.
  No endpoint contains its own role logic.
- **Validation & sanitization** — global sanitizer strips HTML tags/control
  chars from body/query/params before Zod schemas validate types/formats;
  Prisma parameterizes all SQL (injection-proof by construction).
- **Login lockout** — ≥5 failures per username OR per IP in 15 min ⇒ 429 for
  15 min; successful login clears the username's counter
  (`login_attempts` table).
- **Tokens** — access JWT (24h, jti) + refresh JWT (exp = login+24h exactly,
  so it cannot outlive the session). Logout writes jtis into `revoked_tokens`;
  authenticate/refresh reject revoked jtis. Deleted users fail at login and on
  every authenticated request (row gone).
- **One-coach rule** — enforced at confirmation, at payment submission, AND
  re-verified inside approval (auto-rejects if a conflict appeared while
  pending).
- **NEW vs EXTENSION** — determined ONLY from DB state server-side; client
  input cannot influence the flag.
- **Expiration logic** (single routine, both triggers): revoke member id →
  unlink coach → role MEMBER→BASIC → contact access gone → history row with
  end reason EXPIRED / CANCELLED / REDUCED_TO_ZERO. Natural expiry handled by
  the background job (`src/jobs/expiryJob.js`, sweep every 15 min) which also
  emails warnings `EXPIRY_WARNING_DAYS` (default 3) before ending.
- **Audit log** — approve/reject payment, extend/change/reduce/cancel member,
  create/update/remove coach all recorded with actor/action/target/details/timestamp.

## Verification status

- All files pass `node --check`; schema passes `prisma validate`.
- Boot test passed: health endpoint + 401 guard behavior verified live.
- Full endpoint suite: `npm run smoke-test` (re-runnable, unique usernames per
  run) — requires MySQL running + migrated + seeded.
