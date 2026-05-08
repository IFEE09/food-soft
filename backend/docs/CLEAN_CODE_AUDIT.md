# Clean Code Audit — backend

Snapshot: `2026-05-08`. Hallazgos ordenados por impacto/riesgo.

## Top 10 funciones más largas

| Líneas | Archivo::función | Severidad | Decisión |
|---|---|---|---|
| 620 | `engine.py::process_message` | Alta | **Pendiente Fase F**: state machine principal. Requiere tests adicionales + bot real. |
| 205 | `deepseek_client.py::_build_system_prompt` | Baja | Es un prompt — natural que sea largo. Mantener. |
| 146 | `bot.py::process_meta_payload` | Media | Maneja 3 canales (WhatsApp/Messenger/Instagram). Posible split por canal. |
| 83 | `orders.py::send_to_internal_software` | Media | Crea Order + OrderItems + notifica WS. Podría partirse. |
| 74 | `orders.py::mark_order_ready` | Baja | Razonable, no urgente. |
| 71 | `main.py::init_db_data` | Baja | Seed inicial; corre 1 vez. Aceptable. |
| 70 | `deepseek_client.py::ask_deepseek` | Baja | Wrapper LLM, lógica linear. |
| 62 | `inventory.py::deduct_supplies_for_line_items` | Baja | Bien testeado, claro. |
| 62 | `_actions.py::add_to_cart` | Baja | Recién extraído, claro. |
| 56 | `auth.py::register_user` | Baja | Validaciones + creación. OK. |

## Patrones a mejorar (no urgente)

### 1. `dict(session.cart_data)` repetido
Aparece ~15 veces. Crear helper `_cart_view(session) -> dict[str, Any]`.

### 2. `_send_text` duplicado en 3 módulos
`_actions.py`, `_orders_actions.py`, `_confirm.py` cada uno tiene su `_send_text`.
Extraer a `_messages.py::send_text_action()` y usar uno solo.

### 3. Magic numbers ya extraídos
- `MAX_ADDRESS_LEN = 200`, `MAX_HISTORY = 20`, `MAX_NOTE_LEN = 120` en `_constants.py` ✓
- `_COMPLAINT_TEXT_MAX = 300` en `_orders_actions.py` ✓

### 4. Logging style inconsistente
- Algunos archivos usan `logger.info("Foo: %s", x)` (stdlib style)
- Otros usan `log.info("foo_event", x=y)` (structlog style)

Decisión: el logger de cada archivo se basa en `logging.getLogger(__name__)` → ambos formatos
funcionan; structlog procesador acepta args. Migración total a structlog kwargs es cosmética.

### 5. `process_message` es un god function
620 líneas. Es la pieza crítica del bot. Plan futuro:
- Extraer cada `state == "X"` en su propio handler
- Pattern: `STATE_HANDLERS = {STATE_X: handle_x, ...}`
- `process_message` queda como dispatcher de ~30 líneas
- **Bloqueador**: requiere ~30 tests más (cada estado x cada input) para refactor seguro

## No-issues (cosas que parecen problemas pero no lo son)

- **Args list larga** en `_actions.add_to_cart(db, channel, sender_id, session, organization_id, item_id, ...)`:
  cada argumento es un recurso necesario; agruparlos en un `Context` dataclass solo añade indirección.
- **Imports tras `configure_logging()` en main.py**: orden es semánticamente requerido (logger debe configurarse antes de cualquier `getLogger`). Mantener.
- **`engine.py` aún 905 líneas**: es el state machine + dispatch. La parte aún larga (`process_message`) está aislada en una función; el archivo entero es solo esa clase. OK por ahora.

## Métricas a perseguir

- Cobertura de tests: 24 tests hoy. Meta: 50+ (cubrir state machine completo).
- Tamaño promedio de función: agregar regla ruff `PLR0915` (statements per function) cuando el codebase esté listo.
- Funciones con cyclomatic complexity > 10: usar `radon cc app/`.

## TODOs concretos (pequeños, seguros)

1. ✅ Extraer constants a `_constants.py`
2. ✅ Extraer formatters puros a `_formatters.py`
3. ✅ Extraer message builders a `_messages.py`
4. ✅ Extraer action handlers a `_actions.py` / `_orders_actions.py`
5. ✅ Extraer confirm flow a `_confirm.py`
6. ✅ Configurar ruff en CI con gate
7. ⏳ Helper `_cart_view(session)` para no repetir `dict(session.cart_data)`
8. ⏳ Unificar `_send_text` en `_messages.py`
9. ⏳ Refactor `process_message` (Fase F — requiere tests)
10. ⏳ Migrar logger style a structlog kwargs en archivos críticos
