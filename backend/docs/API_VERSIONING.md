# API Versioning

## Estado actual
- Todas las rutas están en `/api/v1/*`.
- `/api/v1` es **estable**: ningún breaking change sin bump de versión.

## Política de versiones

### Cambios permitidos en `v1` (NO requieren bump)
- Agregar **nuevos endpoints**.
- Agregar **campos opcionales** a request bodies.
- Agregar **campos nuevos** a response bodies (clientes deben ignorar campos desconocidos).
- Agregar valores nuevos a enums **siempre que** los clientes traten unknowns como ignorables.
- Bug fixes que NO cambien el contrato.

### Cambios que requieren bump a `v2`
- Renombrar/eliminar endpoints o campos.
- Cambiar tipos (`int` → `string`, etc).
- Cambiar significado semántico de un campo existente.
- Cambiar códigos HTTP de éxito (200 → 204, etc).
- Cambiar autenticación/autorización requerida.
- Cambiar formato de errores.

## Cómo introducir `v2`

Cuando se requiera un breaking change:

1. **Crear router paralelo** en `app/api/v2/`. Reusar lógica de servicio (la lógica
   de negocio NO duplica; solo el adapter de entrada/salida).

2. **Registrar ambos** en `main.py`:
   ```python
   app.include_router(v1_menu_router, prefix=f"{settings.API_V1_STR}/menu")
   app.include_router(v2_menu_router, prefix="/api/v2/menu")
   ```

3. **Anunciar deprecación de v1**: header `Deprecation: true` + `Sunset: <date>` en respuestas v1.

4. **Periodo de coexistencia**: mínimo 6 meses con ambas versiones disponibles.

5. **Migración del frontend**: actualizar `frontend/src/lib/api.js` para usar v2.

6. **Eliminar v1**: tras 6+ meses de notice + métricas que confirmen 0 tráfico.

## Anti-patrones a evitar

- ❌ Versiones por endpoint (`/api/menu/v2`). Causa explosión combinatoria.
- ❌ Versiones via header (`Accept: application/vnd.foodsoft.v2+json`). Fragmenta cache CDN.
- ❌ Cambios silenciosos en v1. Rompen clientes en producción.
- ❌ "Solo este pequeño cambio". Si rompe a alguien = breaking, sin excepción.

## Convenciones que extienden la durabilidad

- **Schemas en su carpeta** (`schemas/`): cuando v2 introduce un cambio, copiar el
  schema a `schemas/v2/` y mantener `schemas/v1/` intacto.
- **Servicios desacoplados de schemas**: la lógica de negocio recibe/devuelve dataclasses
  internas; los schemas son solo adapters HTTP. Un servicio puede servir múltiples versions.
- **Tests por versión**: `tests/api/v1/...` y `tests/api/v2/...` con fixtures separadas.

## Dato útil para clientes

OpenAPI spec disponible en:
- Dev: `GET /openapi.json` (si `EXPOSE_OPENAPI=true` y `ENV != production`)
- Spec versionado: `/openapi.json` siempre refleja la app actual; clientes que
  necesiten una versión específica deben fijar el JSON.
