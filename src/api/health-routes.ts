/**
 * Health Check Routes
 * Provides endpoints for monitoring sync status and system health
 */

import express from 'express'
import { HybridSyncManager } from '../k8s/hybrid-sync-manager'

const router = express.Router()

// Get sync manager instance (will be set by initialization)
let syncManager: HybridSyncManager | null = null

export function setSyncManager(manager: HybridSyncManager) {
  syncManager = manager
}

/**
 * GET /api/v1/health
 * Basic health check
 */
router.get('/', (req, res) => {
  if (!syncManager) {
    return res.status(503).json({
      status: 'unhealthy',
      message: 'Sync manager not initialized',
    })
  }

  const health = syncManager.getHealthStatus()

  res.status(health.ready ? 200 : 503).json({
    status: health.ready ? 'healthy' : 'initializing',
    uptime: Math.round(health.uptime / 1000), // seconds
    informers: health.informers,
  })
})

/**
 * GET /api/v1/health/ready
 * Readiness probe - returns 503 until sync is complete
 */
router.get('/ready', (req, res) => {
  if (!syncManager || !syncManager.ready) {
    return res.status(503).json({
      ready: false,
      message: syncManager ? 'Sync in progress' : 'Not initialized',
    })
  }

  res.json({
    ready: true,
    message: 'System is ready',
  })
})

/**
 * GET /api/v1/health/live
 * Liveness probe - always returns 200 if process is running
 */
router.get('/live', (req, res) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
  })
})

/**
 * GET /api/v1/health/sync
 * Detailed sync status for all resources
 */
router.get('/sync', async (req, res) => {
  try {
    if (!syncManager) {
      return res.status(503).json({
        error: 'Sync manager not initialized',
      })
    }

    const syncStatus = await syncManager.getSyncStatus()

    res.json({
      sync: syncStatus,
      summary: {
        total: syncStatus.length,
        completed: syncStatus.filter(s => s.status === 'completed').length,
        failed: syncStatus.filter(s => s.status === 'failed').length,
        stale: syncStatus.filter(s => s.isStale).length,
      },
    })
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to get sync status',
      message: error.message,
    })
  }
})

/**
 * POST /api/v1/health/sync/trigger
 * Manually trigger a full sync (for admin/debug purposes)
 */
router.post('/sync/trigger', async (req, res) => {
  try {
    if (!syncManager) {
      return res.status(503).json({
        error: 'Sync manager not initialized',
      })
    }

    // Trigger full sync in background
    ;(async () => {
      try {
        await (syncManager as any).performFullSync()
      } catch (error) {
        console.error('Manual sync failed:', error)
      }
    })()

    res.json({
      message: 'Sync triggered',
      status: 'in_progress',
    })
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to trigger sync',
      message: error.message,
    })
  }
})

/**
 * POST /api/v1/health/sync/trigger/:resourceType
 * Manually trigger sync for a specific resource type
 */
router.post('/sync/trigger/:resourceType', async (req, res) => {
  try {
    if (!syncManager) {
      return res.status(503).json({
        error: 'Sync manager not initialized',
      })
    }

    const { resourceType } = req.params

    // Trigger single resource sync in background
    ;(async () => {
      try {
        await (syncManager as any).syncSingleResource({
          name: resourceType,
          plural: resourceType.toLowerCase() + 's',
        } as any)
      } catch (error) {
        console.error(`Manual sync for ${resourceType} failed:`, error)
      }
    })()

    res.json({
      message: `Sync triggered for ${resourceType}`,
      status: 'in_progress',
    })
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to trigger sync',
      message: error.message,
    })
  }
})

export default router
