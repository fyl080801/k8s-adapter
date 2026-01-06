# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Keystone 6** headless CMS with integrated **Kubernetes Informer** functionality. The application serves two purposes:

1. **Keystone CMS**: Provides Admin UI for content management (Users, Posts, Tags)
2. **K8s Resource Sync**: Real-time synchronization of Kubernetes resources to MongoDB with RESTful API access

The system uses:

- **SQLite** (via Prisma) for Keystone's internal data
- **MongoDB** for Kubernetes resource storage
- **@kubernetes/client-node** for K8s API interaction

## Development Commands

### Primary Development

```bash
npm run dev          # Start Keystone dev server with hot reload (port 3000)
npm run build        # Build for production
npm start            # Start production server
npm run db:generate  # Regenerate Prisma client (after schema changes)
```

### Code Quality

```bash
npm run lint         # Check TypeScript code with ESLint
npm run lint:fix     # Auto-fix linting issues
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
```

### Testing

```bash
npm run test:api     # Test K8s API endpoints (uses ./scripts/test-api.sh)
```

### Manual API Testing

```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/pods
curl http://localhost:3000/api/v1/stats/overview
```

## AI-Assisted Development with Context7 MCP

This project is configured to use **Context7 MCP** (Model Context Protocol) for intelligent code assistance. Context7 provides up-to-date documentation and code examples for all libraries used in this project.

### Available Context7 Features

When working with this codebase, you can leverage Context7 for:

1. **Library Documentation**: Get latest docs for any library (Keystone, Kubernetes client, Mongoose, etc.)
2. **Code Examples**: Real-world code snippets and best practices
3. **API References**: Function signatures, parameters, and return types
4. **Troubleshooting**: Common issues and solutions

### Key Libraries Covered by Context7

- `@keystone-6/core` - Keystone CMS framework
- `@keystone-6/auth` - Authentication system
- `@kubernetes/client-node` - Kubernetes API client
- `mongoose` - MongoDB ODM
- `express` - Web framework
- `prisma` - Database ORM

### Using Context7 During Development

When you need help with a library, ask questions like:

- "How do I add a new field to a Keystone list?"
- "Show me examples of Kubernetes Informer watch handlers"
- "What are the best practices for Mongoose schema design?"
- "How do I implement pagination in Express routes?"

Context7 will automatically retrieve the most current documentation and examples.

## Architecture

### Dual-Database Design

The application uses **two separate databases**:

1. **SQLite** (`keystone.db`): Keystone's internal database for CMS data
   - Managed by Prisma
   - Schema defined in `schema.prisma`
   - Lists: User, Post, Tag

2. **MongoDB**: Kubernetes resource storage
   - Managed by Mongoose
   - Models: Pod, Deployment, Service, Node
   - Connection via `src/lib/mongodb.ts`

### Startup Sequence (keystone.ts:32-44)

When Keystone starts, `extendExpressApp` executes:

1. **MongoDB Connection** via `connectDB()`
2. **Full Sync** of all K8s resources to MongoDB (`KubernetesSync.syncAll()`)
3. **Informer Start** for real-time watch (`KubernetesInformer.start()`)
4. **API Routes** mounted at `/api/v1`

This sequence runs **synchronously** before the HTTP server accepts connections.

### Directory Structure

```
src/
├── api/
│   ├── routes.ts          # Main router using generic route generator
│   └── generic-routes.ts  # Auto-generated RESTful API routes
├── k8s/
│   ├── optimized-init.ts  # Unified initialization (NEW)
│   ├── types.ts           # Resource configuration registry (NEW)
│   ├── generic-sync.ts    # Universal sync logic (NEW)
│   ├── generic-informer.ts# Universal watch handlers (NEW)
│   ├── init.ts            # Legacy initialization (deprecated)
│   ├── informer.ts        # Legacy informer (deprecated)
│   └── sync.ts            # Legacy sync (deprecated)
├── lib/
│   └── mongodb.ts         # MongoDB connection (with caching)
└── models/
    ├── Pod.ts             # Mongoose models (11 resources)
    ├── Deployment.ts
    ├── Service.ts
    ├── Node.ts
    ├── ConfigMap.ts
    ├── DaemonSet.ts
    ├── Event.ts
    ├── Ingress.ts
    ├── PersistentVolumeClaim.ts
    ├── Secret.ts
    └── StatefulSet.ts
```

### Key Integration Points

**keystone.ts** is the main entry point. The K8s Informer integrates via:

- `extendExpressApp`: Initializes Informer using `optimized-init.ts` and mounts API routes
- `extendHttpServer`: (currently empty, available for WebSocket setup)

**Auth Configuration** (`auth.ts`):

- Provides session management
- `isAccessAllowed` function controls Admin UI access

## Adding New Kubernetes Resource Types

### NEW: Generic Architecture (Recommended)

This project now uses a **configuration-driven architecture** that eliminates code duplication. Adding new resources is much simpler:

### Quick Steps

1. **Create Mongoose model** in `src/models/<Resource>.ts`
   - Define TypeScript interface extending `Document`
   - Create Mongoose schema with indexes (namespace, name, uid)
   - Export model as default

2. **Register the resource** in `src/k8s/types.ts`:
   - Import your model at the top
   - Add a configuration object to `RESOURCE_CONFIGS` array
   - Define the `transformer` function to convert K8s object to MongoDB document

3. **That's it!** The following are **automatically generated**:
   - ✅ Full sync logic
   - ✅ Real-time Informer watch handlers
   - ✅ RESTful API routes (list, detail, namespace-filtered)
   - ✅ Statistics integration

### Example: Adding a ConfigMap

```typescript
// 1. Create model: src/models/ConfigMap.ts
import mongoose, { Schema, Document } from 'mongoose'

export interface IConfigMap extends Document {
  namespace: string
  name: string
  uid: string
  data: Record<string, string>
}

const ConfigMapSchema = new Schema(
  {
    namespace: { type: String, required: true, index: true },
    name: { type: String, required: true, index: true },
    uid: { type: String, required: true, unique: true },
    data: { type: Map, of: String, default: {} },
  },
  { timestamps: true },
)

export default mongoose.model<IConfigMap>('ConfigMap', ConfigMapSchema)

// 2. Register in src/k8s/types.ts
import ConfigMap from '../models/ConfigMap'

export const RESOURCE_CONFIGS: K8sResourceConfig[] = [
  // ... existing resources
  {
    name: 'ConfigMap',
    apiVersion: 'v1',
    kind: 'ConfigMap',
    plural: 'configmaps',
    namespaced: true,
    model: ConfigMap,
    icon: '📋',
    getIdKey: () => 'uid',
    transformer: cm => ({
      namespace: cm.metadata?.namespace,
      name: cm.metadata?.name,
      uid: cm.metadata?.uid,
      resourceVersion: cm.metadata?.resourceVersion,
      data: cm.data || {},
      raw: cm,
    }),
  },
]
```

### Benefits of Generic Architecture

- **🎯 Configuration-driven**: Add resources by editing a single config array
- **🔄 Auto-generated**: Sync, Informer, and Routes created automatically
- **🚀 Maintainable**: DRY principle - no code duplication
- **📦 Consistent**: All resources follow the same patterns
- **✅ Type-safe**: Full TypeScript support

### Architecture Components

- **[types.ts](src/k8s/types.ts)**: Resource configuration registry
- **[generic-sync.ts](src/k8s/generic-sync.ts)**: Universal sync logic
- **[generic-informer.ts](src/k8s/generic-informer.ts)**: Universal watch handlers
- **[generic-routes.ts](src/api/generic-routes.ts)**: Auto-generated API routes
- **[optimized-init.ts](src/k8s/optimized-init.ts)**: Unified initialization

### Legacy Approach (Deprecated)

The old approach (manually editing `informer.ts`, `sync.ts`, `routes.ts`) still works but is **not recommended** for new resources. See [docs/archive/README.md](docs/archive/README.md) for historical context.

## Environment Configuration

Required environment variables (`.env` file):

```bash
# MongoDB connection (required for K8s Informer)
MONGODB_URI=mongodb://localhost:27017/k8s-resources

# Optional: For PostgreSQL instead of SQLite (Keystone DB)
# DATABASE_URL=postgresql://...
```

## Kubernetes Configuration

- **Config location**: Uses `~/.kube/config` by default
- **Context**: Uses current context from `kubectl config current-context`
- **Permissions**: Requires read access to watched resources (get, list, watch)

Typical RBAC requirements:

```yaml
rules:
  - apiGroups: ['']
    resources: ['pods', 'services', 'nodes']
    verbs: ['get', 'list', 'watch']
  - apiGroups: ['apps']
    resources: ['deployments']
    verbs: ['get', 'list', 'watch']
```

## API Response Format

**List endpoints** (e.g., `/api/v1/pods`):

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

**Query parameters**:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `namespace`: Filter by namespace
- `search`: Search by name (case-insensitive regex)

**Detail endpoints** return the full MongoDB document.

## Common Patterns

### MongoDB Query Pattern (from routes.ts)

All list routes follow this pattern:

1. Build query object from `req.query`
2. Calculate pagination skip
3. Execute `find().sort().skip().limit().select('-raw')`
4. Count total documents
5. Return data + pagination metadata

The `.select('-raw')` excludes the `raw` field which contains full K8s resource JSON.

### Informer Event Pattern (from informer.ts)

Event handlers receive:

```typescript
async handlePodEvent(phase: string, apiObj: any, watchObj?: any) {
  // phase: 'ADDED' | 'MODIFIED' | 'DELETED'
  // apiObj: K8s resource object
  // watchObj: Metadata (resourceVersion, etc.)
}
```

For DELETED: `Pod.deleteOne({ uid })`
For ADDED/MODIFIED: Transform data → `findOneAndUpdate({ uid }, data, { upsert: true })`

## Important Notes

- **Keystone generates types** in `.keystone/types` - import `Lists` type for schema work
- **Graceful shutdown**: SIGTERM/SIGINT handlers stop Informer watchers
- **Development mode**: Use `npm run dev` for hot reload of Keystone schema changes
- **MongoDB connection**: Uses global caching pattern to avoid multiple connections in hot reload
- **TypeScript**: Target is `esnext`, `strict: true` enabled

## Troubleshooting

**MongoDB connection fails:**

- Check MongoDB is running: `brew services list | grep mongodb` (macOS)
- Verify `MONGODB_URI` in `.env`

**K8s API access fails:**

- Verify kubeconfig: `kubectl cluster-info`
- Check current context: `kubectl config current-context`

**Informer doesn't start:**

- Check logs for "Starting Kubernetes Informers..."
- Verify Service Account permissions (RBAC)

**API returns 404:**

- Ensure Informer initialized successfully (check startup logs)
- Verify MongoDB has data: Connect and check collections

**Keystone Admin UI access denied:**

- Check `auth.ts` - `isAccessAllowed` may be filtering access
- Comment out `isAccessAllowed` in `keystone.ts` for open access (dev only)
