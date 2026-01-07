/**
 * Optimized Kubernetes Informer & Sync Manager
 * Uses configuration-driven approach for better maintainability
 */

import { GenericKubernetesInformer } from './generic-informer'
import { GenericKubernetesSync } from './generic-sync'
import { RESOURCE_CONFIGS } from './types'
import { createLogger } from '../lib/logger'

const logger = createLogger('K8sInit')

let informerInstance: GenericKubernetesInformer | null = null
let syncInstance: GenericKubernetesSync | null = null
let shutdownHandlersRegistered = false

/**
 * Sync status tracking
 */
export interface SyncStatus {
  status: 'not_started' | 'in_progress' | 'completed' | 'failed'
  step: 'cleanup' | 'sync' | 'informer' | 'done'
  currentResource?: string
  currentResources?: string[] // Multiple resources when syncing concurrently
  totalResources: number
  syncedResources: number
  startTime: Date
  endTime?: Date
  error?: string
  resourceStatus: Array<{
    name: string
    icon: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    count?: number
    error?: string
  }>
}

let syncStatus: SyncStatus = {
  status: 'not_started',
  step: 'cleanup',
  totalResources: RESOURCE_CONFIGS.length,
  syncedResources: 0,
  startTime: new Date(),
  resourceStatus: RESOURCE_CONFIGS.map(config => ({
    name: config.name,
    icon: config.icon,
    status: 'pending',
  })),
}

/**
 * Clean up invalid data before sync
 * Removes documents with null/undefined metadata.name that would cause duplicate key errors
 */
async function cleanupInvalidData() {
  logger.info('Cleaning up invalid data before sync')
  for (const config of RESOURCE_CONFIGS) {
    try {
      const result = await config.model.deleteMany({
        'metadata.name': { $in: [null, undefined] },
      })
      if (result.deletedCount > 0) {
        logger.warn(
          `${config.icon} ${config.name}: Deleted ${result.deletedCount} invalid documents`,
        )
      }
    } catch (error) {
      logger.error(`${config.icon} ${config.name}: Failed to clean up`, error)
    }
  }
  logger.success('Data cleanup completed')
}

/**
 * Initialize Kubernetes Informer and perform initial sync
 */
export async function initializeK8sInformer() {
  logger.info('Initializing Kubernetes Informer system')

  // Reset sync status
  syncStatus = {
    status: 'in_progress',
    step: 'cleanup',
    totalResources: RESOURCE_CONFIGS.length,
    syncedResources: 0,
    startTime: new Date(),
    resourceStatus: RESOURCE_CONFIGS.map(config => ({
      name: config.name,
      icon: config.icon,
      status: 'pending',
    })),
  }

  // Create instances
  syncInstance = new GenericKubernetesSync(RESOURCE_CONFIGS)
  informerInstance = new GenericKubernetesInformer(RESOURCE_CONFIGS)

  try {
    // Step 0: Clean up invalid data before sync
    syncStatus.step = 'cleanup'
    await cleanupInvalidData()

    // Step 1: Perform full initial sync
    syncStatus.step = 'sync'

    const syncResults = await syncInstance.syncAll(
      // Progress callback
      (resourceName, progress) => {
        const resourceIndex = RESOURCE_CONFIGS.findIndex(
          c => c.name === resourceName,
        )
        if (resourceIndex !== -1) {
          syncStatus.resourceStatus[resourceIndex] = {
            ...syncStatus.resourceStatus[resourceIndex],
            status: progress.status,
            count: progress.count,
            error: progress.error,
          }

          // Update current resources list (all resources currently in progress)
          const inProgressResources = syncStatus.resourceStatus
            .filter(r => r.status === 'in_progress')
            .map(r => r.name)

          syncStatus.currentResources = inProgressResources

          // For backward compatibility, also set currentResource to the first one
          syncStatus.currentResource = inProgressResources[0]

          syncStatus.syncedResources = syncStatus.resourceStatus.filter(
            r => r.status === 'completed',
          ).length
        }
      },
    )

    const successCount = syncResults.filter(r => r.success).length
    const failureCount = syncResults.length - successCount

    if (failureCount > 0) {
      syncResults
        .filter(r => !r.success)
        .forEach(r => {
          logger.error(`${r.resource}: ${r.error}`)
        })
    }

    logger.info(
      `Sync completed: ${successCount} succeeded, ${failureCount} failed`,
    )

    // Step 2: Start informers for real-time updates
    syncStatus.step = 'informer'
    await informerInstance.start()

    // Mark as completed
    syncStatus.status = 'completed'
    syncStatus.step = 'done'
    syncStatus.endTime = new Date()
    syncStatus.currentResource = undefined

    logger.success('Kubernetes Informer initialized successfully')

    return {
      informer: informerInstance,
      sync: syncInstance,
      resourceCount: RESOURCE_CONFIGS.length,
    }
  } catch (error) {
    logger.error('Failed to initialize Kubernetes Informer', error)
    syncStatus.status = 'failed'
    syncStatus.error = error instanceof Error ? error.message : String(error)
    syncStatus.endTime = new Date()
    throw error
  }
}

/**
 * Get the informer instance
 */
export function getInformer(): GenericKubernetesInformer {
  if (!informerInstance) {
    throw new Error(
      'Informer not initialized. Call initializeK8sInformer() first.',
    )
  }
  return informerInstance
}

/**
 * Get the sync instance
 */
export function getSync(): GenericKubernetesSync {
  if (!syncInstance) {
    throw new Error('Sync not initialized. Call initializeK8sInformer() first.')
  }
  return syncInstance
}

/**
 * Graceful shutdown
 */
export async function shutdownK8sInformer() {
  if (informerInstance) {
    await informerInstance.stop()
    informerInstance = null
  }

  if (syncInstance) {
    syncInstance = null
  }

  logger.info('Kubernetes Informer shut down')
}

/**
 * Health check
 */
export function getHealthStatus() {
  return {
    initialized: !!(informerInstance && syncInstance),
    resourceCount: RESOURCE_CONFIGS.length,
    informerStatus: informerInstance?.getStatus() || [],
    syncStatus: getSyncStatus(),
  }
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus }
}

/**
 * Setup graceful shutdown handlers
 */
export function setupShutdownHandlers() {
  // Prevent duplicate handler registration (e.g., in hot reload scenarios)
  if (shutdownHandlersRegistered) {
    return
  }

  const shutdown = async () => {
    await shutdownK8sInformer()
    process.exit(0)
  }

  // Remove any existing listeners to avoid duplicates
  process.removeAllListeners('SIGTERM')
  process.removeAllListeners('SIGINT')

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  shutdownHandlersRegistered = true
}
