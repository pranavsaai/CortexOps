# Stage 1 — build stage
FROM python:3.11-slim as builder

WORKDIR /app

# install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# copy requirements first — Docker cache optimization!
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2 — production stage
FROM python:3.11-slim

WORKDIR /app

# install runtime dependencies only
RUN apt-get update && apt-get install -y \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# copy app code
COPY . .

# generate gRPC files
RUN python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. metrics.proto

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000 50051

# start both FastAPI + gRPC server
CMD ["sh", "-c", "python grpc_server.py & python -m uvicorn main:app --host 0.0.0.0 --port 8000"]