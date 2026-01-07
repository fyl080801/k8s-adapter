/**
 * Sync Status Response Header Middleware
 * Adds X-Sync-Status header to API responses to indicate sync state
 * For resource-specific endpoints (e.g., /api/v1/pods), shows ONLY that resource's sync status
 * Overall sync status should be obtained from dedicated status endpoint
 */

import { Response, NextFunction } from 'express'
import { getSyncStatus, SyncStatus } from '../k8s/optimized-init'
import { ResourceRequest, getResourceInfo } from './resource-identifier'
import { createLogger } from '../lib/logger'

const logger = createLogger('SyncStatus')

/**
 * Get sync status for a specific resource
 */
function getResourceSyncStatus(
  syncStatus: SyncStatus,
  resourceName: string,
): { status: string; count?: number; error?: string } {
  const resourceStatus = syncStatus.resourceStatus.find(
    r => r.name === resourceName,
  )

  if (!resourceStatus) {
    return { status: 'unknown' }
  }

  return {
    status: resourceStatus.status,
    count: resourceStatus.count,
    error: resourceStatus.error,
  }
}

/**
 * Middleware to add sync status headers to responses
 * - For resource endpoints: adds ONLY resource-specific sync status
 * - For other endpoints: NO sync status headers (use dedicated status endpoint)
 *
 * Must be used AFTER resourceIdentifier middleware
 */
export function syncStatusHeader(
  req: ResourceRequest,
  res: Response,
  next: NextFunction,
) {
  const syncStatus = getSyncStatus()
  const resourceInfo = getResourceInfo(req)

  if (resourceInfo) {
    // Resource-specific endpoint: show ONLY this resource's sync status
    const resourceStatus = getResourceSyncStatus(syncStatus, resourceInfo.name)

    // Always add headers for identified resources, even if status is 'unknown'
    res.setHeader('X-Sync-Resource', resourceInfo.name)
    res.setHeader('X-Sync-Status', resourceStatus.status)

    // Debug logging
    logger.debug(
      `Resource: ${resourceInfo.name}, Status: ${resourceStatus.status}, Count: ${resourceStatus.count || 'N/A'}`,
    )

    // Add count if available
    if (resourceStatus.count !== undefined) {
      res.setHeader('X-Sync-Count', String(resourceStatus.count))
    }

    // Add error if failed
    if (resourceStatus.error) {
      res.setHeader('X-Sync-Error', resourceStatus.error)
    }
  }
  // For non-resource endpoints: NO sync status headers
  // Overall status should be obtained from dedicated status endpoint

  next()
}
