import redis
import json
import os
from datetime import datetime

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Redis client — singleton pattern
redis_client = None

def get_redis():
    global redis_client
    if redis_client is None:
        try:
            redis_client = redis.from_url(REDIS_URL, decode_responses=True)
            redis_client.ping()
            print("Redis connected!")
        except Exception as e:
            print(f"Redis not available: {e} — running without cache!")
            redis_client = None
    return redis_client

def cache_set(key: str, value: dict, ttl: int = 30) -> bool:
    """Set cache with TTL in seconds"""
    r = get_redis()
    if r is None:
        return False
    try:
        r.setex(key, ttl, json.dumps(value))
        return True
    except Exception as e:
        print(f"Cache set failed: {e}")
        return False

def cache_get(key: str) -> dict | None:
    """Get from cache — returns None if miss or error"""
    r = get_redis()
    if r is None:
        return None
    try:
        data = r.get(key)
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        print(f"Cache get failed: {e}")
        return None

def cache_delete(key: str) -> bool:
    """Delete cache key"""
    r = get_redis()
    if r is None:
        return False
    try:
        r.delete(key)
        return True
    except Exception:
        return False

def cache_delete_pattern(pattern: str) -> int:
    """Delete all keys matching pattern"""
    r = get_redis()
    if r is None:
        return 0
    try:
        keys = r.keys(pattern)
        if keys:
            return r.delete(*keys)
        return 0
    except Exception:
        return 0

def get_cache_stats() -> dict:
    """Redis stats — for monitoring!"""
    r = get_redis()
    if r is None:
        return {"status": "unavailable"}
    try:
        info = r.info()
        return {
            "status": "connected",
            "used_memory_human": info.get("used_memory_human"),
            "connected_clients": info.get("connected_clients"),
            "total_commands_processed": info.get("total_commands_processed"),
            "keyspace_hits": info.get("keyspace_hits", 0),
            "keyspace_misses": info.get("keyspace_misses", 0),
            "hit_rate": round(
                info.get("keyspace_hits", 0) /
                max(info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0), 1)
                * 100, 2
            )
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}