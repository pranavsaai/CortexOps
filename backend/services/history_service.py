from database import get_connection, release_connection
from datetime import datetime


def save_snapshot(cpu: float, memory: float, disk: float, score: int) -> None:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO reliability_history (cpu, memory, disk, score, timestamp)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (cpu, memory, disk, score, datetime.now().isoformat())
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def get_history(limit: int = 50) -> list:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT cpu, memory, disk, score, timestamp
            FROM reliability_history
            ORDER BY id DESC
            LIMIT %s
            """,
            (limit,)
        )
        rows = cursor.fetchall()
        return [
            {
                "cpu": row[0],
                "memory": row[1],
                "disk": row[2],
                "score": row[3],
                "timestamp": row[4]
            }
            for row in rows
        ]
    finally:
        release_connection(conn)


def log_request(endpoint: str, method: str, status_code: int,
                response_time_ms: float, api_key_id: int = None) -> None:
    """Log every API request — analytics ke liye!"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO request_logs
            (endpoint, method, status_code, response_time_ms, api_key_id)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (endpoint, method, status_code, response_time_ms, api_key_id)
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Request log failed: {e}")  # don't crash for logging
    finally:
        release_connection(conn)


def get_request_analytics() -> dict:
    """Endpoint analytics — how many calls, avg response time"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                endpoint,
                COUNT(*) as total_calls,
                AVG(response_time_ms) as avg_response_ms,
                MAX(response_time_ms) as max_response_ms
            FROM request_logs
            WHERE created_at > NOW() - INTERVAL '24 hours'
            GROUP BY endpoint
            ORDER BY total_calls DESC
        """)
        rows = cursor.fetchall()
        return [
            {
                "endpoint": row[0],
                "total_calls": row[1],
                "avg_response_ms": round(row[2], 2) if row[2] else 0,
                "max_response_ms": round(row[3], 2) if row[3] else 0
            }
            for row in rows
        ]
    finally:
        release_connection(conn)