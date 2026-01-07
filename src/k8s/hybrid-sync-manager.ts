/**
 * Hybrid Sync Manager
 * Intelligent synchronization strategy combining:
 * - Startup smart sync (only when needed)
 * - Informer failure recovery
 * - Optional periodic validation
 */

import { GenericKubernetesSync } from './generic-sync'
import { GenericKubernetesInformer } from './generic-informer'
import { K8sResourceConfig } from './types'
import { AppConfig } from '../config/app-config'
import type { Context } from '.keystone/types'

export interface HybridSyncOptions {
  /** Sync strategy: 'auto', 'always', 'never' */
  syncOnStartup: 'auto' | 'always' | 'never'
  /** Whether to trigger full sync when informer fails */
  autoSyncOnInformerFailure: boolean
  /** Periodic sync interval in hours (0 = disabled) */
  periodicSyncIntervalHours: number
  /** Data staleness threshold in seconds */
  dataStaleThresholdSeconds: number
}

export class HybridSyncManager {
  private syncInstance: GenericKubernetesSync
  private informerInstance: GenericKubernetesInformer
  private resourceConfigs: K8sResourceConfig[]
  private options: HybridSyncOptions
  private periodicSyncTimer?: NodeJS.Timeout
  private isShuttingDown = false
  private context: Context

  // Ready flag for API availability
  public ready = false
  public startTime = Date.now()

  constructor(
    resourceConfigs: K8sResourceConfig[],
    context: Context,
    options?: Partial<HybridSyncOptions>,
  ) {
    this.resourceConfigs = resourceConfigs
    this.context = context
    this.syncInstance = new GenericKubernetesSync(resourceConfigs)
    this.informerInstance = new GenericKubernetesInformer(resourceConfigs)

    // Default options
    this.options = {
      syncOnStartup: 'auto',
      autoSyncOnInformerFailure: true,
      periodicSyncIntervalHours: 0, // Disabled by default
      dataStaleThresholdSeconds: 24 * 60 * 60, // 24 hours
      ...options,
    }
  }

  /**
   * Initialize the hybrid sync system
   */
  async initialize(): Promise<void> {
    console.log('🎯 Initializing Hybrid Sync Manager')
    console.log('   Strategy:', this.options.syncOnStartup)
    console.log(
      '   Auto-sync on failure:',
      this.options.autoSyncOnInformerFailure,
    )
    console.log(
      '   Periodic sync interval:',
      this.options.periodicSyncIntervalHours > 0
        ? `${this.options.periodicSyncIntervalHours}h`
        : 'disabled',
    )

    try {
      // Step 1: Decide whether to perform full sync
      const shouldFullSync = await this.shouldPerformFullSync()

      if (shouldFullSync) {
        console.log('🔄 Performing full sync...')
        await this.performFullSync()
      } else {
        console.log('✅ Skipping full sync (data is fresh)')
      }

      // Step 2: Start informers with enhanced error handling
      console.log('📡 Starting informers...')
      await this.startInformers()

      // Step 3: Mark as ready
      this.ready = true
      console.log('✅ Hybrid Sync Manager initialized')

      // Step 4: Start periodic sync if configured
      if (this.options.periodicSyncIntervalHours > 0) {
        this.startPeriodicSync()
      }
    } catch (error) {
      console.error('❌ Failed to initialize Hybrid Sync Manager:', error)
      throw error
    }
  }

  /**
   * Determine if full sync is needed
   */
  private async shouldPerformFullSync(): Promise<boolean> {
    // Always sync if configured
    if (this.options.syncOnStartup === 'always') {
      return true
    }

    // Never sync if configured (risky, only for debugging)
    if (this.options.syncOnStartup === 'never') {
      return false
    }

    // Auto mode: check if data exists and is fresh
    const states = await this.context.db.SyncState.findMany({})

    // No sync state exists - first run
    if (states.length === 0) {
      console.log('   📊 No sync state found - first run')
      return true
    }

    // Check if all resources have been synced
    const syncedResources = new Set(states.map(s => s.resourceType))
    const missingResources = this.resourceConfigs.filter(
      c => !syncedResources.has(c.name),
    )

    if (missingResources.length > 0) {
      console.log(
        `   📊 Missing resources: ${missingResources.map(c => c.name).join(', ')}`,
      )
      return true
    }

    // Check if any data is stale
    const staleThreshold = this.options.dataStaleThresholdSeconds * 1000 // Convert to ms
    const now = Date.now()

    const staleStates = states.filter(s => {
      if (!s.lastSyncTime) return true
      const age = now - new Date(s.lastSyncTime).getTime()
      return age > staleThreshold
    })

    if (staleStates.length > 0) {
      console.log(
        `   📊 Stale data found: ${staleStates.map(s => s.resourceType).join(', ')}`,
      )
      return true
    }

    // Check if any syncs failed previously
    const failedStates = states.filter(s => s.status === 'failed')
    if (failedStates.length > 0) {
      console.log(
        `   📊 Previous failures: ${failedStates.map(s => s.resourceType).join(', ')}`,
      )
      return true
    }

    // Data is fresh and complete
    console.log('   ✅ Data is fresh and complete')
    return false
  }

  /**
   * Perform full sync for all resources
   */
  private async performFullSync(): Promise<void> {
    console.log('🔄 Starting full sync...')

    const startTime = Date.now()

    const results = await this.syncInstance.syncAll(
      async (resourceName, progress) => {
        // Update sync state for each resource
        await this.updateSyncState(resourceName, {
          status: progress.status,
          error: progress.error,
        })
      },
    )

    const duration = Date.now() - startTime

    // Update final sync states
    for (const result of results) {
      await this.updateSyncState(result.resource, {
        status: result.success ? 'completed' : 'failed',
        lastSyncDuration: duration,
        lastSyncCount: result.count,
        error: result.error,
      })
    }

    const successCount = results.filter(r => r.success).length
    console.log(
      `✅ Full sync completed: ${successCount}/${results.length} resources (${duration}ms)`,
    )
  }

  /**
   * Start informers with enhanced error handling
   */
  private async startInformers(): Promise<void> {
    // Override the informer's error handling to add auto-sync capability
    const originalHandleError = (this.informerInstance as any).handleError.bind(
      this.informerInstance,
    )

    ;(this.informerInstance as any).handleError = async (
      config: K8sResourceConfig,
      err: any,
      resourceVersion?: string,
    ) => {
      // Call original error handler
      await originalHandleError(config, err, resourceVersion)

      // Handle 410 Gone (resourceVersion expired)
      if (err?.statusCode === 410 && this.options.autoSyncOnInformerFailure) {
        console.log(
          `🔄 ResourceVersion expired for ${config.name}, triggering full sync...`,
        )
        await this.syncSingleResource(config)
      }

      // Handle max reconnection attempts exceeded
      const reconnectAttempts = (this.informerInstance as any).reconnectAttempts
      const attempts = reconnectAttempts?.get(config.plural) || 0

      if (
        attempts >= AppConfig.RETRY.maxAttempts &&
        this.options.autoSyncOnInformerFailure
      ) {
        console.log(
          `🔄 Max reconnection attempts for ${config.name}, triggering full sync...`,
        )
        await this.syncSingleResource(config)

        // Reset reconnect counter
        reconnectAttempts?.set(config.plural, 0)
      }
    }

    await this.informerInstance.start()
  }

  /**
   * Sync a single resource type
   */
  private async syncSingleResource(config: K8sResourceConfig): Promise<void> {
    console.log(`🔄 Syncing single resource: ${config.name}`)

    const startTime = Date.now()

    try {
      const count = await this.syncInstance.syncResourceType(config.plural)
      const duration = Date.now() - startTime

      await this.updateSyncState(config.name, {
        status: 'completed',
        lastSyncTime: new Date(),
        lastSyncDuration: duration,
        lastSyncCount: count,
        error: null,
      })

      console.log(`✅ Synced ${count} ${config.plural} in ${duration}ms`)
    } catch (error: any) {
      const duration = Date.now() - startTime

      await this.updateSyncState(config.name, {
        status: 'failed',
        lastSyncTime: new Date(),
        lastSyncDuration: duration,
        lastSyncCount: 0,
        error: error.message || String(error),
      })

      console.error(`❌ Failed to sync ${config.name}:`, error)
    }
  }

  /**
   * Update sync state in database
   */
  private async updateSyncState(
    resourceType: string,
    updates: Partial<{
      status: 'never' | 'in_progress' | 'completed' | 'failed'
      lastSyncTime: Date
      lastSyncDuration: number
      lastSyncCount: number
      resourceVersion: string
      error: string | null
    }>,
  ): Promise<void> {
    const existing = await this.context.db.SyncState.findOne({
      where: { resourceType },
    })

    if (existing) {
      await this.context.db.SyncState.updateOne({
        where: { id: existing.id },
        data: updates as any,
      })
    } else {
      await this.context.db.SyncState.createOne({
        data: {
          resourceType,
          ...updates,
        } as any,
      })
    }
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    const intervalMs = this.options.periodicSyncIntervalHours * 60 * 60 * 1000

    console.log(
      `🕐 Starting periodic sync (every ${this.options.periodicSyncIntervalHours}h)`,
    )

    this.periodicSyncTimer = setInterval(async () => {
      if (this.isShuttingDown) return

      console.log('🕐 Running periodic sync...')
      try {
        await this.performFullSync()
      } catch (error) {
        console.error('❌ Periodic sync failed:', error)
      }
    }, intervalMs)
  }

  /**
   * Stop the sync manager
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Hybrid Sync Manager...')
    this.isShuttingDown = true

    // Stop periodic sync
    if (this.periodicSyncTimer) {
      clearInterval(this.periodicSyncTimer)
      this.periodicSyncTimer = undefined
    }

    // Stop informers
    this.informerInstance.stop()

    console.log('✅ Hybrid Sync Manager shutdown complete')
  }

  /**
   * Get sync status for all resources
   */
  async getSyncStatus(): Promise<any[]> {
    const states = await this.context.db.SyncState.findMany({
      orderBy: { resourceType: 'asc' },
    })

    return states.map(state => ({
      resourceType: state.resourceType,
      lastSyncTime: state.lastSyncTime,
      lastSyncDuration: state.lastSyncDuration,
      lastSyncCount: state.lastSyncCount,
      status: state.status,
      error: state.error,
      informerReconnectCount: state.informerReconnectCount,
      isStale: state.lastSyncTime
        ? Date.now() - new Date(state.lastSyncTime).getTime() >
          this.options.dataStaleThresholdSeconds * 1000
        : true,
    }))
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    ready: boolean
    uptime: number
    informers: Array<{ name: string; watching: boolean }>
  } {
    return {
      ready: this.ready,
      uptime: Date.now() - this.startTime,
      informers: this.informerInstance.getStatus(),
    }
  }
}
