echo "Generating gRPC Python files..."

python -m grpc_tools.protoc \
    -I. \
    --python_out=. \
    --grpc_python_out=. \
    metrics.proto

echo "Done! Generated:"
echo "  - metrics_pb2.py"
echo "  - metrics_pb2_grpc.py"