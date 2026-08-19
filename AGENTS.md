# AGENTS.md — Fincontrol (repo de código)

Repo de código de «Fincontrol». Se orquesta desde su meta-repo (la carpeta padre; ver
`repos.yaml` allí). Aquí solo vive el código de la aplicación.

## Comandos (literales, probados; los usa el método en cada cierre)

| Para… | Comando |
|---|---|
| Levantar el entorno desde cero | `cp .env.example .env && docker compose up` |
| Correr la suite completa | `scripts/ci/full-suite` |
| Correr los linters | `scripts/ci/lint` |
| Lanzar una instancia para que la use el usuario | `docker compose up` → `http://localhost:3000` (frontend) / `http://localhost:8000/api` (backend) |
| Comprobación de seguridad | `scripts/ci/security` |
| Parar / limpiar | `docker compose down` (añade `-v` para borrar también los datos de Mongo) |

## Qué necesita esta máquina

- **Docker** con Docker Compose v2 (`docker compose version`). En Windows, Docker Desktop
  necesita WSL2 instalado.
- **Python 3.11+** y **Node 22+** con **corepack** habilitado (`corepack enable`) — hacen
  falta para correr `scripts/ci/full-suite`/`lint`/`security` fuera de Docker (los tests
  corren contra el Mongo de Docker, pero pytest/jest se ejecutan en el host, no dentro de un
  contenedor, para no tener que reconstruir la imagen en cada iteración).
- Todo esto lo confirma `python3 docs/00-metodo/scripts/doctor.py` desde el meta-repo. Si algo
  de aquí no aparece en verde ahí, no es una dependencia: es un problema.

## Estructura

- `backend/` — API FastAPI, un único fichero `server.py` (todos los modelos y rutas) +
  `tests/` (pytest, caracterización del comportamiento actual).
- `frontend/` — React 19 + CRA/craco + shadcn/ui. `src/pages/` una página por actividad,
  `src/components/ui/` los componentes shadcn. Tests de humo en `src/App.test.js` y
  `src/pages/pages.smoke.test.js`.
- `docker-compose.yml` (raíz) — los tres servicios: `mongo`, `backend`, `frontend`.
- `scripts/ci/` — los tres guardianes: `full-suite`, `lint`, `security`.

## Reglas de este repo

- Los secretos van en `.env` (fuera de git, plantilla en `.env.example`) y **el `.env` está en
  `.dockerignore`**: un secreto horneado en una imagen es un secreto publicado.
- Los tests se escriben antes que el código y no se debilitan para que pase la suite.
- Los scripts de `scripts/ci/` preparan su entorno, usan herramientas fijadas y propagan
  cualquier rojo. Prohibido `|| true` o dar verde por no encontrar tests.
- `.github/workflows/tests.yml` ejecuta la suite en pull requests; `quality-security.yml`
  ejecuta lint y seguridad en paralelo en pull requests, al entrar en `main` y semanalmente.
  `.github/dependabot.yml` propone las actualizaciones normales.

## Deuda conocida (heredada de la adopción, sin cerrar por esta unidad)

- **`backend/server.py` y `frontend/src/{pages,components}` no están cubiertos por
  `scripts/ci/lint`.** Es código heredado de antes de esta unidad, con deuda real de formato
  (black), estilo (flake8/eslint) y tipos (mypy) ya medida — no se ha tocado su contenido
  (cero cambio de comportamiento). `scripts/ci/lint` solo exige limpio lo que esta unidad
  posee (`backend/tests/`, los tests y config nuevos del frontend). Candidata a una unidad de
  limpieza de formato, bajo riesgo.
- **`scripts/ci/security` encuentra vulnerabilidades reales en dependencias ya fijadas antes
  de esta unidad** (decenas de CVEs en el backend — black, urllib3, cryptography, starlette,
  pyjwt, requests, python-multipart, entre otras — y ~24 en la cadena de build de
  `react-scripts` en el frontend). Es la primera medición, no algo que esta unidad introduce;
  el job `security` de `quality-security.yml` corre con `continue-on-error` hasta que una
  unidad dedicada de actualización de dependencias la cierre. No se ha actualizado nada aquí
  para no arriesgar comportamiento sin red de tests que lo cubra.
- Sin bloque E2E: `docs/02-flujos/planos/planos.json` no declara `pruebas_e2e`.
