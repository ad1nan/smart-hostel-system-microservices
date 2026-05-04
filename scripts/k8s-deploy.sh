#!/bin/bash

# Deploy Smart Hostel System to Kubernetes
# Usage: ./k8s-deploy.sh

set -e

echo "🚀 Deploying Smart Hostel System to Kubernetes..."

# 1. Apply namespace
echo "📦 Creating namespace..."
kubectl apply -f k8s/namespace.yaml

# 2. Apply secrets
echo "🔐 Applying secrets..."
kubectl apply -f k8s/secrets/ -n smart-hostel

# 3. Apply configmaps
echo "⚙️ Applying configmaps..."
kubectl apply -f k8s/configmaps/ -n smart-hostel

# 4. Apply storage layer (MongoDB, MQTT, Redis)
echo "💾 Deploying storage layer..."
kubectl apply -f k8s/mongodb/ -f k8s/mqtt/ -f k8s/redis/ -n smart-hostel

# 5. Wait for MongoDB to be ready
echo "⏳ Waiting for MongoDB to be ready..."
kubectl rollout status statefulset/mongo -n smart-hostel --timeout=120s

# 6. Apply microservices
echo "🔧 Deploying microservices..."
kubectl apply -f k8s/services/ -n smart-hostel

# 7. Apply frontend and ingress
echo "🌐 Deploying frontend and ingress..."
kubectl apply -f k8s/frontend/ -f k8s/ingress/ -n smart-hostel

# 8. Apply HPAs
echo "📈 Deploying HorizontalPodAutoscalers..."
kubectl apply -f k8s/hpa/ -n smart-hostel

# 9. Show deployment status
echo ""
echo "✅ Deployment completed!"
echo ""
echo "📊 Current status:"
kubectl get all -n smart-hostel

echo ""
echo "🎉 Smart Hostel System deployed successfully!"
echo ""
echo "📝 To check pod health:"
echo "   kubectl get pods -n smart-hostel"
echo ""
echo "🌐 To access with minikube:"
echo "   minikube service frontend -n smart-hostel"
