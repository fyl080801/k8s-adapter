# MongoDB Index Optimization for Multi-Namespace Queries

## Problem

Querying multiple namespaces takes **12+ seconds**:

```
[API] Query completed in 12310ms, found 10 items
[API] Count completed in 63ms, total: 32
```

The issue is that the query uses `.sort({ createdAt: -1 })` without a proper compound index.

## Solution

Create a **compound index** on `{ namespace: 1, createdAt: -1 }` for all namespaced resources.

### Why This Helps

The query pattern is:

```javascript
db.secrets
  .find({ namespace: { $in: ['apps', 'kube-system'] } })
  .sort({ createdAt: -1 })
  .limit(10)
```

Without the compound index, MongoDB:

1. Scans all documents to find matching namespaces
2. Sorts them in memory
3. Returns results

With the compound index `{ namespace: 1, createdAt: -1 }`:

1. Index already has documents grouped by namespace AND sorted by createdAt
2. MongoDB can directly seek to the first matching documents
3. No in-memory sort needed

## How to Create the Index

### Option 1: Using MongoDB Shell (Recommended)

```bash
# Connect to MongoDB
mongosh

# Switch to your database
use k8s-resources

# Create compound index for each namespaced resource
db.pods.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.deployments.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.services.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.configmaps.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.secrets.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.daemonsets.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.statefulsets.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.ingresses.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.persistentvolumeclaims.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.events.createIndex({ namespace: 1, createdAt: -1 }, { background: true })

# Verify indexes were created
db.secrets.getIndexes()
```

### Option 2: Using the Automated Script

```bash
# Make sure MongoDB is running
brew services start mongodb-community  # macOS
# or
sudo systemctl start mongod  # Linux

# Run the optimization script
node scripts/optimize-mongo-indexes.js
```

### Option 3: Programmatically (in your application)

Add to `packages/core/src/lib/mongodb.ts`:

```typescript
export async function ensureIndexes() {
  const namespacedModels = [
    Pod,
    Deployment,
    Service,
    ConfigMap,
    Secret,
    DaemonSet,
    StatefulSet,
    Ingress,
    PersistentVolumeClaim,
    Event,
  ]

  for (const Model of namespacedModels) {
    const existingIndexes = await Model.listIndexes()
    const hasCompoundIndex = existingIndexes.some(
      idx => idx.name === 'namespace_1_createdAt_-1',
    )

    if (!hasCompoundIndex) {
      console.log(`Creating compound index for ${Model.model.name}...`)
      await Model.createIndex(
        { namespace: 1, createdAt: -1 },
        { name: 'namespace_1_createdAt_-1', background: true },
      )
    }
  }
}
```

Then call it in your initialization code.

## Verify the Index is Working

After creating the index, test the query again:

```bash
curl "http://localhost:3000/api/v1/secrets?namespaces=apps,kube-system&limit=10"
```

Expected output in console:

```
[API] Query completed in 45ms, found 10 items  # Was 12310ms!
[API] Count completed in 63ms, total: 32
```

## Expected Performance Improvement

| Before          | After               |
| --------------- | ------------------- |
| 12,310ms        | ~50-100ms           |
| Collection scan | Index scan          |
| In-memory sort  | Pre-sorted in index |

**Performance gain: ~120x faster!**

## Check if Index is Being Used

In MongoDB shell:

```javascript
db.secrets
  .find({ namespace: { $in: ['apps', 'kube-system'] } })
  .sort({ createdAt: -1 })
  .limit(10)
  .explain('executionStats')
```

Look for:

- `winningPlan`: Should show `IXSCAN` (index scan) not `COLLSCAN` (collection scan)
- `executionStats.totalDocsExamined`: Should be close to `limit` (10), not the total collection size

## Additional Tips

1. **Use `background: true`** when creating indexes on production to avoid blocking
2. **Monitor index size** - each index consumes disk space and RAM
3. **Remove unused indexes** - they slow down writes
4. **Consider adding indexes for other query patterns** if you have them
