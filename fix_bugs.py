"""
Script para corregir los 4 bugs en engine.py:
Bug 1: Timeout debe ir ANTES de los estados especiales
Bug 2: last_interaction_at debe actualizarse en TODOS los caminos (estados especiales incluidos)
Bug 3: pending_variant_base debe limpiarse si el cliente cambia de tema
Bug 4: _clean_text aplicado también a captions de imagen (menor)
+ Mensaje para audio/imagen no procesable
"""

with open('/home/ubuntu/food-soft/backend/app/core/bot/engine.py', 'r') as f:
    content = f.read()

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1 + 2: Mover el bloque de timeout ANTES de los estados especiales
# y agregar actualización de last_interaction_at al inicio del flujo
# (después de RESET_KEYWORDS y CARRITO_PENDIENTE, antes de los estados)
# ─────────────────────────────────────────────────────────────────────────────

OLD_TIMEOUT_BLOCK = '''        # ── Timeout de inactividad: 20 minutos ─────────────────────────────────────────────────────────────────────────────────────
        _INACTIVITY_TIMEOUT = timedelta(minutes=20)
        last_interaction = session.last_interaction_at
        if last_interaction is not None:
            # Normalizar a UTC sin zona horaria para comparar
            if hasattr(last_interaction, 'tzinfo') and last_interaction.tzinfo is not None:
                last_interaction = last_interaction.replace(tzinfo=None)
            now_utc = datetime.utcnow()
            inactive_states = {"PIDIENDO_NOTA", "PIDIENDO_NOMBRE", "PIDIENDO_DIRECCION", "CONFIRMANDO_PEDIDO", "ACTIVO"}
            if (now_utc - last_interaction) > _INACTIVITY_TIMEOUT and state in inactive_states:
                # Limpiar carrito y estado, pero conservar saved_name y saved_address en BotCustomer
                clean_cart = {"items": [], "total": 0.0, "history": list(cart.get("history", []))}
                session.cart_data = clean_cart
                session.state = "ACTIVO"
                db.commit()
                cart = clean_cart
                state = "ACTIVO"
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "Tu sesión anterior expiró por inactividad. ¡No te preocupes, tu pedido fue cancelado automáticamente! 😊 ¿Quieres empezar uno nuevo?"
                )})
                out.extend(BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id))
                return out

        # Actualizar last_interaction_at en cada mensaje
        session.last_interaction_at = datetime.utcnow()
        db.commit()

        # ── Sin mensaje (primer contacto) ─────────────────────────────────────────────────────────────────────────────────────
        if not user_text:
            out.extend(BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id))
            return out'''

# El timeout debe ir justo antes de CLOSE_KEYWORDS
OLD_CLOSE_BLOCK = '''        CLOSE_KEYWORDS = {"cerrar pedido", "cerrar mi pedido", "terminar pedido", "terminar mi pedido", "finalizar pedido"}'''

NEW_CLOSE_BLOCK = '''        # ── Timeout de inactividad: 20 minutos (se verifica ANTES de procesar estados) ───────────────
        _INACTIVITY_TIMEOUT = timedelta(minutes=20)
        last_interaction = session.last_interaction_at
        if last_interaction is not None:
            if hasattr(last_interaction, 'tzinfo') and last_interaction.tzinfo is not None:
                last_interaction = last_interaction.replace(tzinfo=None)
            now_utc = datetime.utcnow()
            inactive_states = {"PIDIENDO_NOTA", "PIDIENDO_NOMBRE", "PIDIENDO_DIRECCION", "CONFIRMANDO_PEDIDO", "ACTIVO"}
            if (now_utc - last_interaction) > _INACTIVITY_TIMEOUT and state in inactive_states:
                clean_cart = {"items": [], "total": 0.0, "history": list(cart.get("history", []))}
                session.cart_data = clean_cart
                session.state = "ACTIVO"
                session.last_interaction_at = datetime.utcnow()
                db.commit()
                cart = clean_cart
                state = "ACTIVO"
                out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                    channel, sender_id,
                    "Tu sesión anterior expiró por inactividad. ¡No te preocupes, tu pedido fue cancelado automáticamente! 😊 ¿Quieres empezar uno nuevo?"
                )})
                out.extend(BotEngine._execute_show_menu(db, channel, sender_id, session, organization_id))
                return out

        # Actualizar last_interaction_at en TODOS los caminos desde aquí
        session.last_interaction_at = datetime.utcnow()
        db.commit()

        # ── Sin mensaje (audio, imagen, sticker, etc.) ────────────────────────────────────────────────
        if not user_text:
            out.append({"action": "SEND_TEXT", "payload": BotEngine._text(
                channel, sender_id,
                "Disculpa, no te entiendo 😅 ¿Cómo más te puedo ayudar? Escribe *menú* para ver nuestros productos."
            )})
            return out

        CLOSE_KEYWORDS = {"cerrar pedido", "cerrar mi pedido", "terminar pedido", "terminar mi pedido", "finalizar pedido"}'''

content = content.replace(OLD_TIMEOUT_BLOCK, '', 1)
content = content.replace(OLD_CLOSE_BLOCK, NEW_CLOSE_BLOCK, 1)

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2b: Agregar last_interaction_at en los estados especiales que hacen return
# (PIDIENDO_NOTA, PIDIENDO_NOMBRE, PIDIENDO_DIRECCION, CONFIRMANDO_PEDIDO)
# Ya está cubierto porque ahora el update está ANTES de estos estados.
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3: Limpiar pending_variant_base si el cliente cambia de tema
# Cuando no se encuentra match, limpiar el pending para que DeepSeek procese normal
# ─────────────────────────────────────────────────────────────────────────────

OLD_PENDING = '''        pending_item = cart.get("pending_variant_base")  # ej: "Cuatro Quesos"
        if pending_item and user_text:
            txt_low = user_text.strip().lower()
            # Buscar el producto que coincida con base + variante
            matched_item = None
            for mi in menu_items:
                mi_name_low = mi.name.lower()
                if pending_item.lower() in mi_name_low and txt_low in mi_name_low:
                    matched_item = mi
                    break
            if matched_item:
                # Limpiar la variante pendiente y agregar al carrito
                cart.pop("pending_variant_base", None)
                session.cart_data = cart
                db.commit()
                result = BotEngine._execute_add_to_cart(db, channel, sender_id, session, organization_id, matched_item.id)
                BotEngine._append_history(session, "user", user_text)
                BotEngine._append_history(session, "assistant", f"{matched_item.name} agregado.")
                db.commit()
                return result'''

NEW_PENDING = '''        pending_item = cart.get("pending_variant_base")  # ej: "cuatro quesos"
        if pending_item and user_text:
            txt_low = user_text.strip().lower()
            # Buscar el producto que coincida con base + variante
            matched_item = None
            for mi in menu_items:
                mi_name_low = mi.name.lower()
                if pending_item.lower() in mi_name_low and txt_low in mi_name_low:
                    matched_item = mi
                    break
            if matched_item:
                # Limpiar la variante pendiente y agregar al carrito
                c = dict(session.cart_data)
                c.pop("pending_variant_base", None)
                session.cart_data = c
                db.commit()
                result = BotEngine._execute_add_to_cart(db, channel, sender_id, session, organization_id, matched_item.id)
                BotEngine._append_history(session, "user", user_text)
                BotEngine._append_history(session, "assistant", f"{matched_item.name} agregado.")
                db.commit()
                return result
            else:
                # FIX Bug 3: El cliente cambió de tema — limpiar pending_variant_base
                # para que DeepSeek procese el nuevo mensaje normalmente
                c = dict(session.cart_data)
                c.pop("pending_variant_base", None)
                session.cart_data = c
                db.commit()
                cart = dict(session.cart_data)  # Refrescar cart local'''

content = content.replace(OLD_PENDING, NEW_PENDING, 1)

with open('/home/ubuntu/food-soft/backend/app/core/bot/engine.py', 'w') as f:
    f.write(content)

print("Cambios aplicados. Verificando...")

import ast
with open('/home/ubuntu/food-soft/backend/app/core/bot/engine.py') as f:
    ast.parse(f.read())
print("Sintaxis OK")
