# Kubernetes Informer - Quick Reference

## 📁 New File Structure

```
src/
├── k8s/
│   ├── types.ts                    # 🔧 Resource configurations (EDIT THIS)
│   ├── generic-informer.ts         # 📡 Universal watch handler
│   ├── generic-sync.ts             # 🔄 Universal sync handler
│   ├── optimized-init.ts           # 🚀 Initialization
│   ├── health-monitor.ts           # 🏥 Health monitoring
│   └── README.md                   # 📚 This file
├── api/
│   ├── generic-routes.ts           # 🛣️  Route generator
│   └── routes.ts                   # 🚀 Main API router
└── models/
    ├── Pod.ts                      # ✅ Existing
    ├── Deployment.ts               # ✅ Existing
    ├── Service.ts                  # ✅ Existing
    ├── Node.ts                     # ✅ Existing
    ├── StatefulSet.ts              # ✅ Existing
    ├── DaemonSet.ts                # ✅ Existing
    ├── ConfigMap.ts                # ✅ Existing
    ├── Secret.ts                   # ✅ Existing
    ├── Ingress.ts                  # ✅ Existing
    ├── PersistentVolumeClaim.ts    # ✅ Existing
    ├── PersistentVolume.ts         # ✅ Existing
    ├── Event.ts                    # ✅ Existing
    └── CustomResourceDefinition.ts # ✅ Existing
```

## 🚀 Quick Start

### 1. Add New Resource (30 seconds)

```typescript
// 1. Create model: src/models/CronJob.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ICronJob extends Document {
  namespace: string;
  name: string;
  uid: string;
  schedule: string;
  suspend: boolean;
  raw: any;
}

const CronJobSchema = new Schema({
  namespace: { type: String, required: true, index: true },
  name: { type: String, required: true, index: true },
  uid: { type: String, required: true, unique: true },
  schedule: String,
  suspend: Boolean,
  raw: Schema.Types.Mixed,
}, { timestamps: true });

export default mongoose.models.CronJob || mongoose.model<ICronJob>('CronJob', CronJobSchema);

// 2. Add config to src/k8s/types.ts (add 1 entry to RESOURCE_CONFIGS array)
import CronJob from '../models/CronJob';

{
  name: 'CronJob',
  apiVersion: 'batch/v1',
  kind: 'CronJob',
  plural: 'cronjobs',
  namespaced: true,
  model: CronJob,
  icon: '⏰',
  getIdKey: () => 'uid',
  transformer: (cj) => ({
    namespace: cj.metadata?.namespace,
    name: cj.metadata?.name,
    uid: cj.metadata?.uid,
    schedule: cj.spec?.schedule,
    suspend: cj.spec?.suspend || false,
    raw: cj,
  }),
}

// 3. Done! Restart server and you have:
// - GET /api/v1/cronjobs
// - GET /api/v1/cronjobs/:uid
// - GET /api/v1/namespace/:ns/cronjobs
// - Automatic sync & watch
```

### 2. Update keystone.ts

The project already uses the optimized architecture. In `keystone.ts`:

```typescript
import {
  initializeK8sInformer,
  setupShutdownHandlers,
} from './src/k8s/optimized-init';
import routes from './src/api/routes';

// In extendExpressApp:
server: {
  extendExpressApp(app, context) {
    // Initialize Kubernetes Informer (syncs all resources + starts watching)
    initializeK8sInformer().catch(err => {
      console.error('❌ Failed to initialize Kubernetes Informer:', err)
    })

    // Setup graceful shutdown handlers
    setupShutdownHandlers()

    // Mount K8s API routes
    app.use('/api/v1', routes)
  },
}
```

### 3. Test It

```bash
# Start server
npm run dev

# Check available resources
curl http://localhost:3000/api/v1/resources

# Get health status
curl http://localhost:3000/api/v1/status

# Query new resources
curl http://localhost:3000/api/v1/statefulsets
curl http://localhost:3000/api/v1/configmaps?namespace=default
curl http://localhost:3000/api/v1/events

# Get statistics
curl http://localhost:3000/api/v1/stats/overview
```

## 📊 API Endpoints

### Universal Endpoints (work for ALL resources)

```bash
# List resources
GET /api/v1/{resource}
  ?page=1              # Page number (default: 1)
  &limit=10            # Items per page (default: 10)
  &namespace=default   # Filter by namespace
  &search=nginx        # Search by name (regex)

# Get single resource
GET /api/v1/{resource}/:uid

# Namespace-scoped list
GET /api/v1/namespace/:ns/{resource}
```

### Examples

```bash
# Pods
curl http://localhost:3000/api/v1/pods
curl http://localhost:3000/api/v1/pods?namespace=kube-system
curl http://localhost:3000/api/v1/pods?search=nginx
curl http://localhost:3000/api/v1/namespace/kube-system/pods

# Deployments
curl http://localhost:3000/api/v1/deployments
curl http://localhost:3000/api/v1/deployments?limit=20

# StatefulSets (NEW!)
curl http://localhost:3000/api/v1/statefulsets
curl http://localhost:3000/api/v1/statefulsets?namespace=default

# ConfigMaps
curl http://localhost:3000/api/v1/configmaps

# Secrets
curl http://localhost:3000/api/v1/secrets?namespace=default

# Events
curl http://localhost:3000/api/v1/events?limit=50

# Ingresses
curl http://localhost:3000/api/v1/ingresses

# DaemonSets
curl http://localhost:3000/api/v1/daemonsets

# PersistentVolumes
curl http://localhost:3000/api/v1/persistentvolumes

# PersistentVolumeClaims
curl http://localhost:3000/api/v1/persistentvolumeclaims

# CustomResourceDefinitions
curl http://localhost:3000/api/v1/customresourcedefinitions
```

### System Endpoints

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Overall statistics
curl http://localhost:3000/api/v1/stats/overview
# Response:
{
  "pods": { "total": 50, "running": 45, "failed": 2, "pending": 3 },
  "deployments": 15,
  "statefulsets": 5,
  "services": 20,
  "configmaps": 30,
  "secrets": 25,
  "ingresses": 8,
  "daemonsets": 3,
  "persistentVolumes": 10,
  "persistentVolumeClaims": 15,
  "events": 150,
  "nodes": { "total": 3, "ready": 3 },
  "customResourceDefinitions": 5
}

# Informer status
curl http://localhost:3000/api/v1/status
# Response:
{
  "timestamp": "2025-01-06T10:00:00.000Z",
  "informers": [
    { "name": "Pod", "watching": true },
    { "name": "Deployment", "watching": true },
    { "name": "StatefulSet", "watching": true },
    { "name": "DaemonSet", "watching": true },
    { "name": "Service", "watching": true },
    { "name": "ConfigMap", "watching": true },
    { "name": "Secret", "watching": true },
    { "name": "Ingress", "watching": true },
    { "name": "PersistentVolume", "watching": true },
    { "name": "PersistentVolumeClaim", "watching": true },
    { "name": "Event", "watching": true },
    { "name": "Node", "watching": true },
    { "name": "CustomResourceDefinition", "watching": true }
  ]
}

# List all supported resources
curl http://localhost:3000/api/v1/resources
```

## 🔧 Configuration

### Resource Config Options

```typescript
interface K8sResourceConfig {
  name: string // Display name
  apiVersion: string // K8s API version (e.g., 'v1', 'apps/v1')
  kind: string // K8s kind (must match metadata.name)
  plural: string // Plural form (used in URLs)
  namespaced: boolean // Is resource namespaced?
  model: Model // Mongoose model
  icon: string // Emoji for logging
  getIdKey: () => string // Field to use as unique ID
  transformer: (k8sObj) => any // Transform K8s object to MongoDB doc
}
```

### Custom Transformers

```typescript
// Simple transformer
transformer: pod => ({
  namespace: pod.metadata?.namespace,
  name: pod.metadata?.name,
  uid: pod.metadata?.uid,
  phase: pod.status?.phase,
  raw: pod,
})

// Complex transformer with nested objects
transformer: ingress => ({
  namespace: ingress.metadata?.namespace,
  name: ingress.metadata?.name,
  uid: ingress.metadata?.uid,
  rules: (ingress.spec?.rules || []).map(rule => ({
    host: rule.host,
    paths: rule.http?.paths?.map(path => ({
      path: path.path,
      pathType: path.pathType,
      backend: path.backend?.service?.name,
    })),
  })),
  tls: ingress.spec?.tls?.map(tls => ({
    hosts: tls.hosts,
    secretName: tls.secretName,
  })),
  raw: ingress,
})

// Transformer with error handling
transformer: deployment => {
  try {
    return {
      namespace: deployment.metadata?.namespace || 'default',
      name: deployment.metadata?.name || 'unknown',
      replicas: deployment.spec?.replicas || 0,
      readyReplicas: deployment.status?.readyReplicas || 0,
      raw: deployment,
    }
  } catch (error) {
    console.error('Error transforming deployment:', error)
    return {
      namespace: deployment.metadata?.namespace,
      name: deployment.metadata?.name,
      error: 'Transformation failed',
      raw: deployment,
    }
  }
}
```

## 🩺 Health Monitoring

### Enable Custom Health Checks

```typescript
import { initHealthMonitor } from './k8s/health-monitor'

// In your initialization
const monitor = initHealthMonitor({
  intervalMs: 30000, // Check every 30 seconds
  maxRetries: 5, // Try to reconnect 5 times
  retryDelayMs: 5000, // Wait 5 seconds between retries
  autoReconnect: true, // Automatically reconnect on failure
})

monitor.start()
```

### Check Health Programmatically

```typescript
import { getHealthMonitor } from './k8s/health-monitor'

const monitor = getHealthMonitor()

// Get all resource health
const health = monitor.getHealthStatus()
health.forEach(h => {
  console.log(`${h.resourceType}: ${h.isHealthy ? '✅' : '❌'}`)
})

// Check specific resource
const podHealth = monitor.getResourceHealth('Pod')
console.log('Pod last error:', podHealth?.lastError)

// Check if all healthy
if (monitor.isAllHealthy()) {
  console.log('All systems operational!')
}
```

## 📈 Performance Tips

### 1. Use Bulk Operations (Automatic)

The system already uses `bulkWrite()` for sync operations.

### 2. Selective Field Exclusion

```typescript
// Don't return raw K8s objects in API responses
Model.find(query).select('-raw') // Saves bandwidth
```

### 3. Add Indexes

```typescript
// In your model schemas
MySchema.index({ namespace: 1, name: 1 })
MySchema.index({ createdAt: -1 })
MySchema.index({ status: 1 })
```

### 4. Limit Resource Versions

```typescript
// Optional: Implement TTL for old resource versions
MySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 }) // 24 hours
```

## 🐛 Debugging

### Enable Debug Logging

```typescript
// In keystone.ts
export const extendExpressApp = async (app: express.Express) => {
  // Add debug flag
  process.env.DEBUG_K8S = 'true'

  await connectDB()
  await initializeK8sInformer()

  app.use('/api/v1', routes)
}
```

### Check Informer Status

```bash
# Get real-time status
curl http://localhost:3000/api/v1/status

# Check logs for errors
npm run dev | grep "❌"

# Check specific resource logs
npm run dev | grep "StatefulSet"
```

### Common Issues

**Issue:** Informer not receiving events

```bash
# Check RBAC permissions
kubectl auth can-i list pods --all-namespaces
kubectl auth can-i watch deployments --all-namespaces
```

**Issue:** MongoDB connection errors

```bash
# Check MongoDB is running
mongosh --eval "db.stats()"

# Check connection string
echo $MONGODB_URI
```

**Issue:** Routes return 404

```bash
# Verify informer started
curl http://localhost:3000/api/v1/status

# Check MongoDB has data
mongosh k8s-resources --eval "db.pods.countDocuments()"
```

## 📚 Additional Resources

- [OPTIMIZATION.md](./OPTIMIZATION.md) - Detailed optimization guide
- [CLAUDE.md](./CLAUDE.md) - Original project documentation
- [K8s API Reference](https://kubernetes.io/docs/reference/kubernetes-api/)
- [Mongoose Docs](https://mongoosejs.com/docs/)

## 🆘 Quick Help

```bash
# See all available resources
curl http://localhost:3000/api/v1/resources

# Get system health
curl http://localhost:3000/api/v1/status

# Get statistics
curl http://localhost:3000/api/v1/stats/overview

# Test specific resource
curl http://localhost:3000/api/v1/pods?limit=1
```

---

**Summary:** One config change = New resource fully integrated with sync, watch, and API!
