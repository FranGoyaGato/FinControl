# Test Credentials

## Admin (single-user seed)
- **Email**: see `ADMIN_EMAIL` in `/app/backend/.env`
- **Password**: see `ADMIN_PASSWORD` in `/app/backend/.env`
- **Role**: admin (only user in the app)

Both values live only in `/app/backend/.env` (git-ignored via `*.env`, `.env`, `.env.*`). Any agent or tooling that needs them must read them from there rather than being hard-coded anywhere else.

Seeded idempotently on backend startup: if the user already exists the seed step does NOT overwrite the password hash — a rotated password (via `/api/auth/change-password` or Settings → Seguridad) survives restarts even if `.env` still holds the original value.

## Auth endpoints
- `POST /api/auth/login` → body `{email, password}` → `{token, user}` on success
- `POST /api/auth/logout` → clears session client-side
- `GET  /api/auth/me` → current user (requires `Authorization: Bearer <token>`)
- `POST /api/auth/change-password` → body `{current_password, new_password}` (auth required)

## Token
- JWT (HS256), 30-day expiry.
- Frontend stores in `localStorage` under key `auth_token` and attaches as `Authorization: Bearer` via axios interceptor.

## Reading the seed values locally (agent use)
```bash
grep -E '^(ADMIN_EMAIL|ADMIN_PASSWORD)=' /app/backend/.env
```
