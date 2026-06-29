import requests
import psutil

PROMETHEUS_URL = "http://localhost:9090"

def get_cpu_usage() -> float:
    value = execute_query("""
        100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
    """)
    if value is not None:
        return round(value, 2)
    # interval=0 — non-blocking! gRPC compatible!
    return round(psutil.cpu_percent(interval=0), 2)

def get_memory_usage() -> float:
    value = execute_query("""
        (1-(node_memory_MemAvailable_bytes/node_memory_MemTotal_bytes))*100
    """)
    if value is not None:
        return round(value, 2)
    mem = psutil.virtual_memory()
    return round(mem.percent, 2)

def get_disk_usage() -> float:
    value = execute_query("""
        (1-(node_filesystem_avail_bytes{mountpoint="/etc/hosts"}/node_filesystem_size_bytes{mountpoint="/etc/hosts"}))*100
    """)
    if value is not None:
        return round(value, 2)
    disk = psutil.disk_usage("/")
    return round(disk.percent, 2)

def execute_query(query: str):
    try:
        response = requests.get(
            f"{PROMETHEUS_URL}/api/v1/query",
            params={"query": query},
            timeout=2
        )
        result = response.json()
        if not result["data"]["result"]:
            return None
        return float(result["data"]["result"][0]["value"][1])
    except Exception:
        return None