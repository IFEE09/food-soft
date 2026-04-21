# Guía de Implementación (Vibe Coding): Bot Conversacional Omnicanal para Restaurantes

**Fecha de elaboración:** Abril 2026  
**Autor:** Manus AI

---

## Resumen Ejecutivo

Este documento es una guía técnica detallada diseñada para desarrolladores que utilizan **vibe coding** (desarrollo asistido por IA) para construir un **Bot Conversacional Omnicanal**. El objetivo es que este bot atienda automáticamente a los clientes en WhatsApp, Instagram Direct y Facebook Messenger utilizando **exclusivamente las APIs oficiales de Meta**.

**El flujo de trabajo es el siguiente:**
1. El cliente escribe al restaurante por cualquiera de los tres canales.
2. El **Bot** toma el control de la conversación, muestra el menú, toma el pedido y solicita los datos de envío.
3. **Solo cuando el pedido está 100% confirmado por el cliente**, el Bot envía la orden estructurada a su **Software Propio de Gestión de Pedidos**.

---

## 1. Arquitectura del Sistema (Flujo Bot -> Software Propio)

Para lograr este flujo, implementaremos una arquitectura basada en estados (State Machine) con los siguientes componentes:

1.  **Meta App (App Dashboard):** Una única aplicación en el portal de desarrolladores de Meta configurada con los productos de WhatsApp, Messenger e Instagram.
2.  **Webhook Endpoint Único (`/api/webhooks/meta`):** El punto de entrada en su servidor (ej. Node.js/Express o Python/FastAPI) que recibe todos los mensajes de los clientes.
3.  **Motor del Bot (State Machine):** El "cerebro" del bot. Mantiene el estado de la conversación de cada usuario en una base de datos o caché (ej. Redis). Los estados típicos son: `NUEVO_USUARIO`, `VIENDO_MENU`, `ARMANDO_PEDIDO`, `PIDIENDO_DIRECCION`, `CONFIRMANDO_PEDIDO`.
4.  **Adaptadores de Canal (Graph API):** Funciones que envían las respuestas del bot (texto, listas, botones) formateadas correctamente según el canal (WhatsApp, IG o Messenger).
5.  **Integración con Software Propio:** Un servicio que, una vez que el estado del bot pasa a `PEDIDO_CONFIRMADO`, hace un POST a la API de su software de gestión de pedidos con el JSON estructurado de la orden.

---

## 2. Configuración Inicial en Meta Developer Portal

Antes de escribir código, debe configurar la infraestructura en Meta. Siga estos pasos exactos:

### 2.1. Creación de la App y Tokens
1.  Vaya a [developers.facebook.com](https://developers.facebook.com/) y cree una nueva aplicación seleccionando el caso de uso **"Connect with customers through WhatsApp"** (o "Business"). [1]
2.  En el panel de la app, añada los productos: **WhatsApp**, **Messenger** e **Instagram**.
3.  Vaya a **Business Settings** > **System Users** y cree un usuario del sistema.
4.  Genere un **Permanent Access Token** para ese usuario del sistema. Asegúrese de incluir los permisos: `whatsapp_business_messaging`, `whatsapp_business_management`, `pages_messaging`, `instagram_manage_messages` y `pages_manage_metadata`. [1] [2]

### 2.2. Registro del Número de WhatsApp (Cloud API)
1.  En el App Dashboard, vaya a **WhatsApp** > **API Setup**.
2.  Añada el número de teléfono de su restaurante. **Importante:** Este número no puede estar activo en la aplicación móvil de WhatsApp Business; debe ser exclusivo para la API. [1]
3.  Anote el **Phone Number ID** (no el número de teléfono en sí) y el **WhatsApp Business Account ID**.

---

## 3. Implementación del Webhook (El Gateway del Bot)

Meta requiere que su servidor valide el webhook mediante un "handshake" (petición GET) y luego reciba los eventos (petición POST).

### 3.1. Verificación del Webhook (GET)

**Prompt sugerido para Vibe Coding:**
> "Crea un endpoint GET en `/api/webhooks/meta` usando [tu framework, ej. Express/FastAPI]. Debe leer los query parameters `hub.mode`, `hub.verify_token` y `hub.challenge`. Si `hub.mode` es 'subscribe' y `hub.verify_token` coincide con mi variable de entorno `META_VERIFY_TOKEN`, devuelve el `hub.challenge` como texto plano con status 200. Si no, devuelve 403."

### 3.2. Recepción de Mensajes (POST)

Aquí es donde el bot recibe los mensajes. Debe responder con HTTP 200 inmediatamente para evitar que Meta reintente el envío, y luego procesar la lógica del bot.

**Prompt sugerido para Vibe Coding:**
> "Crea un endpoint POST en `/api/webhooks/meta`. Primero, extrae el body. Si `body.object` es 'whatsapp_business_account', 'page' o 'instagram', responde inmediatamente con status 200 y 'EVENT_RECEIVED'. Luego, procesa el payload de forma asíncrona. Extrae el ID del remitente, el canal de origen y el texto del mensaje. Pasa estos datos a la función `BotEngine.processMessage(senderId, channel, message)`."

---

## 4. El Motor del Bot (State Machine)

El bot debe recordar en qué parte del pedido está el cliente. Esto se logra con una máquina de estados.

### 4.1. Lógica de Estados del Pedido

**Prompt sugerido para Vibe Coding:**
> "Crea una clase `BotEngine`. Debe tener un método `processMessage(senderId, channel, message)`. Usa Redis o una base de datos para obtener el estado actual del `senderId`.
> - Si el estado es nulo, guárdalo como `VIENDO_MENU` y usa el adaptador del canal para enviar un mensaje de bienvenida con el menú interactivo.
> - Si el estado es `VIENDO_MENU` y el mensaje es una selección del menú, guarda el ítem en el carrito del usuario, cambia el estado a `PIDIENDO_DIRECCION` y pregúntale a dónde enviarlo.
> - Si el estado es `PIDIENDO_DIRECCION`, guarda la dirección, cambia el estado a `CONFIRMANDO_PEDIDO` y envíale un resumen del pedido con botones de 'Confirmar' o 'Cancelar'.
> - Si el estado es `CONFIRMANDO_PEDIDO` y el usuario hace clic en 'Confirmar', llama a la función `OrderService.sendToInternalSoftware(orderData)` y envíale un mensaje de éxito."

---

## 5. Envío de Mensajes Interactivos (Graph API)

Para que el bot sea efectivo, debe utilizar **Mensajes Interactivos** (Listas y Botones) para mostrar el menú y confirmar opciones, evitando que el usuario tenga que escribir. [4]

### 5.1. Mensaje de Lista (Menú del Restaurante)

Las listas son ideales para mostrar categorías del menú (ej. Pizzas, Bebidas, Postres). Soportan hasta 10 opciones divididas en secciones.

**Estructura JSON para enviar una Lista (WhatsApp):** [5]
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "<NUMERO_DEL_CLIENTE>",
  "type": "interactive",
  "interactive": {
    "type": "list",
    "header": {
      "type": "text",
      "text": "Menú del Restaurante"
    },
    "body": {
      "text": "¡Hola! Soy el bot del restaurante. Por favor, selecciona una categoría para ver nuestras opciones:"
    },
    "footer": {
      "text": "Opciones actualizadas hoy"
    },
    "action": {
      "button": "Ver Menú",
      "sections": [
        {
          "title": "Pizzas Clásicas",
          "rows": [
            {
              "id": "item_pizza_margarita",
              "title": "Margarita",
              "description": "Salsa de tomate, mozzarella y albahaca ($12)"
            }
          ]
        }
      ]
    }
  }
}
```

### 5.2. Mensaje de Botones (Confirmación del Bot)

Los botones de respuesta rápida (hasta 3 opciones) son perfectos para el paso final del bot: la confirmación.

**Estructura JSON para enviar Botones (WhatsApp):**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "<NUMERO_DEL_CLIENTE>",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": {
      "text": "Tu pedido total es de $15 a la dirección 'Calle Falsa 123'. ¿Deseas confirmar el pedido para que lo enviemos a cocina?"
    },
    "action": {
      "buttons": [
        {
          "type": "reply",
          "reply": {
            "id": "btn_confirm_order",
            "title": "Sí, confirmar"
          }
        },
        {
          "type": "reply",
          "reply": {
            "id": "btn_cancel_order",
            "title": "Cancelar"
          }
        }
      ]
    }
  }
}
```

---

## 6. Integración con el Software Propio

Este es el paso crucial. El bot **solo** se comunica con su software de gestión cuando el cliente presiona el botón "Sí, confirmar".

**Prompt sugerido para Vibe Coding:**
> "Crea un servicio `OrderService`. Debe tener un método `sendToInternalSoftware(orderData)`. Este método debe tomar el objeto `orderData` (que contiene el carrito, el total, la dirección y el canal de origen) y hacer una petición HTTP POST a la API de nuestro software interno (ej. `https://api.mi-software-restaurante.com/v1/orders`). Asegúrate de incluir un header de autorización para proteger nuestro software interno. Si la respuesta es 200 OK, el bot debe decirle al cliente 'Tu pedido ha sido recibido por la cocina'."

---

## 7. Diferencias Clave entre Canales (WhatsApp vs. Instagram/Messenger)

Al centralizar el bot, su código debe manejar las diferencias entre las APIs:

1.  **Identificadores de Usuario:** En WhatsApp, el ID del usuario es su número de teléfono (`from: "54911..."`). En Instagram y Messenger, es un ID numérico específico de la página (PSID o IGSID). Su base de datos debe vincular la sesión del pedido al ID correcto según el canal.
2.  **Mensajes Interactivos:** La estructura JSON de listas y botones mostrada arriba es específica de **WhatsApp Cloud API**. Instagram y Messenger utilizan "Generic Templates" y "Quick Replies" que tienen una estructura JSON diferente. [6]
    *   *Recomendación de Vibe Coding:* Pida a la IA que cree adaptadores (adapters) separados para el bot: `WhatsAppAdapter`, `InstagramAdapter`, `MessengerAdapter`. El núcleo del bot debe decir "Enviar Menú", y el adaptador correspondiente debe formatear el JSON según el canal.

---

## 8. Flujo de Trabajo Recomendado para Vibe Coding

Para construir este bot eficientemente con su asistente de IA, siga este orden:

1.  **Paso 1: Infraestructura Base.** Pida a la IA que configure el servidor Express/FastAPI y los endpoints GET/POST del webhook con validación de firmas (SHA256).
2.  **Paso 2: Recepción y Log.** Use Ngrok para exponer su servidor local. Pida a la IA que imprima en consola los payloads entrantes. Envíe mensajes desde su teléfono a WhatsApp, Instagram y Messenger para ver las diferencias.
3.  **Paso 3: Adaptadores de Envío.** Pida a la IA que implemente las funciones para enviar mensajes de texto simples a los tres canales.
4.  **Paso 4: La Máquina de Estados del Bot.** Pida a la IA que implemente la lógica de estados (`VIENDO_MENU`, `PIDIENDO_DIRECCION`, etc.) usando una estructura en memoria o Redis.
5.  **Paso 5: Mensajes Interactivos.** Pida a la IA que implemente el envío de Listas y Botones para WhatsApp (el canal principal para pedidos).
6.  **Paso 6: El POST al Software Propio.** Pida a la IA que implemente la llamada HTTP a su software interno **únicamente** cuando el estado del bot llegue a `CONFIRMANDO_PEDIDO` y el usuario acepte.

---

## Referencias

[1] Meta for Developers. *WhatsApp Cloud API Get Started*. https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
[2] Meta for Developers. *Instagram Messaging Webhooks*. https://developers.facebook.com/docs/instagram-messaging/webhooks
[3] Meta for Developers. *WhatsApp Webhooks Overview*. https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/
[4] Meta for Developers. *Interactive Messages Guide*. https://developers.facebook.com/docs/whatsapp/guides/interactive-messages/
[5] Meta for Developers. *Interactive list messages*. https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-list-messages/
[6] Meta for Developers. *Messenger Platform Webhooks*. https://developers.facebook.com/docs/messenger-platform/webhooks
[7] Meta for Developers. *Sending messages*. https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
