/**
 * Generic Kubernetes Informer
 * Configuration-driven informer that supports all registered resource types
 */

import * as k8s from '@kubernetes/client-node'
import { K8sResourceConfig } from './types'
import { AppConfig } from '../config/app-config'

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
    const startPromises = this.resourceConfigs.map(async config => {
      try {
        await this.watchResource(config)
      } catch (error) {
        console.error(`Failed to start ${config.name} Informer:`, error)
        throw error
      }
    })

    await Promise.all(startPromises)
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
      console.error(`❌ Error handling ${config.name} event:`, error)
    }
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

  stop() {
    this.isShuttingDown = true

    this.watchers.forEach((abort, plural) => {
      try {
        abort()
      } catch (error) {
        console.error(`Error stopping ${plural} watcher:`, error)
      }
    })

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
