# Sync Status Tracking Features

This document describes the sync status tracking features added to help users understand the initialization state of the Kubernetes Informer system.

## Overview

When the application starts, it performs a full synchronization of Kubernetes resources to MongoDB. During this time, the API is available but may return incomplete data. The sync status features help clients understand:

1. Whether sync has started, is in progress, completed, or failed
2. Which step of the initialization process is currently running
3. How many resources have been synced
4. How long the sync took

## Features

### 1. Sync Status Endpoint

**Endpoint:** `GET /api/v1/sync/status`

**Authentication:** None (public endpoint)

**Response Format:**

```json
{
  "status": "in_progress",
  "step": "sync",
  "currentResource": "Pod",
  "totalResources": 11,
  "syncedResources": 5,
  "startTime": "2025-01-07T10:30:00.000Z",
  "endTime": null,
  "error": null,
  "resourceStatus": [
    {
      "name": "Pod",
      "icon": "📦",
      "status": "completed",
      "count": 42
    },
    {
      "name": "Deployment",
      "icon": "🚀",
      "status": "in_progress"
    },
    {
      "name": "Service",
      "icon": "🔌",
      "status": "pending"
    }
  ]
}
```

**Status Values:**

- `not_started`: Initialization hasn't begun
- `in_progress`: Currently syncing resources
- `completed`: Sync finished successfully
- `failed`: Sync encountered an error

**Step Values:**

- `cleanup`: Removing invalid data from MongoDB
- `sync`: Syncing resources from Kubernetes
- `informer`: Starting real-time watch handlers
- `done`: Initialization complete

### 2. Enhanced Health Check

**Endpoint:** `GET /api/v1/health`

The health check endpoint now includes sync status:

```json
{
  "status": "ok",
  "timestamp": "2025-01-07T10:30:00.000Z",
  "sync": {
    "status": "completed",
    "step": "done",
    "totalResources": 11,
    "syncedResources": 11,
    "startTime": "2025-01-07T10:29:55.000Z",
    "endTime": "2025-01-07T10:30:00.000Z"
  }
}
```

### 3. Response Headers

All API responses include sync status headers:

#### During Sync

```
X-Sync-Status: in_progress
X-Sync-Step: sync
X-Sync-Progress: 5/11
X-Sync-Current-Resource: Deployment
```

#### After Sync Complete

```
X-Sync-Status: completed
X-Sync-End-Time: 2025-01-07T10:30:00.000Z
X-Sync-Duration: 5234ms
```

#### On Sync Failure

```
X-Sync-Status: failed
X-Sync-Error: Failed to connect to Kubernetes API
```

## Use Cases

### 1. Show Loading Indicator in UI

```javascript
// Poll sync status every second
const checkSyncStatus = async () => {
  const response = await fetch('/api/v1/sync/status')
  const status = await response.json()

  if (status.status === 'in_progress') {
    const progress = (status.syncedResources / status.totalResources) * 100
    showProgressBar(progress)
    console.log(`Syncing ${status.currentResource}...`)
    setTimeout(checkSyncStatus, 1000)
  } else if (status.status === 'completed') {
    hideProgressBar()
    enableUI()
  } else if (status.status === 'failed') {
    showError(status.error)
  }
}

checkSyncStatus()
```

### 2. Monitor Sync via Response Headers

```javascript
// Check sync status from any API response
fetch('/api/v1/pods')
  .then(response => {
    const syncStatus = response.headers.get('X-Sync-Status')
    const syncProgress = response.headers.get('X-Sync-Progress')

    console.log(`Sync status: ${syncStatus}`)
    console.log(`Progress: ${syncProgress}`)

    return response.json()
  })
  .then(data => console.log(data))
```

### 3. Wait for Sync Before Showing Data

```javascript
const waitForSync = async () => {
  while (true) {
    const response = await fetch('/api/v1/sync/status')
    const status = await response.json()

    if (status.status === 'completed') {
      console.log('Sync complete!')
      return
    } else if (status.status === 'failed') {
      throw new Error(status.error)
    }

    console.log('Waiting for sync...')
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}

// Use before loading critical data
await waitForSync()
loadDashboardData()
```

### 4. Real-time Monitoring with curl

```bash
# Watch sync progress
watch -n 2 'curl -s http://localhost:3000/api/v1/sync/status | jq ".'

# Check response headers
curl -I http://localhost:3000/api/v1/pods | grep X-Sync
```

## Testing

Run the test script to verify all features:

```bash
./scripts/test-sync-status.sh
```

## Implementation Details

### Modified Files

- [src/k8s/optimized-init.ts](../src/k8s/optimized-init.ts) - Added sync status tracking
- [src/k8s/generic-sync.ts](../src/k8s/generic-sync.ts) - Added progress callback support
- [src/api/routes.ts](../src/api/routes.ts) - Added sync status endpoints
- [src/middleware/sync-status.ts](../src/middleware/sync-status.ts) - Response header middleware
- [keystone.ts](../keystone.ts) - Integrated sync status middleware

### Data Flow

```
initializeK8sInformer()
  ↓
Update syncStatus object
  ↓
syncAll() with progress callback
  ↓
Callback updates syncStatus.resourceStatus
  ↓
API endpoints read from syncStatus
  ↓
Middleware adds X-Sync-* headers
```

## Benefits

✅ **Transparency** - Users know exactly what's happening during startup
✅ **Progress Feedback** - Real-time updates on sync progress
✅ **Error Visibility** - Clear error messages if sync fails
✅ **Header-based** - No need for separate API calls to check status
✅ **Backward Compatible** - Existing APIs work unchanged
✅ **Low Overhead** - Minimal performance impact

## Future Enhancements

Potential improvements:

- WebSocket/Server-Sent Events for real-time push updates
- Historical sync statistics (average duration, resource counts)
- Per-namespace sync progress
- Sync retry status and attempt count
- Estimated time remaining
