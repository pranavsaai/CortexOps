# This is Kittu Style Code
# API Key Authentication — fixed connection handling! 🔥

import hashlib
import secrets
import os
from datetime import datetime
from database import get_connection, release_connection


def generate_api_key() -> str:
    return f"cx-{secrets.token_urlsafe(32)}"


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def create_api_key(name: str) -> dict:
    key = generate_api_key()
    key_hash = hash_key(key)

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO api_keys (key_hash, name, created_at)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (key_hash, name, datetime.now())
        )
        key_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        return {
            "id": key_id,
            "key": key,
            "name": name,
            "message": "Save this key — it won't be shown again!"
        }
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            release_connection(conn)
        except Exception:
            pass


def validate_api_key(key: str):
    if not key:
        return None

    key_hash = hash_key(key)
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, name, is_active
            FROM api_keys
            WHERE key_hash = %s
            """,
            (key_hash,)
        )
        row = cursor.fetchone()

        if not row:
            cursor.close()
            return None

        key_id, name, is_active = row

        if not is_active:
            cursor.close()
            return None

        cursor.execute(
            "UPDATE api_keys SET last_used = %s WHERE id = %s",
            (datetime.now(), key_id)
        )
        conn.commit()
        cursor.close()
        return {"id": key_id, "name": name}

    except Exception:
        return None
    finally:
        try:
            release_connection(conn)
        except Exception:
            pass


def list_api_keys() -> list:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, created_at, last_used, is_active
            FROM api_keys
            ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        cursor.close()
        return [
            {
                "id": row[0],
                "name": row[1],
                "created_at": str(row[2]),
                "last_used": str(row[3]) if row[3] else None,
                "is_active": row[4]
            }
            for row in rows
        ]
    finally:
        try:
            release_connection(conn)
        except Exception:
            pass


def revoke_api_key(key_id: int) -> bool:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE api_keys SET is_active = FALSE WHERE id = %s",
            (key_id,)
        )
        conn.commit()
        affected = cursor.rowcount
        cursor.close()
        return affected > 0
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise e
    finally:
        try:
            release_connection(conn)
        except Exception:
            pass