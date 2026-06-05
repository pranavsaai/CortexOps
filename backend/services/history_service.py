from database import get_connection
from datetime import datetime


def save_snapshot(cpu, memory, disk, score):

    conn = get_connection()

    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO reliability_history
        (cpu, memory, disk, score, timestamp)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            cpu,
            memory,
            disk,
            score,
            datetime.now().isoformat()
        )
    )

    conn.commit()
    conn.close()


def get_history():

    conn = get_connection()

    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            cpu,
            memory,
            disk,
            score,
            timestamp
        FROM reliability_history
        ORDER BY id DESC
        LIMIT 50
    """)

    rows = cursor.fetchall()

    conn.close()

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