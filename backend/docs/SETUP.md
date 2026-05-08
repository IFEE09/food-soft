# Backend — Setup & Deploy

## Stack
- **FastAPI** + **SQLAlchemy 2.0** + **Postgres**
- **Alembic** para migrations
- **structlog** + **Sentry** para observability
- **Redis** (opcional) para cache, pub/sub WebSocket, rate limiting, idempotencia

## Setup local

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # editar valores
python -m pytest -x -q     # smoke
uvicorn app.main:app --reload --port 8000
```

## Variables de entorno críticas

| Var | Cuándo usar | Default |
|---|---|---|
| `DATABASE_URL` | Siempre en prod (`postgresql://user:pwd@host/db`) | local fallback (`POSTGRES_*`) |
| `SECRET_KEY` | Obligatorio en producción (no default) | `yoursecretkeyhere_changeinprod` (warn en dev) |
| `ALLOWED_ORIGINS` | Obligatorio en `ENV=production` | localhost dev origins |
| `ENV` | `development` / `production` | `development` |
| `RUN_STARTUP_MIGRATIONS` | `True` en MVP/dev. **`False` en prod** | `True` |
| `RUN_STARTUP_SEED` | `True` para crear admin + menú inicial | `True` |
| `REDIS_URL` | Activar cache/pubsub/rate distribuido | (vacío → in-memory) |
| `DATABASE_REPLICA_URL` | Réplica de lectura | (vacío → primary para todo) |
| `SENTRY_DSN` | Activar reporte de errores | (vacío → no-op) |
| `LOG_FORMAT` | `console` (dev) / `json` (prod) | `console` |
| `LOG_LEVEL` | `DEBUG` / `INFO` / `WARNING` | `INFO` |

## Pool de DB (tunear sin redeploy)

```env
DB_POOL_SIZE=20         # conexiones permanentes por worker
DB_MAX_OVERFLOW=30      # extras temporales bajo pico
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800    # reciclar tras 30 min
```

**Si no hay PgBouncer**, baja a `DB_POOL_SIZE=5` para no agotar `max_connections` de Postgres.

## Migrations (Alembic)

### Primer deploy en una DB limpia
```bash
alembic upgrade head
```

### DB existente (que ya tiene tablas creadas por el viejo `run_migrations`)
```bash
alembic stamp 0001_baseline   # marca como aplicada sin re-crear
```
Luego, en deploys posteriores, `alembic upgrade head` aplica solo las nuevas.

### Generar nueva migration tras cambiar models
```bash
alembic revision --autogenerate -m "add column foo to bar"
# revisar el archivo generado en alembic/versions/ antes de commit
alembic upgrade head
```

### Producción
- `RUN_STARTUP_MIGRATIONS=False`
- Correr `alembic upgrade head` en el `startCommand` (Railway lo hace por default,
  ver `railway.toml`).

## Tests

```bash
python -m pytest -x -q             # todos
python -m pytest tests/test_bot_engine.py -x   # un módulo
python -m pytest -k "tenant" -v    # match por nombre
```

Tests usan SQLite en memoria (`tests/conftest.py` setea `DATABASE_URL`).
Cero llamadas externas: DeepSeek se mockea, no se hacen requests HTTP reales.

## Lint

```bash
ruff check app/ tests/         # check
ruff check --fix app/ tests/   # auto-fix
```

Config en `pyproject.toml [tool.ruff]`. CI corre `ruff check` como gate.

## Deploy (Railway)

`railway.toml` ya configurado:
```
startCommand = "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthCheckPath = "/health"
```

Settings recomendados en Railway:
- 1+ Postgres (primary), opcional 1 replica
- 1 Redis (addon)
- Web service: `RUN_STARTUP_MIGRATIONS=False`, `LOG_FORMAT=json`, `SENTRY_DSN=...`

## Endpoints de salud

| Path | Qué chequea |
|---|---|
| `GET /health` | Liveness — proceso vivo. Sin DB. |
| `GET /ready` | Readiness — DB pingueable. 503 si no. |

Configurar el orchestrator (k8s/Railway) con liveness=`/health`, readiness=`/ready`.

## Observability

- **Logs**: estructurados (JSON en prod). `request_id` se inyecta automáticamente.
- **Sentry**: errores no-handled van a Sentry si `SENTRY_DSN` está set.
- **Slow queries**: queries > `SLOW_QUERY_MS_THRESHOLD` (default 250ms) se logean.
- **N+1 detection**: `DB_QUERY_COUNT_ENABLED=True` en staging para detectar.

## Activar Redis (cuando crezcas)

1. Provisionar Redis (Railway addon).
2. Setear `REDIS_URL=redis://...`.
3. **Cero cambios en código.** Lo siguiente "se prende solo":
   - Cache de menu/promotions (`app/core/cache.py`)
   - Pub/sub WebSocket multi-worker (`app/core/notifier.py`)
   - Rate limiter compartido (`app/core/rate_limit.py`)
   - Idempotencia atómica (`app/core/idempotency.py`)

## Activar read replica

1. Provisionar replica Postgres con replicación.
2. `DATABASE_REPLICA_URL=postgresql://...`.
3. Endpoints SELECT-heavy pueden migrar de `Depends(get_db)` a `Depends(get_db_ro)`.

## Estructura del módulo bot

```
app/core/bot/
  engine.py          # BotEngine.process_message — state machine principal
  _constants.py      # MENU_IMG, MAX_*, STEP_*, STATE_*
  _formatters.py     # round_price, format_cart_summary, clean_text (puras)
  _messages.py       # text/image adapters por canal + plantillas opciones numeradas
  _actions.py        # show_menu, add_to_cart, view_cart, update_qty, remove, cancel
  _orders_actions.py # check_status, rate_order, submit_complaint
  _confirm.py        # start_confirm_flow, ask_name/address, finalize_order
  adapters.py        # Adapters de Meta (WhatsApp, Messenger, Instagram)
  meta_client.py     # HTTP outbound a Meta Cloud API
  orders.py          # OrderService (crea Order/OrderItem en DB, notifica WS)
  deepseek_client.py # LLM calls
```

API pública: `BotEngine.process_message(db, organization_id, channel, sender_id, text, interactive_id)`.
Llamado desde `app/api/bot.py` para webhooks Meta + endpoint mock.
