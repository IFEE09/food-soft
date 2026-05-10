"""
setup_messenger_profile.py
==========================
Configura el Messenger Profile de la página de Facebook conectada al bot:
  - Get Started button (botón "Empezar" para usuarios nuevos)
  - Greeting text (texto de bienvenida antes de iniciar conversación)

Uso:
    META_FB_TOKEN=<page_access_token> python3 scripts/setup_messenger_profile.py

O bien, si ya tienes el .env cargado:
    python3 scripts/setup_messenger_profile.py
"""

import os
import sys
import json
import requests

GRAPH_URL = "https://graph.facebook.com/v19.0/me/messenger_profile"


def get_token() -> str:
    # Intentar desde env var directa primero, luego desde .env
    token = os.environ.get("META_FB_TOKEN") or os.environ.get("META_ACCESS_TOKEN", "")
    if not token:
        # Intentar cargar desde .env en el directorio padre
        env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("META_FB_TOKEN="):
                        token = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
                    if line.startswith("META_ACCESS_TOKEN=") and not token:
                        token = line.split("=", 1)[1].strip().strip('"').strip("'")
    return token


def set_messenger_profile(token: str) -> None:
    payload = {
        "get_started": {
            "payload": "GET_STARTED"
        },
        "greeting": [
            {
                "locale": "default",
                "text": "¡Hola {{user_first_name}}! 👋 Bienvenido a Horno 74. Presiona el botón de abajo para ver nuestro menú y hacer tu pedido."
            },
            {
                "locale": "es_LA",
                "text": "¡Hola {{user_first_name}}! 👋 Bienvenido a Horno 74. Presiona el botón de abajo para ver nuestro menú y hacer tu pedido."
            },
            {
                "locale": "es_ES",
                "text": "¡Hola {{user_first_name}}! 👋 Bienvenido a Horno 74. Pulsa el botón de abajo para ver nuestro menú y hacer tu pedido."
            }
        ]
    }

    print("📤 Configurando Messenger Profile...")
    print(f"   Payload: {json.dumps(payload, ensure_ascii=False, indent=2)}\n")

    resp = requests.post(
        GRAPH_URL,
        params={"access_token": token},
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=15,
    )

    print(f"   HTTP {resp.status_code}")
    try:
        data = resp.json()
        print(f"   Respuesta: {json.dumps(data, ensure_ascii=False, indent=2)}")
    except Exception:
        print(f"   Respuesta raw: {resp.text}")

    if resp.status_code == 200 and resp.json().get("result") == "success":
        print("\n✅ Messenger Profile configurado correctamente.")
        print("   - Botón 'Empezar' activado (payload: GET_STARTED)")
        print("   - Texto de bienvenida configurado en español")
    else:
        print("\n❌ Error al configurar Messenger Profile.")
        print("   Verifica que el token tenga el permiso 'pages_messaging' y 'pages_show_list'.")
        sys.exit(1)


def verify_profile(token: str) -> None:
    print("\n🔍 Verificando configuración actual...")
    resp = requests.get(
        GRAPH_URL,
        params={
            "access_token": token,
            "fields": "get_started,greeting",
        },
        timeout=15,
    )
    print(f"   HTTP {resp.status_code}")
    try:
        data = resp.json()
        print(f"   Configuración actual: {json.dumps(data, ensure_ascii=False, indent=2)}")
    except Exception:
        print(f"   Respuesta raw: {resp.text}")


if __name__ == "__main__":
    token = get_token()
    if not token:
        print("❌ No se encontró META_FB_TOKEN ni META_ACCESS_TOKEN.")
        print("   Ejecuta: META_FB_TOKEN=<tu_token> python3 scripts/setup_messenger_profile.py")
        sys.exit(1)

    print(f"🔑 Token encontrado: {token[:12]}...")
    set_messenger_profile(token)
    verify_profile(token)
