import grpc
from concurrent import futures
import time
from datetime import datetime
import sys
import os

# add parent to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import metrics_pb2
import metrics_pb2_grpc

from services.prometheus_service import get_cpu_usage, get_memory_usage, get_disk_usage
from services.reliability_service import calculate_reliability, get_health_status
from services.ai_service import get_ai_analysis, API_KEY

GRPC_PORT = int(os.getenv("GRPC_PORT", "50051"))


class MetricsServicer(metrics_pb2_grpc.MetricsServiceServicer):
    """gRPC implementation of MetricsService"""

    def GetCPU(self, request, context):
        print(f"gRPC GetCPU called by: {request.requester}")
        cpu = get_cpu_usage()
        return metrics_pb2.CPUResponse(
            cpu_percent=cpu,
            timestamp=datetime.now().isoformat(),
            source="psutil"
        )

    def GetMemory(self, request, context):
        print(f"gRPC GetMemory called by: {request.requester}")
        memory = get_memory_usage()
        return metrics_pb2.MemoryResponse(
            memory_percent=memory,
            timestamp=datetime.now().isoformat(),
            source="psutil"
        )

    def GetDisk(self, request, context):
        print(f"gRPC GetDisk called by: {request.requester}")
        disk = get_disk_usage()
        return metrics_pb2.DiskResponse(
            disk_percent=disk,
            timestamp=datetime.now().isoformat(),
            source="psutil"
        )

    def GetAllMetrics(self, request, context):
        print(f"gRPC GetAllMetrics called by: {request.requester}")
        cpu = get_cpu_usage()
        memory = get_memory_usage()
        disk = get_disk_usage()
        score = calculate_reliability(cpu, memory, disk)
        status = get_health_status(score)

        return metrics_pb2.AllMetricsResponse(
            cpu_percent=cpu,
            memory_percent=memory,
            disk_percent=disk,
            reliability_score=score,
            health_status=status,
            timestamp=datetime.now().isoformat()
        )


class AIServicer(metrics_pb2_grpc.AIServiceServicer):
    """gRPC implementation of AIService"""

    def AnalyzeInfrastructure(self, request, context):
        print(f"gRPC AnalyzeInfrastructure called")

        if not API_KEY:
            context.set_code(grpc.StatusCode.UNAVAILABLE)
            context.set_details("AI service not configured")
            return metrics_pb2.AnalyzeResponse()

        analysis = get_ai_analysis(
            request.cpu, request.memory, request.disk,
            request.containers_running, request.containers_stopped,
            request.reliability_score, []
        )

        return metrics_pb2.AnalyzeResponse(
            analysis=analysis,
            timestamp=datetime.now().isoformat()
        )


def serve():
    """Start gRPC server"""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    metrics_pb2_grpc.add_MetricsServiceServicer_to_server(MetricsServicer(), server)
    metrics_pb2_grpc.add_AIServiceServicer_to_server(AIServicer(), server)

    server.add_insecure_port(f"[::]:{GRPC_PORT}")
    server.start()

    print(f"gRPC server started on port {GRPC_PORT}")
    print(f"Services: MetricsService, AIService")

    try:
        while True:
            time.sleep(86400)  # keep alive
    except KeyboardInterrupt:
        server.stop(0)
        print("gRPC server stopped!")


if __name__ == "__main__":
    serve()