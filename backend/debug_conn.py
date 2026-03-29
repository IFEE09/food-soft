import os
import psycopg2
from urllib.parse import urlparse

def test_connection():
    db_url = os.getenv("DATABASE_URL")
    print("\n--- [INICIO DE DIAGNÓSTICO DE BASE DE DATOS] ---")
    
    if not db_url:
        print("ERROR: No se encontró la variable DATABASE_URL en el sistema.")
        return

    try:
        # Analizar la URL para mostrar el host y usuario (ocultando password)
        result = urlparse(db_url)
        print(f"Detectada conexión a:")
        print(f"  > Host: {result.hostname}")
        print(f"  > Usuario: {result.username}")
        print(f"  > Base de datos: {result.path.split('/')[-1]}")
        
        # Corregir el esquema para psycopg2 si es necesario
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
            
        print("\nIntentando conectar con psycopg2...")
        conn = psycopg2.connect(db_url)
        print("✅ ¡ÉXITO! La conexión se estableció correctamente.")
        
        cur = conn.cursor()
        cur.execute("SELECT version();")
        db_version = cur.fetchone()
        print(f"Versión de Postgres: {db_version[0]}")
        
        cur.close()
        conn.close()
        print("--- [FIN DE DIAGNÓSTICO: TODO OK] ---\n")
        
    except Exception as e:
        print(f"❌ FALLO EN LA CONEXIÓN: {str(e)}")
        print("--- [FIN DE DIAGNÓSTICO: ERROR] ---\n")

if __name__ == "__main__":
    test_connection()
