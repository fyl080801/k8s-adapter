/**
 * Health Check Routes
 * Provides endpoints for monitoring sync status and system health
 */

import express from 'express'
import { getHealthStatus, getSyncStatus } from '../k8s/optimized-init'
import { createLogger } from '../lib/logger'

const logger = createLogger('HealthRoutes')
const router = express.Router()

/**
 * GET /api/v1/health
 * Basic health check
 */
router.get('/', (req, res) => {
  try {
    const health = getHealthStatus()

    res.status(health.initialized ? 200 : 503).json({
      status: health.initialized ? 'healthy' : 'initializing',
      uptime: process.uptime(),
      resourceCount: health.resourceCount,
    })
  } catch (error) {
    logger.error('Health check failed', error)
    res.status(503).json({
      status: 'unhealthy',
      message: 'Health check failed',
    })
  }
})

/**
 * GET /api/v1/health/ready
 * Readiness probe - returns 503 until sync is complete
 */
router.get('/ready', (req, res) => {
  try {
    const syncStatus = getSyncStatus()
    const isReady = syncStatus.status === 'completed'

    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      message: isReady ? 'System is ready' : `Sync ${syncStatus.status}`,
      step: syncStatus.step,
    })
  } catch (error) {
    logger.error('Readiness check failed', error)
    res.status(503).json({
      ready: false,
      message: 'Failed to get sync status',
    })
  }
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
router.get('/sync', (req, res) => {
  try {
    const syncStatus = getSyncStatus()

    res.json({
      status: syncStatus.status,
      step: syncStatus.step,
      totalResources: syncStatus.totalResources,
      syncedResources: syncStatus.syncedResources,
      currentResource: syncStatus.currentResource,
      currentResources: syncStatus.currentResources,
      startTime: syncStatus.startTime,
      endTime: syncStatus.endTime,
      error: syncStatus.error,
      resources: syncStatus.resourceStatus,
    })
  } catch (error) {
    logger.error('Sync status check failed', error)
    res.status(500).json({
      error: 'Failed to get sync status',
    })
  }
})

export default router
