from database import get_connection, release_connection
from datetime import datetime


def create_incident(severity: str, message: str) -> dict:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        timestamp = datetime.now().isoformat()

        # PostgreSQL uses %s instead of ? — key difference from SQLite!
        cursor.execute(
            """
            INSERT INTO incidents (severity, message, timestamp)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (severity, message, timestamp)
        )

        incident_id = cursor.fetchone()[0]
        conn.commit()

        return {
            "id": incident_id,
            "severity": severity,
            "message": message,
            "timestamp": timestamp
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def get_incidents(limit: int = 50) -> list:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, severity, message, timestamp
            FROM incidents
            ORDER BY id DESC
            LIMIT %s
            """,
            (limit,)
        )
        rows = cursor.fetchall()
        return [
            {
                "id": row[0],
                "severity": row[1],
                "message": row[2],
                "timestamp": row[3]
            }
            for row in rows
        ]
    finally:
        release_connection(conn)


def get_incident_stats() -> dict:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT severity, COUNT(*) as count
            FROM incidents
            GROUP BY severity
        """)
        rows = cursor.fetchall()
        stats = {"INFO": 0, "WARNING": 0, "CRITICAL": 0}
        for row in rows:
            stats[row[0]] = row[1]
        return stats
    finally:
        release_connection(conn)