# Test Credentials

## Admin (single-user seed)
- **Email**: `fgoya@laboratoriogoya.com`
- **Password**: `CMComplut3ns3`
- **Role**: admin (only user in the app)

Seeded idempotently on backend startup via `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `/app/backend/.env`.

If the user rotates the password from Settings → "Cambiar contraseña", the `.env` values will NO LONGER match — the seed step is idempotent and does NOT overwrite an existing user's hash.

## Auth endpoints
- `POST /api/auth/login` → body `{email, password}` → `{token, user}` on success
- `POST /api/auth/logout` → clears session client-side
- `GET  /api/auth/me` → current user (requires `Authorization: Bearer <token>`)
- `POST /api/auth/change-password` → body `{current_password, new_password}` (auth required)

## Token
- JWT (HS256), 30-day expiry.
- Frontend stores in `localStorage` under key `auth_token` and attaches as `Authorization: Bearer` via axios interceptor.
