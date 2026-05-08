"""
Idempotencia — claim_once(key, ttl) para deduplicar operaciones.

USO TÍPICO (webhooks que pueden retransmitirse):

    from app.core.idempotency import claim_once

    if not claim_once(f"meta:msg:{message_id}", ttl_seconds=86400):
        return  # ya procesado, skip

    # ... procesar mensaje ...

DURABILIDAD:
- API estable: `claim_once(key, ttl_seconds) -> bool`. True = es la primera vez.
- Backend: el mismo `app.core.cache` (Redis si REDIS_URL, sino in-memory).
- En in-memory funciona dentro de un solo proceso. Para multi-worker SIN Redis,
  podría haber doble proceso de un mismo evento bajo carga (race entre workers).
  Con Redis: SETNX atómico, 100% único.

ATÓMICIDAD:
- Redis: usa `SET NX EX` (operación atómica).
- In-memory: lock + check-then-set; suficiente para 1 proceso.
"""

from __future__ import annotations

import threading
from typing import Optional

from app.core.cache import _InMemoryCache, _RedisCache, get_cache
from app.core.logging import get_logger

log = get_logger(__name__)

_inmem_lock = threading.Lock()


def claim_once(key: str, ttl_seconds: int = 86400) -> bool:
    """Reserva atómicamente la clave. True = primera vez (proceder), False = ya existía."""
    cache = get_cache()

    if isinstance(cache, _RedisCache):
        try:
            # SET key value NX EX ttl  → None si ya existe; True si fue creada.
            ok = cache._client.set(name=key, value="1", nx=True, ex=ttl_seconds)
            return bool(ok)
        except Exception as exc:
            # Si Redis cae: prefiero permitir el procesamiento que bloquearlo.
            # En el peor caso un mensaje se procesa dos veces (degradación graceful).
            log.warning("idempotency_redis_failed_allowing", key=key, error=str(exc))
            return True

    if isinstance(cache, _InMemoryCache):
        with _inmem_lock:
            if cache.get(key) is not None:
                return False
            cache.set(key, "1", ttl_seconds=ttl_seconds)
            return True

    # Backend desconocido: degradación graceful (procesar siempre).
    log.warning("idempotency_unknown_backend_allowing", key=key)
    return True


def already_processed(key: str) -> bool:
    """Read-only: True si la clave ya está reservada. NO la reserva."""
    return get_cache().get(key) is not None
