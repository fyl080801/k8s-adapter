/**
 * Sync Status Response Header Middleware
 * Adds X-Sync-Status header to all API responses to indicate sync state
 */

import { Request, Response, NextFunction } from 'express'
import { getSyncStatus } from '../k8s/optimized-init'

/**
 * Middleware to add sync status headers to all responses
 */
export function syncStatusHeader(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const syncStatus = getSyncStatus()

  // Add sync status header
  res.setHeader('X-Sync-Status', syncStatus.status)

  // Add additional headers for more context
  if (syncStatus.status === 'in_progress') {
    res.setHeader('X-Sync-Step', syncStatus.step)
    res.setHeader(
      'X-Sync-Progress',
      `${syncStatus.syncedResources}/${syncStatus.totalResources}`,
    )
    if (syncStatus.currentResource) {
      res.setHeader('X-Sync-Current-Resource', syncStatus.currentResource)
    }
  } else if (syncStatus.status === 'completed') {
    res.setHeader('X-Sync-End-Time', syncStatus.endTime?.toISOString() || '')
    const duration = syncStatus.endTime
      ? new Date(syncStatus.endTime).getTime() -
        new Date(syncStatus.startTime).getTime()
      : 0
    res.setHeader('X-Sync-Duration', `${duration}ms`)
  } else if (syncStatus.status === 'failed') {
    res.setHeader('X-Sync-Error', syncStatus.error || 'Unknown error')
  }

  next()
}
