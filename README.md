# Smart Hostel System

A comprehensive microservices-based hostel management system with real-time energy monitoring, device control, and analytics.

## Architecture

### Services
- **Frontend** - React application served by Nginx
- **API Gateway** - Express gateway with authentication and rate limiting
- **Auth Service** - JWT-based authentication and user management
- **Rooms Service** - Room management and booking
- **Devices Service** - IoT device control and monitoring
- **Analytics Service** - Energy usage analytics and reporting
- **Alerts Service** - Real-time alert management
- **MQTT Broker** - Mosquitto for IoT communication
- **MongoDB** - Primary data storage
- **Redis** - Rate limiting and caching

## Docker Compose Development

To run the system locally with Docker Compose:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Kubernetes Deployment

### Prerequisites

- **kubectl** - Kubernetes command-line tool
- **Docker** - For building container images
- **Kubernetes cluster** - Minikube, Docker Desktop, or any K8s cluster
- **Nginx Ingress Controller** - For external access

### Step-by-Step Deployment

#### 1. Configure Secrets

Edit the secrets in `k8s/secrets/secrets.yaml` and replace placeholder values:

```bash
# Generate base64 values for secrets
echo -n "your-jwt-secret" | base64
echo -n "your-mqtt-password" | base64
echo -n "hostel_ingest:your-mqtt-password" | base64
```

#### 2. Build Container Images

```bash
# Build all images with default tag 'latest'
./scripts/build-images.sh

# Or with custom tag
./scripts/build-images.sh v1.0.0

# For production, set the correct API URL
API_URL=https://your-ingress-ip ./scripts/build-images.sh
```

#### 3. Deploy to Kubernetes

```bash
# Deploy the entire system
./scripts/k8s-deploy.sh
```

#### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -n smart-hostel

# Check services
kubectl get services -n smart-hostel

# Check ingress
kubectl get ingress -n smart-hostel
```

#### 5. Access the Application

**With Minikube:**
```bash
minikube service frontend -n smart-hostel
```

**With LoadBalancer:**
```bash
kubectl get ingress smart-hostel-ingress -n smart-hostel
# Access via the external IP/hostname shown
```

### ⚠️ Important Constraints

> **Warning:** The `devices` and `analytics` services are configured with single replica constraints due to MQTT publisher/subscriber patterns. Multiple replicas would cause duplicate message processing and alert insertions without implementing distributed locks or message deduplication layers.

### Health Monitoring

Monitor your deployment with these commands:

```bash
# Watch pod status in real-time
watch kubectl get pods -n smart-hostel

# Check pod logs
kubectl logs -f deployment/auth -n smart-hostel
kubectl logs -f deployment/analytics -n smart-hostel

# Check resource usage
kubectl top pods -n smart-hostel
```

### Scaling

The system includes HorizontalPodAutoscalers for:
- auth (1-3 replicas)
- rooms (1-3 replicas) 
- alerts (1-3 replicas)
- analytics (1-3 replicas)
- api-gateway (1-3 replicas)

**Note:** `devices` service does not have an HPA due to MQTT constraints.

### Teardown

To remove the entire deployment:

```bash
./scripts/k8s-teardown.sh
```

This will delete the `smart-hostel` namespace and all resources within it. PersistentVolumeClaims for data are preserved and must be deleted manually if needed.

## Development

### Local Development

Each service can be developed independently:

```bash
# Start individual service
cd services/auth
npm install
npm run dev

# Start frontend
cd frontend
npm install
npm start
```

### Environment Variables

See `.env.example` for required environment variables. Copy to `.env` and configure:

```bash
cp .env.example .env
```

## API Documentation

### Authentication Endpoints
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - User logout

### Room Management
- `GET /rooms` - List all rooms
- `GET /rooms/:id` - Get room details

### Device Control
- `GET /devices` - List all devices
- `POST /devices/toggle/:id` - Toggle device state

### Analytics
- `GET /analytics/heatmap` - Energy usage heatmap
- `GET /analytics/devices` - Device analytics
- `GET /analytics/timeseries` - Time series data
- `GET /analytics/forecast` - Energy forecast

### Alerts
- `GET /alerts` - List all alerts
- `PATCH /alerts/:id/resolve` - Resolve alert

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with Docker Compose
5. Submit a pull request

## License

This project is licensed under the ISC License.
