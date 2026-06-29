import requests
import psutil

PROMETHEUS_URL = "http://localhost:9090"

def _prometheus_available() -> bool:
    """Check if Prometheus is running"""
    try:
        response = requests.get(f"{PROMETHEUS_URL}/-/healthy", timeout=2)
        return response.status_code == 200
    except Exception:
        return False

def get_cpu_usage() -> float:
    """CPU usage — Prometheus first, psutil fallback"""
    query = """
    100 - (
        avg by(instance)
        (
            rate(
                node_cpu_seconds_total{mode="idle"}[5m]
            )
        ) * 100
    )
    """
    value = execute_query(query)
    if value is not None:
        return round(value, 2)

    # fallback — psutil direct
    return round(psutil.cpu_percent(interval=1), 2)

def get_memory_usage() -> float:
    """Memory usage — Prometheus first, psutil fallback"""
    query = """
    (
        1 -
        (
            node_memory_MemAvailable_bytes
            /
            node_memory_MemTotal_bytes
        )
    ) * 100
    """
    value = execute_query(query)
    if value is not None:
        return round(value, 2)

    # fallback — psutil direct
    mem = psutil.virtual_memory()
    return round(mem.percent, 2)

def get_disk_usage() -> float:
    """Disk usage — Prometheus first, psutil fallback"""
    query = """
    (
        1 -
        (
            node_filesystem_avail_bytes{
                mountpoint="/etc/hosts"
            }
            /
            node_filesystem_size_bytes{
                mountpoint="/etc/hosts"
            }
        )
    ) * 100
    """
    value = execute_query(query)
    if value is not None:
        return round(value, 2)

    # fallback — psutil direct
    disk = psutil.disk_usage("/")
    return round(disk.percent, 2)

def execute_query(query: str):
    """Execute Prometheus query — returns None if unavailable"""
    try:
        response = requests.get(
            f"{PROMETHEUS_URL}/api/v1/query",
            params={"query": query},
            timeout=3
        )
        result = response.json()
        if not result["data"]["result"]:
            return None
        return float(result["data"]["result"][0]["value"][1])
    except Exception:
        return None  # graceful fallback!