"""
Constants del bot — valores que NO cambian en runtime.

Si tienes un valor que se repite o que un futuro cambio podría afectar varios sitios,
ponlo aquí. Una sola fuente de verdad.

Estados del flujo de confirmación (guardados en cart["confirm_step"]):
"""

# ── Imagen del menú (URL pública subida desde el panel admin) ────────────────
MENU_IMG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663247606651/POImasJjRHaTAgIa.png"

# ── Límites de seguridad ─────────────────────────────────────────────────────
MAX_ADDRESS_LEN = 200
MAX_HISTORY = 20
MAX_NOTE_LEN = 120

# ── Estados del flujo de confirmación ────────────────────────────────────────
STEP_CART_OPTIONS    = "cart_options"      # Esperando 1/2/3 post-carrito
STEP_AWAITING_YES_NO = "awaiting_yes_no"   # Esperando 1/2 sobre nombre+dirección guardados
STEP_ASKING_NAME     = "asking_name"       # Esperando 1/2 sobre nombre guardado
STEP_TYPING_NAME     = "typing_name"       # Esperando texto libre del nombre
STEP_ASKING_ADDRESS  = "asking_address"    # Esperando 1/2 sobre dirección guardada
STEP_TYPING_ADDRESS  = "typing_address"    # Esperando texto libre de la dirección
STEP_ASKING_NOTE     = "asking_note"       # Esperando texto libre de instrucciones

# ── Estados de la sesión (BotSession.state) ──────────────────────────────────
STATE_ACTIVE              = "ACTIVO"
STATE_CONFIRMING          = "CONFIRMANDO_PEDIDO"
STATE_PENDING_CART        = "CARRITO_PENDIENTE"
STATE_ASKING_NAME         = "PIDIENDO_NOMBRE"
STATE_ASKING_ADDRESS      = "PIDIENDO_DIRECCION"
STATE_ASKING_NOTE         = "PIDIENDO_NOTA"

# Estados que califican como "inactivos" para timeout de sesión.
INACTIVE_STATES = frozenset({
    STATE_ASKING_NOTE,
    STATE_ASKING_NAME,
    STATE_ASKING_ADDRESS,
    STATE_CONFIRMING,
    STATE_PENDING_CART,
})

# ── Tiempo de inactividad para reset automático ──────────────────────────────
INACTIVITY_TIMEOUT_MINUTES = 20
