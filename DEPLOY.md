# FinControl — Deploy en VPS (`fran.goyainnova.com`)

Guía alineada a tu convención existente (`/opt/infra` con `goya-caddy` + `goya-mongo` compartidos, `.env.production`, `scripts/deploy.sh` con rollback automático).

- **Dominio**: `fran.goyainnova.com` (Cloudflare proxied naranja + certificado Origin)
- **Repo**: `FranGoyaGato/FinControl` — rama de deploy: `main`
- **Ruta**: `/opt/fincontrol/` (misma convención que `/opt/crm`, `/opt/webs/*`)
- **Runtime**: Docker + Docker Compose, en la misma red externa `goya_net` que tu stack de `/opt/infra`

Este repo ya incluye:
```
Dockerfile.backend         # FastAPI + uvicorn (multi-worker)
Dockerfile.frontend        # React build → Nginx alpine
frontend/nginx.conf        # SPA fallback + proxy interno /api → backend
docker-compose.yml         # backend + frontend en red goya_net
.env.example               # plantilla → se copia como .env.production en el VPS
scripts/deploy.sh          # deploy con health-check + rollback automático
scripts/backup.sh          # mongodump diario del shared goya-mongo
.github/workflows/deploy.yml   # dispara scripts/deploy.sh por SSH
.dockerignore
```

---

## 1. Cloudflare (una sola vez)

1. En `dash.cloudflare.com` → DNS de `goyainnova.com` → añade un registro **A**:
   - Name: `fran` · Value: IP pública del VPS · Proxy: **naranja (proxied)**
2. `SSL/TLS → Overview` → **Full (strict)**
3. Reutiliza el **Origin Certificate wildcard `*.goyainnova.com`** que ya usas en las otras apps. Si no lo tuvieras, créalo en `SSL/TLS → Origin Server → Create Certificate` (15 años). Los archivos ya deberían estar en el VPS en `/etc/caddy/certs/goyainnova.com.pem` y `.key` (o donde tengas montados los certs del contenedor `goya-caddy`).

---

## 2. Añadir el bloque al Caddyfile de `/opt/infra`

Edita el Caddyfile compartido que ya usas para las otras apps:

```bash
nano /opt/infra/Caddyfile
```

Añade al final:

```caddyfile
fran.goyainnova.com {
    tls /etc/caddy/certs/goyainnova.com.pem /etc/caddy/certs/goyainnova.com.key
    encode zstd gzip

    @api path /api/*
    handle @api { reverse_proxy fincontrol-backend:8001 }
    handle      { reverse_proxy fincontrol-frontend:80 }
}
```

> Las rutas de los certs deben coincidir con las que ya montas en el servicio `caddy` de `/opt/infra/docker-compose.yml`. Si en tu convención los tienes en otra ruta, ajusta.

Recarga Caddy sin reiniciar el resto:

```bash
docker exec goya-caddy caddy reload --config /etc/caddy/Caddyfile
```

Verifica que no hay errores:

```bash
docker logs --tail 40 goya-caddy
```

---

## 3. Preparar el directorio en el VPS

Como `root` (siguiendo tu convención `/opt/<app>`):

```bash
mkdir -p /opt/fincontrol
cd /opt/fincontrol
git clone https://github.com/FranGoyaGato/FinControl.git .
chmod +x scripts/*.sh
```

### 3.1. Confirmar el nombre real de la red

En el `docker-compose.yml` de FinControl la red se llama `goya_net` (como en el compose de `/opt/infra`). Confirma que es la misma con:

```bash
docker network ls | grep goya
# Debe listar algo como "infra_goya_net" o "goya_net"
```

Si el nombre real difiere (Docker antepone el proyecto compose, típicamente `infra_`), edita `docker-compose.yml`:

```yaml
networks:
  goya_net:
    external: true
    name: infra_goya_net   # ← el nombre real que devolvió `docker network ls`
```

### 3.2. Crear `.env.production`

```bash
cp .env.example .env.production
nano .env.production
```

Rellena:

```env
MONGO_URL=mongodb://goyaadmin:<PASS_QUE_YA_USAS>@goya-mongo:27017/?authSource=admin
DB_NAME=fincontrol
MONGO_CONTAINER=goya-mongo

CORS_ORIGINS=https://fran.goyainnova.com

JWT_SECRET=$(openssl rand -hex 48)     # ← ejecuta el comando y pega el resultado

ADMIN_EMAIL=fran@goyainnova.com
ADMIN_PASSWORD=<contraseña fuerte para el primer login; se rota luego desde la UI>
```

Permisos:

```bash
chmod 600 .env.production
```

> El seed del admin es **idempotente**: si más tarde rotas la contraseña desde `Configuración → Seguridad`, un `restart` NO la volverá a poner a la del `.env.production`.

### 3.3. Crear la base `fincontrol` (una única vez)

Si tu Mongo compartida ya tiene usuarios (goyaadmin), FinControl escribirá automáticamente en `fincontrol`. No hace falta crearla a mano — Mongo la crea al primer insert. Si quisieras un usuario dedicado a esta app en vez del root, podrías crearlo con:

```bash
source /opt/infra/.env.production
docker exec -it goya-mongo mongosh -u goyaadmin -p "$MONGO_ROOT_PASS" --authenticationDatabase admin <<'JS'
use fincontrol
db.createUser({
  user: "fincontrol_app",
  pwd: "<PASS_DEDICADA>",
  roles: [{ role: "readWrite", db: "fincontrol" }]
})
JS
```
…y ajustar `MONGO_URL` en `.env.production` a `mongodb://fincontrol_app:<PASS>@goya-mongo:27017/fincontrol?authSource=fincontrol`.

---

## 4. Primer despliegue manual

```bash
cd /opt/fincontrol
bash scripts/deploy.sh
```

`deploy.sh` hace: `git reset --hard origin/main` → `docker compose build --pull` → `up -d` → health-check del backend (30 × 3 s) → rollback automático si falla.

Comprueba:

```bash
docker compose --env-file .env.production ps
docker logs -f fincontrol-backend    # deberías ver "Seeded admin user ..." la primera vez
```

Y desde el navegador: **https://fran.goyainnova.com** → login con `ADMIN_EMAIL` / `ADMIN_PASSWORD` → entra a Configuración → Seguridad → **rota la contraseña**. A partir de aquí el `.env.production` queda desactualizado a propósito (bien).

---

## 5. Configurar el CI/CD (GitHub Actions)

Cada `git push` a `main` (también los que hagas desde Emergent con "Save to GitHub") dispara `.github/workflows/deploy.yml`, que se conecta por SSH al VPS y ejecuta `bash /opt/fincontrol/scripts/deploy.sh`. Si el health-check falla, el propio script hace **rollback** al commit anterior.

### 5.1. Generar clave SSH dedicada al CI

En el VPS:

```bash
ssh-keygen -t ed25519 -f /root/.ssh/fincontrol_deploy -N "" -C "github-actions@fincontrol"
cat /root/.ssh/fincontrol_deploy.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
cat /root/.ssh/fincontrol_deploy      # ← copia esto entero, incluidas las líneas BEGIN/END
```

### 5.2. Añadir 4 secretos en GitHub

`https://github.com/FranGoyaGato/FinControl/settings/secrets/actions`:

| Nombre | Valor |
|---|---|
| `VPS_HOST` | IP pública del VPS |
| `VPS_USER` | `root` |
| `VPS_SSH_PORT` | `22` (o el que uses) |
| `VPS_SSH_KEY` | Contenido completo de `/root/.ssh/fincontrol_deploy` (privada) |

### 5.3. Probar

Haz cualquier cambio menor y push:

```bash
echo "# ci-check" >> README.md
git commit -am "chore: ci sanity" && git push origin main
```

En GitHub → **Actions** → verás el workflow. En 2-3 minutos el VPS tiene el nuevo commit.

---

## 6. Backups automáticos

`scripts/backup.sh` ya volca la base `fincontrol` del contenedor compartido `goya-mongo` a `/opt/fincontrol/backups/` con retención de 30 días.

Añade a `crontab -e` en el VPS (usuario `root`):

```cron
# Backup nocturno FinControl a las 04:15
15 4 * * * /opt/fincontrol/scripts/backup.sh >> /opt/fincontrol/backups/backup.log 2>&1
```

Prueba manualmente:

```bash
mkdir -p /opt/fincontrol/backups
bash /opt/fincontrol/scripts/backup.sh
ls -lh /opt/fincontrol/backups/
```

Restore de emergencia:

```bash
source /opt/fincontrol/.env.production
docker cp /opt/fincontrol/backups/fincontrol_YYYYMMDD_HHMMSS.gz goya-mongo:/tmp/
docker exec -it goya-mongo mongorestore \
  --uri "$MONGO_URL" \
  --nsInclude "fincontrol.*" \
  --drop \
  --gzip --archive=/tmp/fincontrol_YYYYMMDD_HHMMSS.gz
```

Opcional: replica offsite a Cloudflare R2 tal y como haces con `eCRD` (`rclone` con el mismo remote `r2:` que ya usas).

---

## 7. Operación día a día

| Tarea | Comando |
|---|---|
| Logs backend en vivo | `docker logs -f fincontrol-backend` |
| Logs frontend | `docker logs -f fincontrol-frontend` |
| Deploy manual (fuerza) | `bash /opt/fincontrol/scripts/deploy.sh` |
| Rebuild sin tirar del repo | `cd /opt/fincontrol && docker compose --env-file .env.production up -d --build` |
| Rollback a un commit | `git reset --hard <hash> && docker compose --env-file .env.production up -d --build` |
| Bajar todo | `docker compose --env-file .env.production down` |
| Shell dentro del backend | `docker exec -it fincontrol-backend bash` |
| Mongo shell de fincontrol | `source /opt/fincontrol/.env.production && docker exec -it goya-mongo mongosh "$MONGO_URL"` |

---

## 8. Troubleshooting rápido

| Síntoma | Causa habitual | Fix |
|---|---|---|
| 502 Bad Gateway desde Cloudflare | `goya-caddy` no ve al `fincontrol-frontend` | Verifica que ambos están en `goya_net`: `docker network inspect goya_net \| grep -E "fincontrol\|goya-caddy"`. |
| Cloudflare 525 (SSL handshake) | Rutas TLS mal en el Caddyfile | Revisa `tls /etc/caddy/certs/...` y `docker logs goya-caddy`. |
| Backend cae con `KeyError: 'MONGO_URL'` | Falta `.env.production` o no está el `env_file` en compose | `docker compose --env-file .env.production config` |
| `deploy.sh` hace rollback una y otra vez | Backend crashea al arrancar (típicamente Mongo o JWT_SECRET) | `docker logs fincontrol-backend --tail 80` |
| GitHub Action falla `Permission denied (publickey)` | Clave/usuario/puerto mal en secretos | Prueba manual `ssh -i /root/.ssh/fincontrol_deploy root@VPS_HOST` |
| Movimientos importados no aparecen | Backend apunta a otra Mongo | `docker exec fincontrol-backend env \| grep MONGO_URL` |

---

## Checklist final

- [ ] DNS `fran.goyainnova.com` → IP VPS (Cloudflare proxied)
- [ ] Bloque `fran.goyainnova.com` en `/opt/infra/Caddyfile` y `caddy reload` OK
- [ ] Certificado Origin `*.goyainnova.com` accesible desde `goya-caddy`
- [ ] `docker network ls` confirma nombre real de la red compartida (ajustado en `docker-compose.yml` si hace falta)
- [ ] `/opt/fincontrol/.env.production` creado, `chmod 600`, con `MONGO_URL`, `JWT_SECRET` (openssl), `ADMIN_*`
- [ ] `bash scripts/deploy.sh` primer despliegue OK, `docker compose ps` muestra `fincontrol-backend` y `fincontrol-frontend` **Up**
- [ ] Login web funciona → **contraseña rotada desde UI**
- [ ] 4 secretos en GitHub (`VPS_HOST`, `VPS_USER`, `VPS_SSH_PORT`, `VPS_SSH_KEY`)
- [ ] Push de prueba a `main` → Actions verde
- [ ] Cron `scripts/backup.sh` activo y probado
