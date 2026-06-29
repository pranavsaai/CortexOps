import grpc
import os
from datetime import datetime

import metrics_pb2
import metrics_pb2_grpc

GRPC_HOST = os.getenv("GRPC_HOST", "localhost")
GRPC_PORT = int(os.getenv("GRPC_PORT", "50051"))

# channel — reuse cheyyi, don't create every request!
_channel = None
_metrics_stub = None
_ai_stub = None

def get_stubs():
    global _channel, _metrics_stub, _ai_stub
    if _channel is None:
        _channel = grpc.insecure_channel(f"{GRPC_HOST}:{GRPC_PORT}")
        _metrics_stub = metrics_pb2_grpc.MetricsServiceStub(_channel)
        _ai_stub = metrics_pb2_grpc.AIServiceStub(_channel)
    return _metrics_stub, _ai_stub


def get_metrics_via_grpc(requester: str = "api-gateway") -> dict:
    """Fetch all metrics via gRPC — inter-service communication!"""
    try:
        metrics_stub, _ = get_stubs()
        request = metrics_pb2.MetricsRequest(requester=requester)
        response = metrics_stub.GetAllMetrics(request, timeout=30)

        return {
            "cpu": response.cpu_percent,
            "memory": response.memory_percent,
            "disk": response.disk_percent,
            "reliability_score": response.reliability_score,
            "health_status": response.health_status,
            "timestamp": response.timestamp,
            "source": "grpc"
        }
    except grpc.RpcError as e:
        print(f"gRPC error: {e.code()} — {e.details()}")
        return None
    except Exception as e:
        print(f"gRPC client error: {e}")
        return None


def analyze_via_grpc(cpu: float, memory: float, disk: float,
                     running: int, stopped: int, score: int) -> str:
    """AI analysis via gRPC"""
    try:
        _, ai_stub = get_stubs()
        request = metrics_pb2.AnalyzeRequest(
            cpu=cpu, memory=memory, disk=disk,
            containers_running=running,
            containers_stopped=stopped,
            reliability_score=score
        )
        response = ai_stub.AnalyzeInfrastructure(request, timeout=30)
        return response.analysis
    except grpc.RpcError as e:
        print(f"gRPC AI error: {e.code()} — {e.details()}")
        return None
    except Exception as e:
        print(f"gRPC client error: {e}")
        return None