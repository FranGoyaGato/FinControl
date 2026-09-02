# FinControl

Gestor personal de finanzas (Spanish, es-ES) — FastAPI + React + MongoDB.

- **Producción**: https://fran.goyainnova.com
- **Autenticación**: Email + Password (JWT)
- **Despliegue**: `/opt/fincontrol` en VPS con Docker Compose (backend + frontend + `fincontrol-mongo`), detrás de Caddy en la red `web`.
- **CI/CD**: cada push a `main` dispara `.github/workflows/deploy.yml` → SSH al VPS → `scripts/deploy.sh` (build + health-check + rollback automático).

## Características

- Import de extractos bancarios y de tarjeta (CSV, XLSX, XLS)
- CRUD de cuentas, tarjetas, categorías, subcategorías y reglas
- Motor de reglas con auto-categorización retroactiva (dedupe por `source+contains+sign`)
- Dashboard con KPIs mensuales/anuales, donut de gastos por categoría y línea de flujo neto mes a mes
- Rotación de contraseña desde Configuración → Seguridad
- Formato de moneda es-ES en toda la UI (`1.339,71 €`)

## Documentación

- **Deploy paso a paso**: ver [`DEPLOY.md`](./DEPLOY.md)
- **Snippet Caddy**: [`infra/fran.caddy`](./infra/fran.caddy)
- **Scripts de operación**: [`scripts/deploy.sh`](./scripts/deploy.sh), [`scripts/backup.sh`](./scripts/backup.sh)

## Stack

| Capa | Tecnología |
|---|---|
| Backend | FastAPI + uvicorn + motor (Mongo async) |
| Auth | JWT (HS256, 30 días) + bcrypt |
| Frontend | React 19 + Tailwind + shadcn/ui + recharts |
| Base de datos | MongoDB 7 con volumen persistente |
| Proxy | Caddy (Let's Encrypt automático) |
| Runtime | Docker Compose |
| CI/CD | GitHub Actions (SSH deploy con rollback) |
