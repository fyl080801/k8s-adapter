/**
 * Optimized Kubernetes Informer & Sync Manager
 * Uses configuration-driven approach for better maintainability
 */

import { GenericKubernetesInformer } from './generic-informer'
import { GenericKubernetesSync } from './generic-sync'
import { RESOURCE_CONFIGS } from './types'

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
  let totalDeleted = 0

  for (const config of RESOURCE_CONFIGS) {
    try {
      const deleteResult = await config.model.deleteMany({
        'metadata.name': { $in: [null, undefined] },
      })

      if (deleteResult.deletedCount > 0) {
        console.log(
          `   🗑️  ${config.icon} ${config.name}: Deleted ${deleteResult.deletedCount} invalid records`,
        )
        totalDeleted += deleteResult.deletedCount
      }
    } catch (error) {
      console.error(
        `   ⚠️  ${config.icon} ${config.name}: Failed to clean up - ${error}`,
      )
    }
  }

  if (totalDeleted > 0) {
    console.log(`\n   ✅ Total invalid records deleted: ${totalDeleted}`)
  } else {
    console.log('   ✅ No invalid data found')
  }
}

/**
 * Initialize Kubernetes Informer and perform initial sync
 */
export async function initializeK8sInformer() {
  console.log('='.repeat(60))
  console.log('🎯 Initializing Optimized Kubernetes Informer System')
  console.log('='.repeat(60))
  console.log(`📋 Registered Resources: ${RESOURCE_CONFIGS.length}`)
  RESOURCE_CONFIGS.forEach(config => {
    console.log(`   - ${config.icon} ${config.name} (${config.apiVersion})`)
  })
  console.log('='.repeat(60))

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
    console.log('\n🧹 Step 0: Cleaning up invalid data...')
    syncStatus.step = 'cleanup'
    await cleanupInvalidData()

    // Step 1: Perform full initial sync
    console.log('\n🔄 Step 1: Performing full resource sync...')
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
          syncStatus.currentResource = resourceName
          syncStatus.syncedResources = syncStatus.resourceStatus.filter(
            r => r.status === 'completed',
          ).length
        }
      },
    )

    const successCount = syncResults.filter(r => r.success).length
    const failureCount = syncResults.length - successCount

    if (failureCount > 0) {
      console.warn(`⚠️  ${failureCount} resource types failed to sync`)
      syncResults
        .filter(r => !r.success)
        .forEach(r => {
          console.error(`   ❌ ${r.resource}: ${r.error}`)
        })
    }

    console.log(
      `\n✅ Sync completed: ${successCount}/${syncResults.length} resource types synced`,
    )

    // Step 2: Start informers for real-time updates
    console.log('\n📡 Step 2: Starting real-time informers...')
    syncStatus.step = 'informer'
    await informerInstance.start()

    // Mark as completed
    syncStatus.status = 'completed'
    syncStatus.step = 'done'
    syncStatus.endTime = new Date()
    syncStatus.currentResource = undefined

    console.log('\n' + '='.repeat(60))
    console.log('✅ Kubernetes Informer System initialized successfully')
    console.log('='.repeat(60))

    return {
      informer: informerInstance,
      sync: syncInstance,
      resourceCount: RESOURCE_CONFIGS.length,
    }
  } catch (error) {
    console.error('❌ Failed to initialize Kubernetes Informer:', error)
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
  console.log('\n🛑 Shutting down Kubernetes Informer...')

  if (informerInstance) {
    informerInstance.stop()
    informerInstance = null
  }

  if (syncInstance) {
    syncInstance = null
  }

  console.log('✅ Kubernetes Informer shutdown complete')
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
