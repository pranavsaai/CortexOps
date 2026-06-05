from database import get_connection
from datetime import datetime


def create_incident(severity, message):

    conn = get_connection()
    cursor = conn.cursor()

    timestamp = datetime.now().isoformat()

    cursor.execute(
        """
        INSERT INTO incidents
        (severity, message, timestamp)
        VALUES (?, ?, ?)
        """,
        (severity, message, timestamp)
    )

    conn.commit()

    incident_id = cursor.lastrowid

    conn.close()

    return {
        "id": incident_id,
        "severity": severity,
        "message": message,
        "timestamp": timestamp
    }


def get_incidents():

    conn = get_connection()

    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, severity, message, timestamp
    FROM incidents
    ORDER BY id DESC
    """)

    rows = cursor.fetchall()

    conn.close()

    return [
        {
            "id": row[0],
            "severity": row[1],
            "message": row[2],
            "timestamp": row[3]
        }
        for row in rows
    ]