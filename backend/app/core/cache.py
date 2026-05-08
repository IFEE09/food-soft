"""
Cache — interfaz estable + impl in-memory (default) + impl Redis (cuando REDIS_URL).

API estable (no cambiar firmas):
    cache = get_cache()
    cache.get(key) -> Any | None
    cache.set(key, value, ttl_seconds)
    cache.delete(key)
    cache.clear_prefix(prefix)

Diseño:
- Una sola instancia por proceso, lazy-init en `get_cache()`.
- Backend se decide UNA vez por la presencia de settings.REDIS_URL.
- Si Redis cae en runtime: el caller recibe `None` en `.get()` y sigue funcionando
  (cache es optimización, NUNCA fuente de verdad).
- Valores se serializan a JSON. No guardar objetos no-JSON-serializables.

Ejemplo de uso (cachear menu por org):
    key = f"menu:org:{org_id}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    items = db.query(MenuItem).filter_by(organization_id=org_id).all()
    payload = [{"id": i.id, "name": i.name, "price": i.price} for i in items]
    cache.set(key, payload, ttl_seconds=60)
    return payload

INVALIDACIÓN: cuando cambias menu, llama `cache.delete(f"menu:org:{org_id}")`.
"""

from __future__ import annotations

import json
import threading
import time
from typing import Any, Optional, Protocol

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


class Cache(Protocol):
    def get(self, key: str) -> Optional[Any]: ...
    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None: ...
    def delete(self, key: str) -> None: ...
    def clear_prefix(self, prefix: str) -> None: ...


class _InMemoryCache:
    """LRU-ish in-memory con TTL por key. Para 1 proceso. Hilo-seguro."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._store: dict[str, tuple[float, Any]] = {}  # key -> (expires_at, value)

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at and expires_at < time.monotonic():
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else settings.CACHE_TTL_SECONDS
        expires_at = time.monotonic() + ttl if ttl > 0 else 0.0
        with self._lock:
            self._store[key] = (expires_at, value)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def clear_prefix(self, prefix: str) -> None:
        with self._lock:
            for k in list(self._store.keys()):
                if k.startswith(prefix):
                    self._store.pop(k, None)


class _RedisCache:
    """Redis-backed cache. Tolera caídas: si Redis no responde, get retorna None."""

    def __init__(self, url: str) -> None:
        import redis  # lazy import: solo si REDIS_URL está set

        self._client = redis.Redis.from_url(url, decode_responses=True)
        # Probe básico (no bloquea init si falla).
        try:
            self._client.ping()
            log.info("cache_redis_connected")
        except Exception as exc:
            log.warning("cache_redis_ping_failed", error=str(exc))

    def get(self, key: str) -> Optional[Any]:
        try:
            raw = self._client.get(key)
        except Exception as exc:
            log.warning("cache_get_failed", key=key, error=str(exc))
            return None
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (TypeError, ValueError):
            return None

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else settings.CACHE_TTL_SECONDS
        try:
            payload = json.dumps(value, default=str)
        except (TypeError, ValueError) as exc:
            log.warning("cache_set_serialization_failed", key=key, error=str(exc))
            return
        try:
            if ttl > 0:
                self._client.setex(key, ttl, payload)
            else:
                self._client.set(key, payload)
        except Exception as exc:
            log.warning("cache_set_failed", key=key, error=str(exc))

    def delete(self, key: str) -> None:
        try:
            self._client.delete(key)
        except Exception as exc:
            log.warning("cache_delete_failed", key=key, error=str(exc))

    def clear_prefix(self, prefix: str) -> None:
        try:
            for k in self._client.scan_iter(match=f"{prefix}*"):
                self._client.delete(k)
        except Exception as exc:
            log.warning("cache_clear_prefix_failed", prefix=prefix, error=str(exc))


_cache_instance: Optional[Cache] = None
_cache_lock = threading.Lock()


def get_cache() -> Cache:
    """Singleton lazy. Decide backend una sola vez."""
    global _cache_instance
    if _cache_instance is not None:
        return _cache_instance
    with _cache_lock:
        if _cache_instance is not None:
            return _cache_instance
        if settings.REDIS_URL:
            try:
                _cache_instance = _RedisCache(settings.REDIS_URL)
            except Exception as exc:
                log.warning("cache_redis_init_failed_falling_back", error=str(exc))
                _cache_instance = _InMemoryCache()
        else:
            _cache_instance = _InMemoryCache()
            log.info("cache_backend_inmemory")
        return _cache_instance
