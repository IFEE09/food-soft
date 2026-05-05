# Guía de Configuración: Bot Omnicanal (WhatsApp, Instagram, Messenger)

El código del bot omnicanal ya está integrado en tu repositorio `food-soft` y subido a GitHub. Ahora está listo para ser desplegado en Railway y conectado a Meta.

Sigue estos pasos para ponerlo en producción.

## 1. Configuración en Railway

Dado que tu repositorio ya está conectado a Railway, los últimos cambios se desplegarán automáticamente. Solo necesitas configurar las variables de entorno.

1. Entra a tu proyecto en [Railway](https://railway.app/).
2. Selecciona el servicio de tu **Backend**.
3. Ve a la pestaña **Variables**.
4. Agrega las siguientes variables de entorno:

| Variable | Valor | Descripción |
|---|---|---|
| `META_VERIFY_TOKEN` | *(Crea una contraseña segura)* | Un token inventado por ti (ej. `MiTokenSecreto123`). Se usa para que Meta verifique que el webhook es tuyo. |
| `META_APP_SECRET` | *(Lo obtendrás en el paso 2)* | El secreto de tu aplicación en Meta for Developers. |
| `META_ACCESS_TOKEN` | *(Lo obtendrás en el paso 2)* | El token de acceso permanente para enviar mensajes. |
| `ENABLE_BOT_MOCK_ENDPOINT` | `False` | Por seguridad, asegúrate de que esté en `False` en producción. |

## 2. Configuración en Meta for Developers

Para conectar el bot a WhatsApp, Instagram y Messenger, necesitas crear una aplicación en Meta.

### A. Crear la Aplicación
1. Ve a [Meta for Developers](https://developers.facebook.com/) e inicia sesión.
2. Haz clic en **Mis aplicaciones** -> **Crear aplicación**.
3. Selecciona **Otros** -> **Siguiente**.
4. Selecciona **Negocios** -> **Siguiente**.
5. Ponle un nombre (ej. "Omnikook Bot") y selecciona tu cuenta de Business Manager.

### B. Obtener Credenciales (Tokens)
1. En el panel de tu app, ve a **Configuración de la aplicación** -> **Información básica**.
2. Copia la **Clave secreta de la aplicación** (App Secret). Pégala en Railway como `META_APP_SECRET`.
3. Ve a **Configuración de la empresa** en tu Business Manager y genera un **Token de acceso del sistema** permanente con permisos para WhatsApp, Instagram y Pages. Pégalo en Railway como `META_ACCESS_TOKEN`.

### C. Configurar el Webhook
1. En el panel de tu app, añade el producto **Webhooks**.
2. Selecciona **WhatsApp Business Account** (y luego repite para **Page** e **Instagram**).
3. Haz clic en **Suscribirse a este objeto**.
4. Llena los datos:
   - **URL de devolución de llamada:** `https://tu-dominio-en-railway.app/api/v1/bot/webhook`
   - **Token de verificación:** El mismo que pusiste en `META_VERIFY_TOKEN` en Railway.
5. Haz clic en **Verificar y guardar**.
6. En la lista de campos, suscríbete a `messages` (para WhatsApp y Messenger/Instagram).

## 3. Vincular Canales en tu Base de Datos

El bot es **multi-tenant** (soporta múltiples restaurantes). Para que el bot sepa a qué restaurante pertenece un mensaje, debes vincular los IDs de Meta con tu Organización.

Usa tu frontend o haz peticiones HTTP (con tu token de usuario dueño) a estos endpoints:

### WhatsApp
- **Endpoint:** `PATCH /api/v1/organizations/me/whatsapp`
- **Body:** `{"whatsapp_phone_number_id": "1234567890"}` *(El ID del número de teléfono en Meta)*

### Facebook Messenger
- **Endpoint:** `PATCH /api/v1/organizations/me/facebook`
- **Body:** `{"facebook_page_id": "9876543210"}` *(El ID de tu página de Facebook)*

### Instagram DM
- **Endpoint:** `PATCH /api/v1/organizations/me/instagram`
- **Body:** `{"instagram_page_id": "1122334455"}` *(El ID de tu cuenta profesional de Instagram)*

---

¡Listo! Una vez configurado esto, cualquier cliente que escriba a tu WhatsApp, Instagram o Messenger será atendido por el bot, y los pedidos llegarán directamente a la cocina de tu software.
