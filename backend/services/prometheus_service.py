from unittest import result

import requests

PROMETHEUS_URL = "http://localhost:9090"


def get_cpu_usage():

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

    if value is None:
        return 0

    return round(value, 2)

def get_memory_usage():

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

    response = requests.get(
        f"{PROMETHEUS_URL}/api/v1/query",
        params={"query": query}
    )

    result = response.json()

    memory = float(
        result["data"]["result"][0]["value"][1]
    )

    return round(memory, 2)

def get_disk_usage():

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

    response = requests.get(
        f"{PROMETHEUS_URL}/api/v1/query",
        params={"query": query}
    )

    result = response.json()

    if not result["data"]["result"]:
        return 0.0

    disk = float(
        result["data"]["result"][0]["value"][1]
    )

    return round(disk, 2)

def execute_query(query):

    try:
        response = requests.get(
            f"{PROMETHEUS_URL}/api/v1/query",
            params={"query": query},
            timeout=5
        )

        result = response.json()

        if not result["data"]["result"]:
            return None

        return float(
            result["data"]["result"][0]["value"][1]
        )

    except Exception:
        return None