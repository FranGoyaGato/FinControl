# FinControl — Deploy en VPS (`fran.goyainnova.com`)

Guía paso a paso para desplegar la app en tu VPS, siguiendo la convención `/opt/<app>` que ya usas (`contagoya`, `crm-evaclin`, `crmexternos`, `infra`), con Caddy como proxy inverso, Cloudflare Origin certs y un Mongo compartido que ya corre en el servidor.

- **Dominio**: `fran.goyainnova.com` (Cloudflare, naranja/proxied)
- **Repo**: `FranGoyaGato/FinControl`
- **Rama de deploy**: `main` (cada push dispara GitHub Actions)
- **Ruta**: `/opt/fincontrol`
- **Runtime**: Docker + Docker Compose

---

## 0. Prerrequisitos

En el VPS:
- Docker + Docker Compose plugin (`docker compose ...`)
- Caddy corriendo (contenedor o host)
- Mongo compartido accesible (contenedor o instancia)
- `git`

En tu portátil:
- Acceso SSH al VPS
- Cuenta de GitHub con permisos de admin sobre `FranGoyaGato/FinControl`

---

## 1. Cloudflare (una vez)

1. **DNS**: en Cloudflare, crea un registro `A` para `fran` apuntando a la IP pública del VPS. **Proxy activado (naranja)**.
2. **SSL/TLS mode**: en `SSL/TLS → Overview` deja **Full (strict)**.
3. **Origin Certificate** (si aún no tienes uno *wildcard* para `*.goyainnova.com`):
   - `SSL/TLS → Origin Server → Create Certificate`
   - Common names: `*.goyainnova.com` y `goyainnova.com`
   - Validez: 15 años → **Create**
   - Copia el **Certificate** y la **Private Key** — las pegarás en el VPS en el siguiente paso.
4. Si ya usas un wildcard para las otras apps, **salta este paso** y reutilízalo.

---

## 2. Preparar el VPS

Todo como `root` (siguiendo tu convención). Ajusta rutas si tu Caddy vive en otro sitio.

### 2.1. Certificado Origin

```bash
mkdir -p /etc/caddy/certs
# Pega el contenido del Certificate y la Key en estos dos ficheros:
nano /etc/caddy/certs/goyainnova.com.pem   # certificado
nano /etc/caddy/certs/goyainnova.com.key   # clave privada
chmod 600 /etc/caddy/certs/goyainnova.com.*
```

Si Caddy corre dentro de un contenedor, monta ese directorio como volumen (o usa la ruta ya existente en tu `caddy` compose).

### 2.2. Añadir el bloque en el Caddyfile

Edita el `Caddyfile` que ya usas para las otras apps (típicamente `/opt/infra/Caddyfile` o `/etc/caddy/Caddyfile`) y añade:

```caddyfile
fran.goyainnova.com {
    tls /etc/caddy/certs/goyainnova.com.pem /etc/caddy/certs/goyainnova.com.key

    encode zstd gzip

    # Reenvía todo (SPA + /api/*) al contenedor del frontend,
    # que a su vez proxifica /api/* al backend por su red interna.
    reverse_proxy fincontrol-frontend:80 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

> Para que Caddy pueda resolver `fincontrol-frontend` por nombre, el contenedor de Caddy y el `frontend` de FinControl deben estar en la **misma red Docker externa**. Descubre el nombre exacto con:
> ```bash
> docker inspect $(docker ps --filter name=caddy -q) | grep -A3 Networks
> ```
> El nombre suele ser `caddy`, `proxy` o `web`. Anótalo — lo usarás en `docker-compose.yml`.

Recarga Caddy:
```bash
# Si Caddy corre en contenedor:
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
# O reinicia el compose de tu carpeta infra:
docker compose -f /opt/infra/docker-compose.yml restart caddy
```

### 2.3. Red Docker compartida

En `/opt/fincontrol/docker-compose.yml` (que se clonará desde el repo) verás:

```yaml
networks:
  caddy:
    external: true
```

Si el nombre real de tu red **no** es `caddy`, edita esa clave a la que anotaste arriba **antes del primer despliegue** (haz commit del cambio o edítalo en el VPS y vuelve a levantar).

### 2.4. Mongo compartido

Necesito que decidas cómo conectas al Mongo existente:

- **Opción A — Mongo en Docker**: descubre el nombre de su contenedor y de su red:
  ```bash
  docker ps --format 'table {{.Names}}\t{{.Networks}}' | grep -i mongo
  ```
  Añade esa red a `docker-compose.yml` bajo `backend.networks` y bajo `networks:` como `external: true`. La cadena de conexión será algo como `mongodb://<usuario>:<password>@<nombre_contenedor>:27017`.

- **Opción B — Mongo escuchando en un puerto/IP**: usa la IP privada del VPS o `host.docker.internal` (Linux: añade `extra_hosts: ["host.docker.internal:host-gateway"]` al servicio backend). La cadena típica: `mongodb://user:pass@10.0.0.X:27017`.

Anota la cadena — la pondrás en `.env` en el paso 3.3.

### 2.5. Crear el directorio y clonar

```bash
mkdir -p /opt/fincontrol
cd /opt/fincontrol
git clone https://github.com/FranGoyaGato/FinControl.git .
```

### 2.6. Clave SSH de deploy (para GitHub Actions)

Genera un par de claves **dedicado** a este deploy (no reutilices la tuya personal):

```bash
ssh-keygen -t ed25519 -f /root/.ssh/fincontrol_deploy -N "" -C "github-actions@fincontrol"
cat /root/.ssh/fincontrol_deploy.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
```

Guarda el **contenido de la clave privada** para el paso 4:
```bash
cat /root/.ssh/fincontrol_deploy
```
(la clave pública ya está autorizada — la privada solo la usa GitHub Actions).

---

## 3. Configurar `.env` en el VPS

**Nunca** subas `.env` al repo (`.gitignore` lo excluye). Se crea a mano en el VPS.

### 3.1. Generar JWT secret

```bash
openssl rand -hex 48
```
Cópialo, lo pegas abajo.

### 3.2. Copiar plantilla

```bash
cd /opt/fincontrol
cp .env.example .env
nano .env
```

### 3.3. Rellenar los campos

```env
MONGO_URL=mongodb://usuario:pass@nombre_contenedor_mongo:27017
DB_NAME=fincontrol
CORS_ORIGINS=https://fran.goyainnova.com
JWT_SECRET=<pega aquí el hex que generó openssl>
ADMIN_EMAIL=fran@goyainnova.com          # o el que quieras semillar
ADMIN_PASSWORD=<contraseña fuerte>       # rotable después desde Config → Seguridad
```

Permisos:
```bash
chmod 600 .env
```

---

## 4. Secretos en GitHub (una vez)

En `https://github.com/FranGoyaGato/FinControl/settings/secrets/actions` añade estos 4 **Repository secrets**:

| Nombre | Valor |
|---|---|
| `VPS_HOST` | La IP pública o el hostname del VPS (ej. `aplicativos.tudominio.com` o `1.2.3.4`) |
| `VPS_USER` | `root` (según tu convención actual) |
| `VPS_SSH_PORT` | `22` (o el puerto SSH que uses) |
| `VPS_SSH_KEY` | **Contenido completo** de `/root/.ssh/fincontrol_deploy` (privada), incluido `-----BEGIN OPENSSH PRIVATE KEY-----` y `-----END OPENSSH PRIVATE KEY-----` |

---

## 5. Primer despliegue

Desde el VPS, en `/opt/fincontrol`:

```bash
cd /opt/fincontrol
docker compose build --pull
docker compose up -d
docker compose ps
```

Comprueba logs:
```bash
docker compose logs -f backend    # deberías ver "Seeded admin user ..." la primera vez
docker compose logs -f frontend
```

Verifica desde el propio VPS:
```bash
curl -I http://fincontrol-frontend                # 200 desde la red caddy
docker exec fincontrol-backend curl -s http://127.0.0.1:8001/api/auth/me
```

Y desde tu navegador: **https://fran.goyainnova.com** → verás la pantalla de login.

Entra con `ADMIN_EMAIL` + `ADMIN_PASSWORD` del `.env`, y **acto seguido rota la contraseña** desde `Configuración → Seguridad`. A partir de ese momento el `.env` puede quedar desactualizado sin problema (el seed es idempotente y no la reescribe).

---

## 6. Cómo funciona el deploy automático

Cada `git push` sobre `main` (o "Save to GitHub" desde Emergent, si esa es tu rama por defecto) dispara `.github/workflows/deploy.yml`:

1. GitHub Actions se conecta por SSH al VPS con la clave configurada.
2. Hace `git reset --hard origin/main` sobre `/opt/fincontrol` (sobrescribe cambios locales sin tocar `.env`, que no está versionado).
3. `docker compose build --pull` → reconstruye backend + frontend con la última imagen base.
4. `docker compose up -d --remove-orphans` → reemplaza los contenedores sin caer la red (Docker sustituye uno a uno).
5. `docker image prune -f` limpia capas huérfanas.

Puedes seguirlo en `Actions` del repo, y también lanzarlo manualmente con **Run workflow**.

---

## 7. Operación diaria

| Tarea | Comando |
|---|---|
| Ver logs backend en vivo | `docker compose logs -f backend` |
| Ver logs frontend | `docker compose logs -f frontend` |
| Reiniciar solo backend | `docker compose restart backend` |
| Reconstruir sin push | `docker compose up -d --build` |
| Ver estado | `docker compose ps` |
| Bajar todo | `docker compose down` |
| Consola en el backend | `docker exec -it fincontrol-backend bash` |
| Mongo shell (si usas contenedor compartido) | `docker exec -it <mongo-container> mongosh $MONGO_URL` |

### Backups Mongo (recomendado)

Añade a `crontab -e` en el VPS:

```cron
0 3 * * * docker exec <mongo-container> mongodump --db fincontrol --archive --gzip > /opt/fincontrol/backups/fincontrol_$(date +\%Y\%m\%d).gz && find /opt/fincontrol/backups -type f -mtime +30 -delete
```
```bash
mkdir -p /opt/fincontrol/backups
```

Restaurar:
```bash
docker exec -i <mongo-container> mongorestore --archive --gzip < /opt/fincontrol/backups/fincontrol_YYYYMMDD.gz
```

---

## 8. Rollback rápido

En el VPS:
```bash
cd /opt/fincontrol
git log --oneline -n 20         # localiza el hash bueno
git reset --hard <hash>
docker compose up -d --build
```

O desde la interfaz de Emergent: usa **Rollback** al checkpoint anterior y luego "Save to GitHub" → el workflow se dispara solo.

---

## 9. Solución de problemas

| Síntoma | Causa habitual | Fix |
|---|---|---|
| 502 en `fran.goyainnova.com` desde Cloudflare | Caddy no encuentra `fincontrol-frontend` | Confirma que `frontend` está en la misma red externa que Caddy (`docker inspect fincontrol-frontend` debe listar la red `caddy`). |
| Backend cae con `KeyError: 'MONGO_URL'` | Falta `.env` o no se cargó | Comprueba `docker compose config` que la sección `env_file: .env` está y que `/opt/fincontrol/.env` existe y es legible. |
| GitHub Action falla en `git reset` | La clave SSH no tiene acceso | Verifica que la privada en el secret coincide con la pública en `authorized_keys` y que el usuario/puerto son correctos. |
| Cloudflare 525 (SSL handshake) | Certificado Origin no cargado en Caddy | Revisa rutas de `tls` en el Caddyfile y permisos `chmod 600`. |
| Los movimientos importados no aparecen | Backend levantado pero apunta a otro Mongo | `docker exec fincontrol-backend env \| grep MONGO_URL`. |

---

## Checklist final

- [ ] DNS `fran.goyainnova.com` → IP del VPS (Cloudflare naranja)
- [ ] Certificado Origin en `/etc/caddy/certs/`
- [ ] Bloque `fran.goyainnova.com` añadido al Caddyfile y Caddy recargado
- [ ] Red Docker compartida identificada y reflejada en `docker-compose.yml`
- [ ] `/opt/fincontrol/.env` creado con `JWT_SECRET`, `ADMIN_*` y `MONGO_URL` reales
- [ ] Clave `fincontrol_deploy` en `authorized_keys` del VPS
- [ ] 4 secretos añadidos a GitHub Actions
- [ ] Primer `docker compose up -d` OK y login funcionando
- [ ] Contraseña rotada desde `Configuración → Seguridad`
- [ ] Cron de backup Mongo configurado
