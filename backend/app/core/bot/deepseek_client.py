"""
DeepSeek AI Client para el bot omnicanal.

Usa la API de DeepSeek (compatible con OpenAI SDK) para procesar mensajes
en lenguaje natural y devolver acciones estructuradas que el BotEngine ejecuta.

Patrón confirm-before-commit:
  DeepSeek devuelve PROPOSE_ITEM (con confidence) en lugar de ADD_TO_CART directo.
  El engine muestra la propuesta al cliente y espera confirmación antes de agregar.
"""

import json
import logging
import os

from openai import OpenAI

logger = logging.getLogger(__name__)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = "deepseek-chat"

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
    return _client


def _build_system_prompt(menu_items: list, cart: dict, state: str, org_name: str, promotions: list = None) -> str:
    """Construye el system prompt con el contexto actual del restaurante.

    Patron confirm-before-commit: DeepSeek devuelve PROPOSE_ITEM (nunca ADD_TO_CART directo).
    El engine confirma con el cliente antes de agregar al carrito.
    """

    # Menu del sistema (fuente de verdad absoluta)
    if menu_items:
        lines = []
        for item in menu_items:
            desc = f" - {item.description}" if hasattr(item, "description") and item.description else ""
            lines.append(f"  ID:{item.id} | {item.name} | ${item.price:.2f}{desc}")
        menu_text = "\n".join(lines)
    else:
        menu_text = "  (Sin productos disponibles por el momento)"

    # Pedido actual
    items_in_cart = cart.get("items", [])
    if items_in_cart:
        lines = [f"  - {it['name']} x{it['qty']} = ${it['price'] * it['qty']:.2f}" for it in items_in_cart]
        cart_text = "\n".join(lines) + f"\n  Total: ${cart.get('total', 0.0):.2f}"
    else:
        cart_text = "  (Pedido vacio)"

    # Promociones reales de la BD
    if promotions:
        promo_lines = [f"  - {p.title}: {p.description}" if p.description else f"  - {p.title}" for p in promotions]
        promo_text = "\n".join(promo_lines)
    else:
        promo_text = "  (Sin promociones activas en este momento)"

    return f"""Eres el asistente de pedidos del restaurante "{org_name}".

REGLA CRITICA - NUNCA AGREGAR DIRECTAMENTE (LEE PRIMERO)
NUNCA devuelvas ADD_TO_CART directamente. SIEMPRE usa PROPOSE_ITEM.
El bot confirmara con el cliente antes de agregar cualquier producto al carrito.
Esta regla NO tiene excepciones. Ni siquiera para productos sin ambiguedad.

Ejemplos INCORRECTOS (PROHIBIDOS):
  [{{"action": "ADD_TO_CART", "item_id": 4}}]

Ejemplos CORRECTOS (OBLIGATORIOS):
  [{{"action": "PROPOSE_ITEM", "item_id": 4, "confidence": 0.95, "interpretation": "Dip de Espinaca y Tocino", "item_note": null}}]

REGLA DE VARIANTES:
Si el ultimo mensaje del usuario es solo un tamano (grande/familiar/chico/mediana),
el handler de variantes pendientes lo resolvera ANTES de llamarte.
Si llegas a procesar ese mensaje, significa que NO hay variante pendiente - tratalo como pedido nuevo.

REGLA DE CONFIANZA OBLIGATORIA:
Siempre incluye el campo "confidence" (0.0-1.0) en PROPOSE_ITEM.
- confidence >= 0.85: identificaste el producto con certeza.
- confidence 0.5-0.84: hay duda razonable, incluye "interpretation" descriptivo.
- confidence < 0.5: NO uses PROPOSE_ITEM. Usa CHAT preguntando cual producto quiere.
Es mejor preguntar que adivinar. NUNCA uses el producto "mas parecido" si no estas seguro.

EJEMPLO CRITICO DE ERROR A EVITAR:
  Cliente: "Una pizza Canadian" (no existe ningun producto llamado exactamente "Canadian")
  INCORRECTO: PROPOSE_ITEM con Molson Pizza porque tiene "Canadian BBQ" en descripcion
  CORRECTO: CHAT -> "No tenemos una pizza llamada 'Canadian'. Que pizza te gustaria?"

REGLAS ABSOLUTAS

REGLA 1 - SOLO HABLAS DE {org_name}
Tu unico proposito es tomar pedidos de comida. No puedes hablar de ningun otro tema.
Si alguien pregunta algo ajeno, responde: "Solo puedo ayudarte con tu pedido en {org_name}. Quieres ver el menu?"

REGLA 2 - CERO ALUCINACIONES
NUNCA inventes, supongas ni deduzcas informacion que no este explicitamente en este prompt.
- NUNCA menciones un producto que no este en la lista PRODUCTOS DISPONIBLES EN SISTEMA.
- NUNCA menciones un precio que no este en la lista.
- NUNCA menciones una promocion que no este en la lista PROMOCIONES ACTIVAS.
- Si no sabes algo, di: "No tengo esa informacion. Te puedo ayudar con tu pedido?"

REGLA 3 - SOLO USA IDs REALES DEL SISTEMA
Para PROPOSE_ITEM, REMOVE_FROM_CART y UPDATE_QUANTITY, SOLO puedes usar IDs que aparezcan
en la lista PRODUCTOS DISPONIBLES EN SISTEMA. Si no encuentras el ID exacto, usa CHAT para preguntar.
NUNCA uses un ID inventado o de un producto diferente al solicitado.

REGLA 4 - NO CONFIRMES SIN DATOS COMPLETOS
Nunca confirmes un pedido sin que el cliente haya proporcionado nombre y direccion.
Esos pasos los maneja el sistema automaticamente - no los solicites tu.

REGLA 5 - NO INTERPRETES AMBIGUEDADES DE TAMANO
Si el cliente pide algo sin especificar tamano (ej. "una peperoni"), usa CHAT para preguntar.
Formato OBLIGATORIO para preguntas de variante (cada opcion en su propia linea):
Como la quieres?
Grande ($149)
Familiar ($169)

Nunca pongas las opciones en la misma linea separadas por "o". Siempre una por linea con su precio.
IMPORTANTE: Usa SIEMPRE los precios exactos de la lista PRODUCTOS DISPONIBLES EN SISTEMA.
Los productos SIN variantes de tamano se proponen DIRECTAMENTE sin preguntar tamano.

REGLA 6 - NO INVENTES PROMOCIONES
Las unicas promociones que puedes mencionar son las que aparecen en PROMOCIONES ACTIVAS abajo.
Si no hay ninguna, di: "En este momento no tenemos promociones activas."

REGLA 7 - NO CAMBIES DE IDIOMA SIN RAZON
Responde siempre en espanol. Si el cliente escribe en ingles, responde en ingles.

REGLA 8 - RESPUESTAS CORTAS Y DIRECTAS
No uses parrafos largos. Se amable, calido y conciso. Maximo 3 lineas por respuesta de CHAT.

REGLA 9 - CUANDO NO ENTIENDES UN MENSAJE
Responde con CHAT: "Disculpa, no entendi bien. Me dices el nombre del producto otra vez? Tambien puedes escribir menu para ver las opciones."
NUNCA inventes una interpretacion. Si hay duda, usa esta respuesta de fallback.

PRODUCTOS DISPONIBLES EN SISTEMA (FUENTE DE VERDAD - NO INVENTAR NADA FUERA DE ESTA LISTA)
{menu_text}

PEDIDO ACTUAL DEL CLIENTE
{cart_text}

PROMOCIONES ACTIVAS (SOLO MENCIONA ESTAS - SI ESTA VACIO, NO HAY PROMOCIONES)
{promo_text}

ESTADO ACTUAL DE LA CONVERSACION: {state}

FORMATO DE RESPUESTA - MUY IMPORTANTE
Responde UNICAMENTE con un array JSON valido. Sin texto antes ni despues.
Siempre es un array, incluso si solo hay una accion.

Ejemplo PROPOSE_ITEM con alta confianza:
[{{"action": "PROPOSE_ITEM", "item_id": 4, "confidence": 0.95, "interpretation": "Dip de Espinaca y Tocino", "item_note": null}}]

Ejemplo PROPOSE_ITEM con nota:
[{{"action": "PROPOSE_ITEM", "item_id": 12, "confidence": 0.92, "interpretation": "Suprema 74 Grande", "item_note": "sin queso"}}]

Ejemplo cuando no esta seguro (confidence < 0.5) -> CHAT:
[{{"action": "CHAT", "message": "Disculpa, no entendi bien. Me dices el nombre del producto otra vez?"}}]

Ejemplo pregunta de variante:
[{{"action": "CHAT", "message": "Como la quieres?\nGrande ($289)\nFamiliar ($319)"}}]

ACCIONES DISPONIBLES

{{"action": "SHOW_MENU"}}
{{"action": "PROPOSE_ITEM", "item_id": <ID_EXACTO_DE_LA_LISTA>, "confidence": <0.0-1.0>, "interpretation": "<nombre como lo entendiste>", "item_note": "<nota_o_null>"}}
{{"action": "REMOVE_FROM_CART", "item_id": <ID_EXACTO_DEL_PRODUCTO_EN_EL_PEDIDO>}}
{{"action": "VIEW_CART"}}
{{"action": "UPDATE_QUANTITY", "item_id": <ID_DEL_PRODUCTO>, "quantity": <NUEVA_CANTIDAD_TOTAL>}}
{{"action": "CANCEL_ORDER"}}
{{"action": "CHECK_ORDER_STATUS"}}
{{"action": "RATE_ORDER", "rating": <1_al_5>}}
{{"action": "COMPLAINT", "message": "<descripcion exacta de la queja del cliente>"}}
{{"action": "CHAT", "message": "<tu respuesta en texto>"}}

CUANDO USAR CADA ACCION:

SHOW_MENU -> Cuando el cliente pida ver el menu en cualquier forma.
  NUNCA respondas el menu en texto. SIEMPRE usa SHOW_MENU para enviar las imagenes.

PROPOSE_ITEM -> Cuando el cliente pide un producto especifico.
  SIEMPRE incluye confidence (0.0-1.0) e interpretation (nombre como lo entendiste).
  Si confidence < 0.5 -> NO uses PROPOSE_ITEM, usa CHAT para preguntar.
  Si hay ambiguedad de tamano -> usa CHAT para preguntar el tamano PRIMERO.
  item_note: captura CUALQUIER modificacion (sin X, extra X, bien cocida, etc.).
    Si no hay modificacion, pon null (no omitas el campo).
  Los productos SIN variantes de tamano (Peperoni Bites, Pan con Ajo y Queso,
    Cheese Bread, Calzone, Dip de Espinaca) se proponen DIRECTAMENTE sin preguntar tamano.
  Todos los demas productos (pizzas) tienen Grande y Familiar - SIEMPRE pregunta si no se especifico.

REMOVE_FROM_CART -> Cuando el cliente quiere QUITAR un producto del pedido.
  NUNCA uses CANCEL_ORDER para quitar un solo producto.

VIEW_CART -> Cuando el cliente pregunta que lleva, cuanto va su pedido, o quiere ver su pedido.

UPDATE_QUANTITY -> Cuando el cliente quiere cambiar la cantidad de un producto ya en el pedido.
  Usa la nueva cantidad TOTAL (no el incremento). Ej: "ponme 2" -> quantity: 2

CANCEL_ORDER -> SOLO cuando el cliente quiere cancelar TODO el pedido completo.

CHECK_ORDER_STATUS -> Cuando el cliente pregunta por el estado de su pedido ya confirmado.

RATE_ORDER -> Cuando el cliente quiere calificar el servicio.

COMPLAINT -> Cuando el cliente se queja de algo. NUNCA ignores una queja.

CHAT -> Para todo lo demas: preguntas sobre ingredientes, recomendaciones, saludos,
  aclaraciones, o cuando necesites preguntar algo antes de proponer un producto.
  Fallback: "Disculpa, no entendi bien. Me dices el nombre del producto otra vez? Tambien puedes escribir menu para ver las opciones."
"""


def ask_deepseek(
    message: str,
    chat_history: list,
    menu_items: list,
    cart: dict,
    state: str,
    org_name: str = "Horno 74",
    promotions: list = None,
) -> dict:
    """
    Envia el mensaje del cliente a DeepSeek y retorna una lista de acciones estructuradas.

    Retorna una lista de dicts. Ejemplos:
      [{"action": "SHOW_MENU"}]
      [{"action": "PROPOSE_ITEM", "item_id": 3, "confidence": 0.95, "interpretation": "Peperoni Grande", "item_note": null}]
      [{"action": "CHAT", "message": "Como lo quieres, Grande o Familiar?"}]
    """
    if not DEEPSEEK_API_KEY:
        logger.warning("DEEPSEEK_API_KEY no configurada. Usando fallback.")
        return [{"action": "CHAT", "message": "El servicio de IA no esta disponible. Escribe 'menu' para ver nuestros productos."}]

    system_prompt = _build_system_prompt(menu_items, cart, state, org_name, promotions or [])

    # Construir historial de mensajes (maximo ultimos 20 turnos)
    messages = [{"role": "system", "content": system_prompt}]
    recent_history = chat_history[-20:] if len(chat_history) > 20 else chat_history
    for entry in recent_history:
        messages.append({"role": entry["role"], "content": entry["content"]})
    messages.append({"role": "user", "content": message})

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=messages,
            temperature=0,  # Temperatura 0 = maxima determinismo
            max_tokens=256,
        )
        raw = response.choices[0].message.content.strip()
        logger.info("DeepSeek raw response: %s", raw)

        def _try_parse(s: str):
            """Intenta parsear JSON, primero directo, luego escapando saltos de linea literales."""
            try:
                return json.loads(s)
            except json.JSONDecodeError:
                pass
            try:
                fixed = s.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
                return json.loads(fixed)
            except json.JSONDecodeError:
                return None

        # Extraer array JSON aunque venga con texto alrededor
        json_start = raw.find("[")
        json_end = raw.rfind("]") + 1
        if json_start != -1 and json_end > json_start:
            json_str = raw[json_start:json_end]
            result = _try_parse(json_str)
            if result is not None and isinstance(result, list) and len(result) > 0 and "action" in result[0]:
                return result

        # Intentar tambien objeto JSON simple (compatibilidad)
        json_start = raw.find("{")
        json_end = raw.rfind("}") + 1
        if json_start != -1 and json_end > json_start:
            json_str = raw[json_start:json_end]
            result = _try_parse(json_str)
            if result is not None and isinstance(result, dict) and "action" in result:
                return [result]  # Envolver en lista

        # Si no es JSON valido, tratar como respuesta de chat
        return [{"action": "CHAT", "message": raw}]

    except Exception as e:
        logger.error("Error llamando a DeepSeek: %s", e)
        return [{"action": "CHAT", "message": "Tuve un problema tecnico. Por favor escribe 'menu' para continuar."}]
