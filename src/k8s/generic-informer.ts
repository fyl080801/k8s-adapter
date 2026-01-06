/**
 * Generic Kubernetes Informer
 * Configuration-driven informer that supports all registered resource types
 */

import * as k8s from '@kubernetes/client-node'
import { K8sResourceConfig } from './types'

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
    console.log('🚀 Starting Generic Kubernetes Informers...')

    const startPromises = this.resourceConfigs.map(async config => {
      try {
        await this.watchResource(config)
        console.log(`✅ ${config.icon} ${config.name} Informer started`)
      } catch (error) {
        console.error(`❌ Failed to start ${config.name} Informer:`, error)
        throw error
      }
    })

    await Promise.all(startPromises)
    console.log(
      `✅ All ${this.resourceConfigs.length} Kubernetes Informers started`,
    )
  }

  private async watchResource(config: K8sResourceConfig) {
    const path = this.getWatchPath(config)

    const watch = await this.k8sApi.watch.watch(
      path,
      {},
      (phase, obj) => this.handleEvent(config, phase, obj),
      err => this.handleError(config, err),
    )

    this.watchers.set(config.plural, () => watch.abort())
  }

  private getWatchPath(config: K8sResourceConfig): string {
    const apiGroup = this.getApiGroup(config.apiVersion)
    const version = config.apiVersion

    if (apiGroup === 'core') {
      return `/api/v1/${config.plural}`
    } else {
      return `/apis/${apiGroup}/${version}/${config.plural}`
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
      const resource = eventObj.object
      const eventType = phase.toUpperCase()

      console.log(
        `${config.icon} ${eventType} ${config.name}: ${
          config.namespaced
            ? `${resource.metadata.namespace}/${resource.metadata.name}`
            : resource.metadata.name
        }`,
      )

      const idKey = config.getIdKey()
      const idValue = resource.metadata[idKey]

      if (eventType === 'DELETED') {
        await config.model.deleteOne({ [idKey]: idValue })
      } else {
        const data = config.transformer(resource)
        await config.model.findOneAndUpdate(
          { [idKey]: idValue },
          { ...data, resourceVersion: resource.metadata.resourceVersion },
          { upsert: true, new: true },
        )
      }
    } catch (error) {
      console.error(`❌ Error handling ${config.name} event:`, error)
    }
  }

  private handleError(config: K8sResourceConfig, err: any) {
    console.error(`❌ Error in ${config.name} informer:`, err)

    // TODO: Implement reconnection logic
    // For now, just log the error
  }

  stop() {
    console.log('🛑 Stopping Kubernetes Informers...')

    this.watchers.forEach((abort, plural) => {
      try {
        abort()
      } catch (error) {
        console.error(`❌ Error stopping ${plural} watcher:`, error)
      }
    })

    this.watchers.clear()
    console.log('✅ All Kubernetes Informers stopped')
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
