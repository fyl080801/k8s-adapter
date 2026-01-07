# Client-Side Integration Examples

This document provides practical examples for integrating sync status tracking into client applications.

## React Example

### Sync Status Hook

```tsx
import { useState, useEffect } from 'react'

interface SyncStatus {
  status: 'not_started' | 'in_progress' | 'completed' | 'failed'
  step: 'cleanup' | 'sync' | 'informer' | 'done'
  currentResource?: string
  totalResources: number
  syncedResources: number
  resourceStatus: Array<{
    name: string
    icon: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    count?: number
  }>
}

export function useSyncStatus(pollInterval = 1000) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/v1/sync/status')
        const data = await response.json()
        setSyncStatus(data)

        // Stop polling if sync completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          if (data.status === 'failed') {
            setError(data.error || 'Sync failed')
          }
          return true // Stop polling
        }
        return false // Continue polling
      } catch (err) {
        setError('Failed to fetch sync status')
        return true // Stop polling on error
      }
    }

    fetchStatus().then(shouldStop => {
      if (!shouldStop) {
        const interval = setInterval(fetchStatus, pollInterval)
        return () => clearInterval(interval)
      }
    })
  }, [pollInterval])

  return { syncStatus, error }
}

// Usage in component
function App() {
  const { syncStatus, error } = useSyncStatus()

  if (error) {
    return <div className="error">Sync failed: {error}</div>
  }

  if (!syncStatus || syncStatus.status === 'not_started') {
    return <div>Initializing...</div>
  }

  if (syncStatus.status === 'in_progress') {
    const progress =
      (syncStatus.syncedResources / syncStatus.totalResources) * 100
    return (
      <div className="loading">
        <h2>Syncing Kubernetes Resources...</h2>
        <progress value={progress} max={100}>
          {progress.toFixed(0)}%
        </progress>
        <p>Step: {syncStatus.step}</p>
        {syncStatus.currentResource && (
          <p>Currently syncing: {syncStatus.currentResource}</p>
        )}
        <p>
          {syncStatus.syncedResources} of {syncStatus.totalResources} resource
          types
        </p>

        {/* Resource status list */}
        <ul>
          {syncStatus.resourceStatus.map(resource => (
            <li key={resource.name}>
              {resource.icon} {resource.name}: {resource.status}
              {resource.count && ` (${resource.count} items)`}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (syncStatus.status === 'completed') {
    return <MainApp /> // Show main application
  }

  return null
}
```

## Vue.js Example

```vue
<template>
  <div v-if="syncStatus">
    <!-- Loading Screen -->
    <div v-if="syncStatus.status === 'in_progress'" class="sync-progress">
      <h2>🔄 Syncing Kubernetes Resources</h2>

      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercentage + '%' }">
          {{ progressPercentage.toFixed(0) }}%
        </div>
      </div>

      <p class="step">
        Step: <strong>{{ syncStatus.step }}</strong>
      </p>

      <p v-if="syncStatus.currentResource" class="current">
        Currently: {{ syncStatus.currentResource }}
      </p>

      <p class="count">
        {{ syncStatus.syncedResources }} / {{ syncStatus.totalResources }}
        resource types
      </p>

      <!-- Resource Grid -->
      <div class="resource-grid">
        <div
          v-for="resource in syncStatus.resourceStatus"
          :key="resource.name"
          :class="['resource-card', resource.status]"
        >
          <span class="icon">{{ resource.icon }}</span>
          <span class="name">{{ resource.name }}</span>
          <span class="status">{{ resource.status }}</span>
          <span v-if="resource.count" class="count">{{ resource.count }}</span>
        </div>
      </div>
    </div>

    <!-- Error Screen -->
    <div v-else-if="syncStatus.status === 'failed'" class="sync-error">
      <h2>❌ Sync Failed</h2>
      <p>{{ syncStatus.error }}</p>
      <button @click="retry">Retry</button>
    </div>

    <!-- Main App -->
    <div v-else-if="syncStatus.status === 'completed'">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface SyncStatus {
  status: string
  step: string
  currentResource?: string
  totalResources: number
  syncedResources: number
  resourceStatus: any[]
  error?: string
}

const syncStatus = ref<SyncStatus | null>(null)
const pollInterval = ref<number | null>(null)

const progressPercentage = computed(() => {
  if (!syncStatus.value) return 0
  return (
    (syncStatus.value.syncedResources / syncStatus.value.totalResources) * 100
  )
})

const fetchStatus = async () => {
  try {
    const response = await fetch('/api/v1/sync/status')
    const data = await response.json()
    syncStatus.value = data

    // Stop polling if completed or failed
    if (data.status === 'completed' || data.status === 'failed') {
      if (pollInterval.value) {
        clearInterval(pollInterval.value)
        pollInterval.value = null
      }
    }
  } catch (error) {
    console.error('Failed to fetch sync status:', error)
    if (pollInterval.value) {
      clearInterval(pollInterval.value)
      pollInterval.value = null
    }
  }
}

const retry = () => {
  window.location.reload()
}

onMounted(() => {
  fetchStatus()
  pollInterval.value = setInterval(fetchStatus, 1000)
})
</script>

<style scoped>
.progress-bar {
  width: 100%;
  height: 30px;
  background: #e0e0e0;
  border-radius: 15px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #8bc34a);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  transition: width 0.3s ease;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 20px;
}

.resource-card {
  padding: 15px;
  border-radius: 8px;
  background: #f5f5f5;
}

.resource-card.in_progress {
  background: #fff3cd;
  border: 2px solid #ffc107;
}

.resource-card.completed {
  background: #d4edda;
  border: 2px solid #28a745;
}

.resource-card.failed {
  background: #f8d7da;
  border: 2px solid #dc3545;
}
</style>
```

## Vanilla JavaScript Example

```html
<!DOCTYPE html>
<html>
  <head>
    <title>K8s Resources - Sync Status</title>
    <style>
      .sync-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      }

      .sync-card {
        background: white;
        padding: 40px;
        border-radius: 10px;
        max-width: 500px;
        width: 90%;
        text-align: center;
      }

      .progress-container {
        width: 100%;
        height: 30px;
        background: #e0e0e0;
        border-radius: 15px;
        overflow: hidden;
        margin: 20px 0;
      }

      .progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        transition: width 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
      }

      .resource-list {
        list-style: none;
        padding: 0;
        margin-top: 20px;
        text-align: left;
      }

      .resource-item {
        padding: 8px;
        margin: 5px 0;
        border-radius: 5px;
        background: #f5f5f5;
        display: flex;
        justify-content: space-between;
      }

      .resource-item.completed {
        background: #c8e6c9;
      }

      .resource-item.in_progress {
        background: #fff59d;
      }

      .hidden {
        display: none !important;
      }
    </style>
  </head>
  <body>
    <!-- Sync Status Overlay -->
    <div id="syncOverlay" class="sync-overlay">
      <div class="sync-card">
        <h2 id="syncTitle">🔄 Syncing Kubernetes Resources</h2>

        <div class="progress-container">
          <div id="progressBar" class="progress-bar" style="width: 0%">0%</div>
        </div>

        <p id="syncStep">Step: initializing</p>
        <p id="syncCurrent"></p>
        <p id="syncCount">0 / 0 resource types</p>

        <ul id="resourceList" class="resource-list"></ul>
      </div>
    </div>

    <!-- Main Content -->
    <div id="mainContent" class="hidden">
      <h1>Kubernetes Resources</h1>
      <!-- Your main app content -->
    </div>

    <script>
      const SYNC_API = '/api/v1/sync/status'
      let pollInterval = null

      async function checkSyncStatus() {
        try {
          const response = await fetch(SYNC_API)
          const status = await response.json()

          updateUI(status)

          if (status.status === 'completed' || status.status === 'failed') {
            stopPolling()

            if (status.status === 'completed') {
              setTimeout(() => {
                document.getElementById('syncOverlay').classList.add('hidden')
                document
                  .getElementById('mainContent')
                  .classList.remove('hidden')
              }, 1000)
            }
          }
        } catch (error) {
          console.error('Failed to check sync status:', error)
          stopPolling()
        }
      }

      function updateUI(status) {
        // Update progress bar
        const progress = (status.syncedResources / status.totalResources) * 100
        const progressBar = document.getElementById('progressBar')
        progressBar.style.width = `${progress}%`
        progressBar.textContent = `${progress.toFixed(0)}%`

        // Update text
        document.getElementById('syncStep').textContent = `Step: ${status.step}`

        if (status.currentResource) {
          document.getElementById('syncCurrent').textContent =
            `Currently: ${status.currentResource}`
        }

        document.getElementById('syncCount').textContent =
          `${status.syncedResources} / ${status.totalResources} resource types`

        // Update resource list
        const resourceList = document.getElementById('resourceList')
        resourceList.innerHTML = status.resourceStatus
          .map(
            resource => `
        <li class="resource-item ${resource.status}">
          <span>${resource.icon} ${resource.name}</span>
          <span>
            ${resource.status}
            ${resource.count ? `(${resource.count})` : ''}
          </span>
        </li>
      `,
          )
          .join('')
      }

      function startPolling() {
        checkSyncStatus()
        pollInterval = setInterval(checkSyncStatus, 1000)
      }

      function stopPolling() {
        if (pollInterval) {
          clearInterval(pollInterval)
          pollInterval = null
        }
      }

      // Start polling on page load
      startPolling()
    </script>
  </body>
</html>
```

## cURL Examples

### Check Sync Status

```bash
# Get current sync status
curl http://localhost:3000/api/v1/sync/status | jq '.'

# Watch sync progress (updated every 2 seconds)
watch -n 2 'curl -s http://localhost:3000/api/v1/sync/status | jq .'
```

### Check Response Headers

```bash
# Check sync status from response headers
curl -I http://localhost:3000/api/v1/pods | grep X-Sync

# Full header inspection
curl -v http://localhost:3000/api/v1/pods 2>&1 | grep -i "X-Sync"
```

### Wait for Sync in Script

```bash
#!/bin/bash
# Wait for sync to complete before proceeding

echo "Waiting for sync to complete..."

while true; do
  STATUS=$(curl -s http://localhost:3000/api/v1/sync/status | jq -r '.status')

  if [ "$STATUS" = "completed" ]; then
    echo "Sync complete!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Sync failed!"
    exit 1
  fi

  echo "Sync status: $STATUS. Waiting..."
  sleep 2
done

# Continue with your script
echo "Loading data..."
curl http://localhost:3000/api/v1/pods | jq '.'
```

## Python Example

```python
import requests
import time

def wait_for_sync(base_url="http://localhost:3000"):
    """Wait for Kubernetes sync to complete."""
    sync_url = f"{base_url}/api/v1/sync/status"

    while True:
        try:
            response = requests.get(sync_url)
            status = response.json()

            if status['status'] == 'completed':
                print("✅ Sync complete!")
                return True
            elif status['status'] == 'failed':
                print(f"❌ Sync failed: {status.get('error')}")
                return False
            elif status['status'] == 'in_progress':
                progress = (status['syncedResources'] / status['totalResources']) * 100
                print(f"🔄 Syncing... {progress:.0f}% - {status['step']}")
                if status.get('currentResource'):
                    print(f"   Current: {status['currentResource']}")

            time.sleep(1)

        except requests.RequestException as e:
            print(f"❌ Error checking sync status: {e}")
            return False

# Usage
if __name__ == "__main__":
    if wait_for_sync():
        # Now safe to make API calls
        response = requests.get("http://localhost:3000/api/v1/pods")
        pods = response.json()
        print(f"Found {len(pods['data'])} pods")
```

## Go Example

```go
package main

import (
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type SyncStatus struct {
    Status          string `json:"status"`
    Step            string `json:"step"`
    CurrentResource string `json:"currentResource,omitempty"`
    TotalResources  int    `json:"totalResources"`
    SyncedResources int    `json:"syncedResources"`
    Error           string `json:"error,omitempty"`
}

func waitForSync(baseURL string) error {
    client := &http.Client{Timeout: 5 * time.Second}

    for {
        resp, err := client.Get(baseURL + "/api/v1/sync/status")
        if err != nil {
            return err
        }
        defer resp.Body.Close()

        var status SyncStatus
        if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
            return err
        }

        switch status.Status {
        case "completed":
            fmt.Println("✅ Sync complete!")
            return nil
        case "failed":
            return fmt.Errorf("sync failed: %s", status.Error)
        case "in_progress":
            progress := float64(status.SyncedResources) / float64(status.TotalResources) * 100
            fmt.Printf("🔄 Syncing... %.0f%% - %s\n", progress, status.Step)
            if status.CurrentResource != "" {
                fmt.Printf("   Current: %s\n", status.CurrentResource)
            }
            time.Sleep(1 * time.Second)
        }
    }
}

func main() {
    if err := waitForSync("http://localhost:3000"); err != nil {
        fmt.Printf("Error: %v\n", err)
        return
    }

    // Now safe to make API calls
    resp, err := http.Get("http://localhost:3000/api/v1/pods")
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    fmt.Printf("Pods: %v\n", result)
}
```
