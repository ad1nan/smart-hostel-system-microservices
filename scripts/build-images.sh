#!/bin/bash

# Build Docker images for Smart Hostel System
# Usage: ./build-images.sh [TAG]
# Default TAG: latest

set -e

TAG=${1:-latest}
API_URL=${API_URL:-http://localhost:4000}

echo "Building Smart Hostel System images with tag: $TAG"
echo "API URL for frontend: $API_URL"
echo ""

# Build frontend image
echo "Building frontend image..."
docker build \
  --build-arg REACT_APP_API_URL="$API_URL" \
  -t smart-hostel-frontend:$TAG \
  ./frontend

# Build service images
services=("api-gateway" "auth" "rooms" "devices" "alerts" "analytics")

for service in "${services[@]}"; do
  echo "Building $service image..."
  docker build -t smart-hostel-$service:$TAG ./services/$service
done

echo ""
echo "All images built successfully!"
echo ""
echo "Built images:"
echo "  smart-hostel-frontend:$TAG"
for service in "${services[@]}"; do
  echo "  smart-hostel-$service:$TAG"
done
