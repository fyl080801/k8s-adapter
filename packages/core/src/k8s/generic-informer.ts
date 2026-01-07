/**
 * Generic Kubernetes Informer
 * Configuration-driven informer that supports all registered resource types
 */

import * as k8s from '@kubernetes/client-node'
import { K8sResourceConfig } from './types'
import { AppConfig } from '../config/app-config'
import { createLogger } from '../lib/logger'

const logger = createLogger('K8sInformer')

export class GenericKubernetesInformer {
  private k8sApi: {
    coreV1Api: k8s.CoreV1Api
    appsV1Api: k8s.AppsV1Api
    batchV1Api: k8s.BatchV1Api
    networkingV1Api: k8s.NetworkingV1Api
    watch: k8s.Watch
  }
  private watchers: Map<string, () => void> = new Map()
  private resourceConfigs: K8sResourceConfig[]
  private reconnectAttempts: Map<string, number> = new Map()
  private isShuttingDown = false

  // Event queue for controlling MongoDB write concurrency
  private eventQueue: Array<() => Promise<void>> = []
  private queueProcessing = false
  private maxConcurrentWrites = 10 // Maximum concurrent MongoDB writes

  constructor(resourceConfigs: K8sResourceConfig[]) {
    const kc = new k8s.KubeConfig()
    kc.loadFromDefault()

    this.k8sApi = {
      coreV1Api: kc.makeApiClient(k8s.CoreV1Api),
      appsV1Api: kc.makeApiClient(k8s.AppsV1Api),
      batchV1Api: kc.makeApiClient(k8s.BatchV1Api),
      networkingV1Api: kc.makeApiClient(k8s.NetworkingV1Api),
      watch: new k8s.Watch(kc),
    }

    this.resourceConfigs = resourceConfigs
  }

  async start() {
    logger.info(
      `Starting informers for ${this.resourceConfigs.length} resource types`,
    )

    const startPromises = this.resourceConfigs.map(async config => {
      try {
        logger.debug(`${config.icon} Starting watch for ${config.name}`)
        await this.watchResource(config)
        logger.success(`${config.icon} ${config.name} informer started`)
      } catch (error) {
        logger.error(
          `${config.icon} Failed to start ${config.name} informer`,
          error,
        )
        throw error
      }
    })

    await Promise.all(startPromises)
    logger.success('All informers started successfully')
  }

  private async watchResource(config: K8sResourceConfig) {
    await this.startWatch(config)
  }

  /**
   * Start a watch with automatic reconnection
   */
  private async startWatch(
    config: K8sResourceConfig,
    resourceVersion?: string,
  ): Promise<void> {
    const path = this.getWatchPath(config)

    // Build watch options
    const watchOptions: Record<string, any> = {}
    if (resourceVersion) {
      watchOptions.resourceVersion = resourceVersion
    }

    const watch = await this.k8sApi.watch.watch(
      path,
      watchOptions,
      (phase, obj) => {
        // Update resource version for resume capability
        if (obj?.metadata?.resourceVersion) {
          resourceVersion = obj.metadata.resourceVersion
        }
        this.handleEvent(config, phase, obj)
      },
      err => this.handleError(config, err, resourceVersion),
    )

    this.watchers.set(config.plural, () => watch.abort())

    // Reset reconnect attempts on successful start
    this.reconnectAttempts.set(config.plural, 0)
  }

  private getWatchPath(config: K8sResourceConfig): string {
    const apiGroup = this.getApiGroup(config.apiVersion)

    if (apiGroup === 'core') {
      return `/api/v1/${config.plural}`
    } else {
      return `/apis/${config.apiVersion}/${config.plural}`
    }
  }

  private getApiGroup(apiVersion: string): string {
    if (apiVersion === 'v1') return 'core'
    if (apiVersion.includes('/')) {
      return apiVersion.split('/')[0]
    }
    return apiVersion
  }

  private async handleEvent(
    config: K8sResourceConfig,
    phase: string,
    eventObj: any,
  ) {
    try {
      // Validate event object structure
      if (!eventObj) {
        return
      }

      const resource = eventObj

      // Validate resource metadata
      if (!resource.metadata) {
        return
      }

      const eventType = phase.toUpperCase()

      const idKey = config.getIdKey()
      const idValue = resource.metadata[idKey]

      if (!idValue) {
        return
      }

      // Queue the event for async processing
      this.eventQueue.push(async () => {
        try {
          if (eventType === 'DELETED') {
            // Use flattened uid field for queries
            const queryKey = idKey === 'uid' ? 'uid' : idKey
            await config.model.deleteOne({ [queryKey]: idValue })
          } else {
            const data = config.transformer(resource)
            const queryKey = idKey === 'uid' ? 'uid' : idKey
            await config.model.findOneAndUpdate({ [queryKey]: idValue }, data, {
              upsert: true,
              new: true,
            })
          }
        } catch (error) {
          console.error(
            `❌ Error processing ${config.name} event in queue:`,
            error,
          )
        }
      })

      // Start processing queue if not already processing
      if (!this.queueProcessing) {
        this.processEventQueue()
      }
    } catch (error) {
      console.error(`❌ Error handling ${config.name} event:`, error)
    }
  }

  /**
   * Process event queue with controlled concurrency
   */
  private async processEventQueue() {
    if (this.queueProcessing || this.eventQueue.length === 0) {
      return
    }

    this.queueProcessing = true

    // Process events in batches with controlled concurrency
    while (this.eventQueue.length > 0) {
      // Take a batch of events
      const batch = this.eventQueue.splice(0, this.maxConcurrentWrites)

      // Process batch concurrently
      await Promise.all(batch.map(fn => fn()))

      // Small delay between batches to avoid overwhelming MongoDB
      if (this.eventQueue.length > 0) {
        await AppConfig.sleep(10) // 10ms delay between batches
      }
    }

    this.queueProcessing = false
  }

  private handleError(
    config: K8sResourceConfig,
    err: any,
    resourceVersion?: string,
  ) {
    // Ignore null/undefined errors (sometimes K8s watch API sends null on initial connection)
    if (!err) {
      return
    }

    // Ignore AbortError - this is expected when we abort the watch during shutdown
    if (err?.name === 'AbortError' || err?.type === 'aborted') {
      return
    }

    // Don't reconnect during shutdown
    if (this.isShuttingDown) {
      return
    }

    // Log actual errors with details
    const errorMessage = err?.message || err?.toString() || 'Unknown error'
    const statusCode = err?.statusCode || err?.response?.statusCode

    console.error(
      `Error in ${config.name} informer: ${errorMessage}${statusCode ? ` (HTTP ${statusCode})` : ''}`,
    )

    // Log additional details for debugging
    if (err?.body) {
      console.error(`Details:`, err.body)
    }

    // Attempt reconnection for recoverable errors
    if (AppConfig.FEATURES.ENABLE_K8S_WATCH_RECONNECT) {
      this.attemptReconnection(config, resourceVersion)
    }
  }

  /**
   * Attempt to reconnect the watch with exponential backoff
   */
  private async attemptReconnection(
    config: K8sResourceConfig,
    resourceVersion?: string,
  ) {
    const currentAttempts = this.reconnectAttempts.get(config.plural) || 0

    if (currentAttempts >= AppConfig.RETRY.maxAttempts) {
      console.error(
        `${config.name} informer: Max reconnection attempts reached. Giving up.`,
      )
      return
    }

    const nextAttempt = currentAttempts + 1
    this.reconnectAttempts.set(config.plural, nextAttempt)

    const delay = AppConfig.calculateBackoff(currentAttempts)

    // Stop the existing watch if it's still running
    const existingAbort = this.watchers.get(config.plural)
    if (existingAbort) {
      try {
        existingAbort()
      } catch (error) {
        // Ignore errors when aborting a failed watch
      }
      this.watchers.delete(config.plural)
    }

    // Wait before reconnecting
    await AppConfig.sleep(delay)

    // Attempt to restart the watch
    try {
      await this.startWatch(config, resourceVersion)
    } catch (error: any) {
      console.error(
        `${config.name} informer: Reconnection attempt ${nextAttempt} failed:`,
        error.message,
      )

      // Continue reconnection attempts
      this.attemptReconnection(config, resourceVersion)
    }
  }

  async stop() {
    logger.info('Stopping all informers')
    this.isShuttingDown = true

    // Abort all watchers
    this.watchers.forEach((abort, plural) => {
      try {
        abort()
      } catch (error) {
        logger.error(`Error stopping ${plural} watcher`, error)
      }
    })

    // Wait for event queue to finish processing
    const maxWaitTime = 30000 // 30 seconds max wait
    const startTime = Date.now()
    while (this.queueProcessing && Date.now() - startTime < maxWaitTime) {
      await AppConfig.sleep(100)
    }

    if (this.queueProcessing) {
      logger.warn('Event queue did not finish processing within timeout')
    } else {
      logger.success('All informers stopped successfully')
    }

    this.watchers.clear()
    this.reconnectAttempts.clear()
    this.isShuttingDown = false
  }

  /**
   * Get status of all informers
   */
  getStatus(): Array<{ name: string; watching: boolean }> {
    return this.resourceConfigs.map(config => ({
      name: config.name,
      watching: this.watchers.has(config.plural),
    }))
  }
}
