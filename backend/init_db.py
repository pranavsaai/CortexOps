from database import get_connection

conn = get_connection()

cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TEXT NOT NULL
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS reliability_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cpu REAL NOT NULL,
    memory REAL NOT NULL,
    disk REAL NOT NULL,
    score INTEGER NOT NULL,
    timestamp TEXT NOT NULL
)
""")

conn.commit()
conn.close()

print("Database initialized")