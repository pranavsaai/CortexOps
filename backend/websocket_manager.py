from fastapi import WebSocket
from typing import List
import json
import asyncio
from datetime import datetime


class ConnectionManager:
    """Manages all active WebSocket connections"""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connected! Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"WebSocket disconnected! Total: {len(self.active_connections)}")

    async def send_to_client(self, websocket: WebSocket, data: dict):
        """Send to specific client"""
        try:
            await websocket.send_json(data)
        except Exception as e:
            print(f"Send error: {e}")
            self.disconnect(websocket)

    async def broadcast(self, data: dict):
        """Broadcast to ALL connected clients"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception:
                disconnected.append(connection)

        # cleanup disconnected clients
        for conn in disconnected:
            self.disconnect(conn)

    @property
    def connection_count(self) -> int:
        return len(self.active_connections)


# singleton — one manager for entire app
manager = ConnectionManager()


async def stream_metrics(websocket: WebSocket):
    """
    Stream real-time metrics to a WebSocket client every 5 seconds!
    This is the core real-time loop.
    """
    from services.prometheus_service import get_cpu_usage, get_memory_usage, get_disk_usage
    from services.reliability_service import calculate_reliability, get_health_status

    await manager.connect(websocket)

    try:
        # send welcome message
        await websocket.send_json({
            "type": "connected",
            "message": "CortexOps real-time metrics stream connected!",
            "timestamp": datetime.now().isoformat()
        })

        while True:
            # fetch metrics
            cpu = get_cpu_usage()
            memory = get_memory_usage()
            disk = get_disk_usage()
            score = calculate_reliability(cpu, memory, disk)
            status = get_health_status(score)

            # send metrics update
            await websocket.send_json({
                "type": "metrics",
                "data": {
                    "cpu": cpu,
                    "memory": memory,
                    "disk": disk,
                    "reliability_score": score,
                    "health_status": status,
                    "active_connections": manager.connection_count,
                    "timestamp": datetime.now().isoformat()
                }
            })

            # alert if critical!
            if cpu > 80:
                await websocket.send_json({
                    "type": "alert",
                    "severity": "CRITICAL",
                    "message": f"CPU usage critical: {cpu}%",
                    "timestamp": datetime.now().isoformat()
                })
            if memory > 85:
                await websocket.send_json({
                    "type": "alert",
                    "severity": "WARNING",
                    "message": f"Memory usage high: {memory}%",
                    "timestamp": datetime.now().isoformat()
                })

            # wait 5 seconds before next update
            await asyncio.sleep(5)

    except Exception as e:
        print(f"WebSocket stream error: {e}")
    finally:
        manager.disconnect(websocket)