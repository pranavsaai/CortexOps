import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/cortexops")

# connection pool — real production pattern!
# min 2, max 10 connections
connection_pool = None

def init_pool():
    global connection_pool
    try:
        connection_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            dsn=DATABASE_URL
        )
        print("PostgreSQL connection pool initialized!")
    except Exception as e:
        print(f"Failed to init connection pool: {e}")
        raise

def get_connection():
    global connection_pool
    if connection_pool is None:
        init_pool()
    return connection_pool.getconn()

def release_connection(conn):
    global connection_pool
    if connection_pool and conn:
        connection_pool.putconn(conn)

def init_db():
    """Create tables if not exist"""
    conn = get_connection()
    try:
        cursor = conn.cursor()

        # incidents table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id SERIAL PRIMARY KEY,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # reliability history table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reliability_history (
                id SERIAL PRIMARY KEY,
                cpu REAL NOT NULL,
                memory REAL NOT NULL,
                disk REAL NOT NULL,
                score INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # api_keys table — for auth feature
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id SERIAL PRIMARY KEY,
                key_hash TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                last_used TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE
            )
        """)

        # request_logs table — for analytics
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS request_logs (
                id SERIAL PRIMARY KEY,
                endpoint TEXT NOT NULL,
                method TEXT NOT NULL,
                status_code INTEGER,
                response_time_ms REAL,
                api_key_id INTEGER REFERENCES api_keys(id),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        # index for faster queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_incidents_severity
            ON incidents(severity)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_history_created
            ON reliability_history(created_at)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint
            ON request_logs(endpoint, created_at)
        """)

        conn.commit()
        print("Database tables initialized successfully!")

    except Exception as e:
        conn.rollback()
        print(f"DB init failed: {e}")
        raise
    finally:
        release_connection(conn)