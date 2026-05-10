# Guía de Integración Electron — Omnikook POS

## Estado actual (Mayo 2026)
El sistema está preparado para ser empaquetado como app de escritorio con Electron.
Todos los cambios de compatibilidad ya están aplicados en el código base.

---

## Cambios de compatibilidad ya implementados

### 1. `frontend/src/api/client.js` — Resolución de URL inteligente
```
Prioridad de resolución:
  1. VITE_API_URL (env var)                → siempre gana
  2. window.__ELECTRON_API_URL__           → inyectado por el main process de Electron
  3. window.location.protocol === 'file:' → Electron sin var → usa backend cloud
  4. localhost / 127.0.0.1                → dev local
  5. cualquier otro origen                → producción Railway
```

Para apuntar a un backend local en Electron, el `main.js` de Electron debe inyectar:
```js
// En main.js de Electron, antes de cargar la app:
mainWindow.webContents.executeJavaScript(`
  window.__ELECTRON_API_URL__ = 'http://localhost:8000/api/v1';
`);
```

### 2. `frontend/src/api/client.js` — `buildWsUrl(path)` centralizado
Todos los WebSockets usan esta función. Convierte automáticamente:
- `https://...` → `wss://...`
- `http://...`  → `ws://...`
- `file://...`  → `wss://...` (Electron apunta al cloud)

### 3. `frontend/src/api/client.js` — `redirectToLogin()` seguro para Electron
En lugar de `window.location.href = '/login'` (que no funciona en `file://`),
despacha el evento `omnikook:session-expired`. El router de React debe escucharlo:
```js
// En App.jsx o en el componente raíz:
useEffect(() => {
  const handler = () => navigate('/login');
  window.addEventListener('omnikook:session-expired', handler);
  return () => window.removeEventListener('omnikook:session-expired', handler);
}, [navigate]);
```

### 4. `backend/app/core/config.py` — CORS para `Origin: null`
Electron envía `Origin: null` en peticiones desde `file://`.
El backend ya incluye `"null"` en los orígenes permitidos.

---

## Estructura recomendada del proyecto Electron

```
omnikook-desktop/
├── package.json
├── main.js              ← proceso principal de Electron
├── preload.js           ← expone API segura al renderer
├── app/                 ← build de Vite (npm run build)
│   ├── index.html
│   └── assets/
└── electron-builder.yml ← configuración de empaquetado
```

## Variables de entorno para el build de Electron

```bash
# Para build apuntando al backend cloud (producción):
VITE_API_URL=https://food-soft-production.up.railway.app/api/v1

# Para build apuntando a backend local (modo offline total):
VITE_API_URL=http://localhost:8000/api/v1
```

## Módulos del POS recomendados para la app Electron

| Módulo | Ruta | Prioridad |
|--------|------|-----------|
| POS Mostrador | `/dashboard/pos-counter` | Alta |
| POS Mesas | `/dashboard/pos-table` | Alta |
| Panel de Cocinas | `/dashboard/kitchen` | Alta |
| Reservaciones | `/dashboard/reservations` | Media |
| Dashboard General | `/dashboard` | Baja |

## Modo offline (ya implementado)
- `useOfflineQueue` guarda pedidos en `localStorage` si no hay red
- `OfflineIndicator` muestra el estado y sincroniza al volver la conexión
- Compatible con Electron sin cambios adicionales

---

## Próximos pasos para implementar Electron (cuando sea el momento)

1. `npm install electron electron-builder --save-dev` en el proyecto frontend
2. Crear `main.js` con `BrowserWindow` cargando `app/index.html`
3. Crear `preload.js` con `contextBridge` para exponer `__ELECTRON_API_URL__`
4. Configurar `electron-builder.yml` para Windows, macOS y Linux
5. Agregar script `"electron:build"` en `package.json`
6. Probar con `npm run electron:dev` (carga Vite dev server en Electron)
