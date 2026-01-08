# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **monorepo** containing a **Keystone 6** headless CMS with integrated **Kubernetes Informer** functionality. The application serves two purposes:

1. **Keystone CMS**: Provides Admin UI for content management (Users, Posts, Tags, SyncState)
2. **K8s Resource Sync**: Real-time synchronization of Kubernetes resources to MongoDB with RESTful API access

The system uses:

- **pnpm** workspace with two packages: `@k8s-adapter/schema` and `@k8s-adapter/core`
- **SQLite** (via Prisma) for Keystone's internal data
- **MongoDB** for Kubernetes resource storage
- **@kubernetes/client-node** for K8s API interaction
- **Winston** for structured logging

## Monorepo Structure

```
packages/
├── schema/          # Keystone list definitions (data models)
│   └── src/
│       ├── schema.ts    # User, Post, Tag, SyncState lists
│       └── index.ts     # Export point
└── core/            # Main application (K8s integration + API)
    ├── src/
    │   ├── api/                    # RESTful API routes
    │   │   ├── generic-routes.ts   # Auto-generated routes for all resources
    │   │   ├── k8s-native-routes.ts # K8s-native API pattern routes
    │   │   └── health-routes.ts    # Health check endpoints
    │   ├── k8s/                    # Kubernetes integration
    │   │   ├── types.ts            # Resource configuration registry ⭐
    │   │   ├── generic-sync.ts     # Universal sync logic
    │   │   ├── generic-informer.ts # Universal watch handlers
    │   │   └── optimized-init.ts   # Unified initialization
    │   ├── lib/                    # Utilities
    │   │   ├── mongodb.ts          # MongoDB connection
    │   │   └── logger.ts           # Winston logger
    │   ├── models/                 # Mongoose models (13 resources)
    │   └── config/                 # App configuration
    ├── keystone.ts                 # Entry point
    └── auth.ts                     # Authentication config
```

### Package Overview

**@k8s-adapter/schema**

- Contains all Keystone CMS list definitions
- Pure TypeScript with no runtime dependencies on core logic
- Must be built before core can import it in production

**@k8s-adapter/core**

- Main application with Keystone server
- Kubernetes Informer integration
- RESTful API for K8s resources
- Imports schema from `@k8s-adapter/schema`

## Development Commands

### Primary Development

```bash
# Install dependencies for all packages
pnpm install

# Start development server (core package with hot reload)
pnpm run dev
# Equivalent to: pnpm -w run dev (runs all packages in parallel)

# Build all packages
pnpm run build

# Start production server
pnpm start

# Regenerate Prisma client (after schema changes)
pnpm --filter @k8s-adapter/core db:generate
```

### Code Quality

```bash
# Lint all TypeScript files (auto-fix enabled)
pnpm run lint

# Format code with Prettier
pnpm run format

# Clean build artifacts
pnpm run clean
```

### Package-Specific Commands

```bash
# Schema package
pnpm --filter @k8s-adapter/schema build    # Build schema
pnpm --filter @k8s-adapter/schema dev      # Watch mode

# Core package
pnpm --filter @k8s-adapter/core build      # Build core
pnpm --filter @k8s-adapter/core dev        # Start dev server
pnpm --filter @k8s-adapter/core lint       # Lint core only
pnpm --filter @k8s-adapter/core lint:fix   # Auto-fix lint issues
```

### Manual API Testing

```bash
# Health check
curl http://localhost:3000/api/v1/health

# List all pods (generic routes)
curl http://localhost:3000/api/v1/pods

# List pods from specific namespaces
curl http://localhost:3000/api/v1/pods?namespaces=default,kube-system

# K8s-native API pattern
curl http://localhost:3000/api/v1/namespaces/default/pods

# Get specific pod by name
curl http://localhost:3000/api/v1/namespaces/default/pods/my-pod-name

# Statistics
curl http://localhost:3000/api/v1/stats/overview
```

## Architecture

### Startup Sequence (keystone.ts:42-73)

When Keystone starts, `extendExpressApp` executes asynchronously:

1. **MongoDB Connection** via `connectDB()` from `src/lib/mongodb.ts`
2. **K8s Informer Initialization** via `initializeK8sInformer()` from `src/k8s/optimized-init.ts`
   - Performs hybrid sync (intelligent sync based on data freshness)
   - Starts real-time Informer watches
3. **Graceful Shutdown Handlers** via `setupShutdownHandlers()`
4. **API Routes** mounted at `/api/v1`

The initialization runs **asynchronously** in the background while the HTTP server starts.

### Configuration-Driven Architecture ⭐

This project uses a **generic, configuration-driven architecture** that eliminates code duplication. The central registry is `packages/core/src/k8s/types.ts`.

**Key Components:**

- **[types.ts](packages/core/src/k8s/types.ts)**: Resource configuration registry
  - `RESOURCE_CONFIGS` array defines all supported resources
  - Each resource has: name, apiVersion, kind, plural, model, transformer, syncPriority

- **[generic-sync.ts](packages/core/src/k8s/generic-sync.ts)**: Universal sync logic
  - `GenericKubernetesSync` class handles all resource types
  - Supports concurrent sync with configurable priority
  - Automatic retry with exponential backoff
  - Chunked bulk writes to prevent EPIPE errors

- **[generic-informer.ts](packages/core/src/k8s/generic-informer.ts)**: Universal watch handlers
  - Handles ADDED, MODIFIED, DELETED events for all resources
  - Automatic watch reconnection on failure
  - Progress tracking and error recovery

- **[generic-routes.ts](packages/core/src/api/generic-routes.ts)**: Auto-generated API routes
  - Creates RESTful endpoints for all registered resources
  - Supports pagination, search, namespace filtering
  - K8s-native API pattern support

- **[optimized-init.ts](packages/core/src/k8s/optimized-init.ts)**: Unified initialization
  - Hybrid sync strategy (auto/always/never)
  - Intelligent startup (sync only if needed)
  - Graceful shutdown handling

### Dual-Database Design

The application uses **two separate databases**:

1. **SQLite** (`keystone.db`): Keystone's internal database for CMS data
   - Managed by Prisma
   - Schema defined in `packages/schema/src/schema.ts`
   - Lists: User, Post, Tag, SyncState

2. **MongoDB**: Kubernetes resource storage
   - Managed by Mongoose
   - Models in `packages/core/src/models/` (13 resources)
   - Connection via `packages/core/src/lib/mongodb.ts`

### Environment Configuration

Required environment variables (`.env` file in `packages/core/`):

```bash
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/k8s-resources

# Session Secret
SESSION_SECRET=your-session-secret-here

# Optional: API Keys (comma-separated)
VALID_API_KEYS=

# Logging
LOG_LEVEL=info                    # debug, info, warn, error
ENABLE_FILE_LOGGING=false         # Enable file logging
LOG_DIR=./logs                    # Directory for log files
ENABLE_LOG_COLORS=true            # Enable colored console output

# Sync Strategy
SYNC_ON_STARTUP=auto              # auto, always, never
ENABLE_CONCURRENT_SYNC=true       # Enable concurrent resource sync
SYNC_MAX_CONCURRENT_RESOURCES=3   # Max concurrent sync operations

# Timeouts (milliseconds)
K8S_REQUEST_TIMEOUT_MS=30000
K8S_LARGE_RESOURCE_TIMEOUT_MS=120000
MONGODB_TIMEOUT_MS=30000

# Bulk Writes (prevents EPIPE errors)
BULK_WRITE_BATCH_SIZE=100
BULK_WRITE_BATCH_DELAY_MS=100
ENABLE_CHUNKED_BULK_WRITE=true
```

See `packages/core/.env.example` for all available options.

## Adding New Kubernetes Resource Types

### Quick Steps

1. **Create Mongoose model** in `packages/core/src/models/<Resource>.ts`

   ```typescript
   import mongoose, { Schema, Document } from 'mongoose'

   export interface IMyResource extends Document {
     namespace: string
     name: string
     uid: string
     // ... other fields
   }

   const MyResourceSchema = new Schema(
     {
       namespace: { type: String, required: true, index: true },
       name: { type: String, required: true, index: true },
       uid: { type: String, required: true, unique: true },
       // ... other fields
       raw: { type: Schema.Types.Mixed, required: true }, // Full K8s object
     },
     { timestamps: true },
   )

   export default mongoose.model<IMyResource>('MyResource', MyResourceSchema)

   // Transformer function
   export function transformMyResource(k8sObj: any): any {
     return {
       namespace: k8sObj.metadata?.namespace,
       name: k8sObj.metadata?.name,
       uid: k8sObj.metadata?.uid,
       // ... transform other fields
       raw: k8sObj,
     }
   }
   ```

2. **Register the resource** in `packages/core/src/k8s/types.ts`:

   ```typescript
   import MyResource, { transformMyResource } from '../models/MyResource'

   export const RESOURCE_CONFIGS: K8sResourceConfig[] = [
     // ... existing resources
     {
       name: 'MyResource',
       apiVersion: 'v1', // or 'apps/v1', etc.
       kind: 'MyResource',
       plural: 'myresources',
       namespaced: true, // or false for cluster-scoped
       model: MyResource,
       icon: '🔧',
       getIdKey: () => 'uid', // or 'name' for cluster resources
       transformer: transformMyResource,
       methodSingular: 'MyResource', // Used for API method names
       syncPriority: 100, // Lower = earlier sync
       useExtendedTimeout: false, // true for large resources
     },
   ]
   ```

3. **That's it!** The following are **automatically generated**:
   - ✅ Full sync logic (with configurable priority)
   - ✅ Real-time Informer watch handlers
   - ✅ RESTful API routes (generic and K8s-native patterns)
   - ✅ Statistics integration
   - ✅ Error handling and retry logic

### API Endpoints Auto-Generated

```bash
# Generic routes
GET /api/v1/myresources?namespaces=default,kube-system
GET /api/v1/myresources?namespaces=default&page=2&limit=20
GET /api/v1/myresources?search=nginx

# K8s-native pattern
GET /api/v1/namespaces/{namespace}/myresources
GET /api/v1/namespaces/{namespace}/myresources/{name}
```

## Key Implementation Details

### MongoDB Query Pattern

All list routes follow this pattern (from `generic-routes.ts`):

1. Build query object from `req.query` (namespaces, search)
2. Calculate pagination skip
3. Execute `find().sort().skip().limit().select('-raw').lean()`
4. Count total documents with `countDocuments()`
5. Return data + pagination metadata

The `.select('-raw')` excludes the `raw` field (full K8s resource JSON) for smaller responses.
The `.lean()` returns plain JavaScript objects for better performance.

### Informer Event Pattern

Event handlers receive (from `generic-informer.ts`):

```typescript
async handleEvent(
  phase: 'ADDED' | 'MODIFIED' | 'DELETED',
  apiObj: any,  // K8s resource object
  config: K8sResourceConfig
)
```

- **DELETED**: `model.deleteOne({ uid })`
- **ADDED/MODIFIED**: Transform data → `findOneAndUpdate({ uid }, data, { upsert: true })`

### Sync Priority System

Resources are synced in priority order (lower = earlier):

- **Priority 1-10**: Critical infrastructure (CRD, Nodes, Pods)
- **Priority 20-50**: Workloads (Deployments, StatefulSets, Services)
- **Priority 60-100**: Storage and networking
- **Priority 200+**: Large resources (ConfigMaps, Secrets)

### Hybrid Sync Strategy

The system supports three sync modes (configured via `SYNC_ON_STARTUP`):

- **auto** (recommended): Sync only if data is missing, stale, or failed
- **always**: Always perform full sync on startup (slower, maximum reliability)
- **never**: Skip sync on startup (fastest, risk of stale data)

Staleness is determined by `DATA_STALE_THRESHOLD_SECONDS` (default: 24 hours).

### Logging System

Uses Winston with:

- **Console transport**: Colored output, configurable level
- **File transport**: Daily rotation (if enabled)
- **Context-aware loggers**: `createLogger('ComponentName')`
- **Structured logging**: Timestamps, metadata, error stacks

Example:

```typescript
import { createLogger } from '../lib/logger'
const logger = createLogger('MyComponent')

logger.debug('Detailed info')
logger.info('General message')
logger.success('Operation completed') // Custom level
logger.warn('Warning message')
logger.error('Error occurred', error)
```

## Common Patterns

### Graceful Shutdown

SIGTERM/SIGINT handlers stop Informer watchers and close MongoDB connections:

```typescript
setupShutdownHandlers() // Called in optimized-init.ts
```

### Error Handling

- **Retry with exponential backoff**: `AppConfig.retryWithBackoff()`
- **Fatal errors**: 401/403 status codes don't retry
- **Recoverable errors**: Network issues, timeouts retry automatically
- **Chunked operations**: Large bulk writes split into batches

### Type Safety

- All resources use official K8s TypeScript types from `@kubernetes/client-node`
- Mongoose models extend `Document` interface
- Resource configs are fully typed with `K8sResourceConfig`

## Troubleshooting

### MongoDB connection fails

```bash
# Check MongoDB is running (macOS)
brew services list | grep mongodb

# Start MongoDB
brew services start mongodb-community

# Or using mongosh
mongosh --eval "db.stats()"
```

### K8s API access fails

```bash
# Verify kubeconfig
kubectl cluster-info

# Check current context
kubectl config current-context

# Test access
kubectl get pods
```

### Informer doesn't start

- Check logs for "Starting Kubernetes Informers..."
- Verify Service Account permissions (RBAC)
- Check `MONGODB_URI` and kubeconfig are correct

### API returns 404

- Ensure Informer initialized successfully (check startup logs)
- Verify MongoDB has data: `mongosh k8s-resources --eval "db.pods.count()"`
- Check resource is registered in `RESOURCE_CONFIGS`

### Keystone Admin UI access denied

- Check `auth.ts` - `isAccessAllowed` may be filtering access
- Verify `SESSION_SECRET` is set in `.env`
- Comment out `isAccessAllowed` in `keystone.ts` for open access (dev only)

### Schema changes not reflected

```bash
# Build schema package
pnpm --filter @k8s-adapter/schema build

# Restart dev server
pnpm run dev
```

### Import errors between packages

```bash
# Reinstall to ensure workspace links are correct
pnpm install --force

# Check package.json exports
cat packages/schema/package.json | grep -A 10 exports
```

## Important Notes

- **Keystone generates types** in `packages/core/.keystone/types` - import `Lists` type for schema work
- **Hot reload**: Schema changes auto-reload in dev mode
- **Workspace protocol**: Core imports schema via `workspace:*` in package.json
- **Graceful shutdown**: SIGTERM/SIGINT handlers stop Informer watchers
- **MongoDB connection**: Uses global caching pattern to avoid multiple connections in hot reload
- **TypeScript**: Target is `ES2022`, `strict: true` enabled
- **Node version**: Requires >= 18.0.0
- **pnpm version**: Requires >= 8.0.0

## Supported Kubernetes Resources

All resources use official TypeScript types from `@kubernetes/client-node`:

- ✅ CustomResourceDefinition (apiextensions/v1)
- ✅ Node (v1)
- ✅ Pod (v1)
- ✅ Service (v1)
- ✅ Deployment (apps/v1)
- ✅ StatefulSet (apps/v1)
- ✅ DaemonSet (apps/v1)
- ✅ ConfigMap (v1)
- ✅ Secret (v1)
- ✅ PersistentVolume (v1)
- ✅ PersistentVolumeClaim (v1)
- ✅ Ingress (networking.k8s.io/v1)
- ✅ Event (v1)
