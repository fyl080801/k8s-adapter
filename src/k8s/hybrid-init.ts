/**
 * Hybrid Initialization Entry Point
 * Replaces optimized-init.ts with the new hybrid sync strategy
 */

import { HybridSyncManager } from './hybrid-sync-manager'
import { RESOURCE_CONFIGS } from './types'
import { AppConfig } from '../config/app-config'
import { setSyncManager } from '../api/health-routes'
import type { Context } from '.keystone/types'

let hybridSyncManager: HybridSyncManager | null = null

/**
 * Initialize K8s Informer with hybrid sync strategy
 */
export async function initializeK8sInformer(context: Context) {
  console.log('='.repeat(60))
  console.log('🎯 Initializing Hybrid Kubernetes Informer System')
  console.log('='.repeat(60))
  console.log(`📋 Registered Resources: ${RESOURCE_CONFIGS.length}`)
  RESOURCE_CONFIGS.forEach(config => {
    console.log(`   - ${config.icon} ${config.name} (${config.apiVersion})`)
  })
  console.log('='.repeat(60))

  // Log configuration
  console.log('\n⚙️  Hybrid Sync Configuration:')
  console.log('   Sync on startup:', AppConfig.HYBRID_SYNC.SYNC_ON_STARTUP)
  console.log(
    '   Auto-sync on failure:',
    AppConfig.HYBRID_SYNC.AUTO_SYNC_ON_INFORMER_FAILURE,
  )
  console.log(
    '   Periodic sync:',
    AppConfig.HYBRID_SYNC.PERIODIC_SYNC_INTERVAL_HOURS > 0
      ? `${AppConfig.HYBRID_SYNC.PERIODIC_SYNC_INTERVAL_HOURS}h`
      : 'disabled',
  )
  console.log(
    '   Data stale threshold:',
    `${AppConfig.HYBRID_SYNC.DATA_STALE_THRESHOLD_SECONDS}s`,
  )

  // Create hybrid sync manager
  hybridSyncManager = new HybridSyncManager(RESOURCE_CONFIGS, context, {
    syncOnStartup: AppConfig.HYBRID_SYNC.SYNC_ON_STARTUP,
    autoSyncOnInformerFailure:
      AppConfig.HYBRID_SYNC.AUTO_SYNC_ON_INFORMER_FAILURE,
    periodicSyncIntervalHours:
      AppConfig.HYBRID_SYNC.PERIODIC_SYNC_INTERVAL_HOURS,
    dataStaleThresholdSeconds:
      AppConfig.HYBRID_SYNC.DATA_STALE_THRESHOLD_SECONDS,
  })

  // Set sync manager for health check routes
  setSyncManager(hybridSyncManager)

  try {
    // Initialize the hybrid sync system
    await hybridSyncManager.initialize()

    console.log('\n' + '='.repeat(60))
    console.log('✅ Hybrid Kubernetes Informer System initialized')
    console.log('   Ready to serve requests')
    console.log('='.repeat(60))

    return {
      manager: hybridSyncManager,
      resourceCount: RESOURCE_CONFIGS.length,
    }
  } catch (error) {
    console.error('❌ Failed to initialize Hybrid Kubernetes Informer:', error)
    throw error
  }
}

/**
 * Get the hybrid sync manager instance
 */
export function getInformer(): HybridSyncManager {
  if (!hybridSyncManager) {
    throw new Error(
      'Hybrid sync manager not initialized. Call initializeK8sInformer() first.',
    )
  }
  return hybridSyncManager
}

/**
 * Graceful shutdown
 */
export async function shutdownK8sInformer() {
  console.log('\n🛑 Shutting down Hybrid Kubernetes Informer...')

  if (hybridSyncManager) {
    await hybridSyncManager.shutdown()
    hybridSyncManager = null
  }

  console.log('✅ Hybrid Kubernetes Informer shutdown complete')
}

/**
 * Health check
 */
export function getHealthStatus() {
  if (!hybridSyncManager) {
    return {
      initialized: false,
      ready: false,
      uptime: 0,
      informers: [],
    }
  }

  return hybridSyncManager.getHealthStatus()
}

/**
 * Setup graceful shutdown handlers
 */
let shutdownHandlersRegistered = false

export function setupShutdownHandlers() {
  // Prevent duplicate handler registration
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
