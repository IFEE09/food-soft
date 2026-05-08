"""
conftest.py raíz — pytest lo carga ANTES de cualquier test.

Inyecta `backend/` (el directorio que contiene este archivo) al sys.path para que
`from app.* import ...` funcione independientemente de cómo se invoque pytest:
  - `pytest`
  - `python -m pytest`
  - `cd backend && pytest tests/`
  - desde CI con working-directory en cualquier nivel

Esta es la solución más robusta y portable: no depende de pyproject config,
ni de PYTHONPATH env vars, ni del cwd al momento de ejecución.
"""

import os
import sys

# Directorio donde está este archivo = raíz del paquete (backend/).
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)
