/**
 * Optimized Kubernetes Informer & Sync Manager
 * Uses configuration-driven approach for better maintainability
 */

import { GenericKubernetesInformer } from './generic-informer'
import { GenericKubernetesSync } from './generic-sync'
import { RESOURCE_CONFIGS } from './types'

let informerInstance: GenericKubernetesInformer | null = null
let syncInstance: GenericKubernetesSync | null = null

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

  // Create instances
  syncInstance = new GenericKubernetesSync(RESOURCE_CONFIGS)
  informerInstance = new GenericKubernetesInformer(RESOURCE_CONFIGS)

  try {
    // Step 1: Perform full initial sync
    console.log('\n🔄 Step 1: Performing full resource sync...')
    const syncResults = await syncInstance.syncAll()

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
    await informerInstance.start()

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
  }
}

/**
 * Setup graceful shutdown handlers
 */
export function setupShutdownHandlers() {
  const shutdown = async () => {
    await shutdownK8sInformer()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
