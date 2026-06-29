import docker

try:
    client = docker.from_env()
except Exception:
    client = None  # Docker not running — gracefully handle!

def get_containers():
    if client is None:
        return []  # empty list return cheyyi — crash avvadam ledu
    try:
        containers = client.containers.list(all=True)
        return [
            {
                "id": c.short_id,
                "name": c.name,
                "status": c.status,
                "image": c.image.tags[0] if c.image.tags else "unknown"
            }
            for c in containers
        ]
    except Exception:
        return []