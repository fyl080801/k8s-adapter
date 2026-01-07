# UID Field Flattening Migration

## Problem

The application was experiencing this error on startup:

```
E11000 duplicate key error collection: k8s-resources.nodes index: uid_1 dup key: { uid: null }
```

This occurred because the `uid` field was nested inside `metadata.uid` and had a unique index, allowing multiple documents with `null` uid values.

## Solution

We flattened the `uid` field to the top level of all K8s resource documents, along with `namespace` and `name` fields. This provides:

1. **Better indexing**: Direct unique index on `uid` field
2. **Faster queries**: No need to traverse nested structure
3. **Cleaner data model**: Important fields at top level
4. **Prevents null duplicates**: With `required: true` and `unique: true` on the flattened field

## Changes Made

### 1. Schema Helper ([src/lib/k8s-schema-helper.ts](src/lib/k8s-schema-helper.ts))

**BaseK8sDocument interface** - Added flattened fields:

```typescript
export interface BaseK8sDocument extends mongoose.Document {
  uid: string // Flattened from metadata.uid
  namespace?: string // Flattened from metadata.namespace
  name: string // Flattened from metadata.name
  kind: string
  apiVersion: string
  metadata: { ... } // Keep nested for full K8s structure
  spec?: any
  status?: any
  raw: any
  createdAt: Date
  updatedAt: Date
}
```

**Common fields** - Updated schema definition:

```typescript
const COMMON_FIELDS: SchemaDefinition = {
  uid: { type: String, required: true, unique: true, index: true },
  kind: { type: String, required: true },
  apiVersion: { type: String, required: true },
  namespace: { type: String, index: true },
  name: { type: String, required: true, index: true },
  metadata: { ... },
  spec: { type: mongoose.Schema.Types.Mixed },
  status: { type: mongoose.Schema.Types.Mixed },
  raw: { type: mongoose.Schema.Types.Mixed },
}
```

**extractMetadata** - Returns flattened object:

```typescript
export function extractMetadata(obj: { metadata?: V1ObjectMeta }) {
  const meta = obj.metadata
  return {
    uid: meta?.uid, // Now at top level
    namespace: meta?.namespace, // Now at top level
    name: meta?.name, // Now at top level
    resourceVersion: meta?.resourceVersion,
    labels: meta?.labels || {},
    annotations: meta?.annotations || {},
    creationTimestamp: meta?.creationTimestamp,
  }
}
```

**createTransformer** - Maps flattened fields:

```typescript
return {
  uid: metadata.uid, // Flattened at top level
  namespace: metadata.namespace, // Flattened at top level
  name: metadata.name, // Flattened at top level
  kind: k8sObj.kind,
  apiVersion: k8sObj.apiVersion,
  metadata: nestedMetadata, // Keep nested for full K8s structure
  ...additionalData,
  raw: k8sObj,
}
```

### 2. Generic Sync ([src/k8s/generic-sync.ts](src/k8s/generic-sync.ts))

Updated query logic to use flattened `uid` field:

```typescript
// Use flattened uid field for queries
const queryKey = idKey === 'uid' ? 'uid' : `metadata.${idKey}`
```

### 3. Generic Informer ([src/k8s/generic-informer.ts](src/k8s/generic-informer.ts))

Updated query logic to use flattened `uid` field:

```typescript
// Use flattened uid field for queries
const queryKey = idKey === 'uid' ? 'uid' : idKey
```

### 4. Cleanup Script ([scripts/cleanup-invalid-data.js](scripts/cleanup-invalid-data.js))

Updated to clean flattened `uid` field:

```javascript
// Delete documents with null uid (flattened at top level) or name
const result = await collection.deleteMany({
  $or: [
    { uid: null },
    { uid: { $exists: false } },
    { name: null },
    { name: { $exists: false } },
  ],
})
```

## Migration Steps

If you have existing data in MongoDB, follow these steps:

### 1. Run the cleanup script

```bash
# Make sure MongoDB is running
brew services start mongodb-community  # macOS
# or
sudo systemctl start mongod  # Linux

# Run cleanup to remove invalid documents
node scripts/cleanup-invalid-data.js
```

### 2. Drop and recreate indexes (optional)

If you still have issues after cleanup, you may need to drop old indexes:

```bash
# Connect to MongoDB
mongosh

# Switch to the database
use k8s-resources

# Drop all indexes for a specific collection (will recreate on startup)
db.nodes.dropIndexes()
db.pods.dropIndexes()
# ... repeat for other collections

# Exit
exit
```

### 3. Start the application

```bash
npm run dev
```

The application will:

- Create new indexes with the flattened `uid` field
- Sync all K8s resources with the new schema structure
- Start informers to watch for changes

## Benefits of This Approach

1. **Kubernetes compliance**: All K8s resources have `metadata.uid` and it's globally unique
2. **Data integrity**: `required: true` prevents null values
3. **Performance**: Direct indexing on frequently queried fields
4. **Flexibility**: Keeps nested `metadata` for full K8s structure compatibility
5. **Type safety**: TypeScript interfaces ensure consistency

## Document Structure Example

```json
{
  "_id": ObjectId("..."),
  "uid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",  // Flattened - unique index
  "namespace": "default",                            // Flattened - index
  "name": "my-pod",                                  // Flattened - index
  "kind": "Pod",
  "apiVersion": "v1",
  "metadata": {                                      // Nested structure preserved
    "namespace": "default",
    "name": "my-pod",
    "uid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "resourceVersion": "12345",
    "labels": { "app": "my-app" },
    "annotations": {},
    "creationTimestamp": "2024-01-01T00:00:00Z"
  },
  "spec": { ... },
  "status": { ... },
  "raw": { ... },  // Full K8s object
  "createdAt": ISODate("2024-01-01T00:00:00Z"),
  "updatedAt": ISODate("2024-01-01T00:00:00Z")
}
```

## FAQ

**Q: Why keep both flattened and nested versions?**

A: The flattened fields (`uid`, `namespace`, `name`) are optimized for querying and indexing, while the nested `metadata` object preserves the full Kubernetes structure for compatibility and future use.

**Q: Will this break existing queries?**

A: If you were querying using `metadata.uid`, you'll need to update to use just `uid`. The generic sync and informer have been updated automatically.

**Q: What about the old `metadata.uid` index?**

A: MongoDB will automatically create new indexes based on the updated schema. You may want to drop old indexes manually if needed (see step 2 above).

**Q: Do I need to migrate existing data?**

A: Just run the cleanup script to remove invalid documents. The next sync will recreate all documents with the new structure.
