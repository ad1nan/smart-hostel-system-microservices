#!/bin/bash

# Tear down Smart Hostel System from Kubernetes
# Usage: ./k8s-teardown.sh

set -e

echo "🗑️  Tearing down Smart Hostel System from Kubernetes..."

# Delete the entire namespace (this will delete all resources within it)
echo "🪛 Deleting namespace smart-hostel..."
kubectl delete namespace smart-hostel

echo ""
echo "✅ Smart Hostel System torn down successfully!"
echo ""
echo "📝 Note: PersistentVolumeClaims for MongoDB and MQTT data are preserved."
echo "   To delete them manually:"
echo "   kubectl get pvc -n smart-hostel"
echo "   kubectl delete pvc <pvc-name> -n smart-hostel"
