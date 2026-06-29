import subprocess
import sys
import os

def main():
    print("Starting CortexOps services...")
    
    # start gRPC server in background
    grpc_process = subprocess.Popen(
        [sys.executable, "grpc_server.py"],
        cwd=os.path.dirname(os.path.abspath(__file__))
    )
    print(f"gRPC server started (PID: {grpc_process.pid})")
    
    # start FastAPI
    os.system("python -m uvicorn main:app --reload --port 8000")

if __name__ == "__main__":
    main()