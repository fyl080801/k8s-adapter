/**
 * Generic Kubernetes Sync
 * Configuration-driven full sync that supports all registered resource types
 */

import * as k8s from '@kubernetes/client-node'
import { K8sResourceConfig } from './types'

export class GenericKubernetesSync {
  private k8sApi: {
    coreV1Api: k8s.CoreV1Api
    appsV1Api: k8s.AppsV1Api
    batchV1Api: k8s.BatchV1Api
    networkingV1Api: k8s.NetworkingV1Api
    apiextensionsV1Api: k8s.ApiextensionsV1Api
  }
  private resourceConfigs: K8sResourceConfig[]

  constructor(resourceConfigs: K8sResourceConfig[]) {
    const kc = new k8s.KubeConfig()
    kc.loadFromDefault()

    this.k8sApi = {
      coreV1Api: kc.makeApiClient(k8s.CoreV1Api),
      appsV1Api: kc.makeApiClient(k8s.AppsV1Api),
      batchV1Api: kc.makeApiClient(k8s.BatchV1Api),
      networkingV1Api: kc.makeApiClient(k8s.NetworkingV1Api),
      apiextensionsV1Api: kc.makeApiClient(k8s.ApiextensionsV1Api),
    }

    this.resourceConfigs = resourceConfigs
  }

  async syncAll() {
    console.log('🔄 Starting full sync of Kubernetes resources...')

    try {
      const syncPromises = this.resourceConfigs.map(async config => {
        try {
          const count = await this.syncResource(config)
          console.log(`✅ ${config.icon} Synced ${count} ${config.plural}`)
          return { resource: config.name, count, success: true }
        } catch (error) {
          console.error(`❌ Failed to sync ${config.name}:`, error)
          return { resource: config.name, count: 0, success: false, error }
        }
      })

      const results = await Promise.all(syncPromises)

      const successCount = results.filter(r => r.success).length
      const totalCount = results.reduce((sum, r) => sum + r.count, 0)

      console.log(
        `✅ Full sync completed: ${successCount}/${results.length} resource types, ${totalCount} total resources`,
      )

      return results
    } catch (error) {
      console.error('❌ Error during full sync:', error)
      throw error
    }
  }

  private async syncResource(config: K8sResourceConfig): Promise<number> {
    console.log(`${config.icon} Syncing ${config.plural}...`)

    const listFn = this.getApiListFunction(config)
    const response = await listFn()
    const items = response.items

    console.log(`   Found ${items.length} ${config.plural}`)

    // Bulk upsert using bulkWrite for better performance
    const bulkOps = items.map((item: any) => {
      const idKey = config.getIdKey()
      const idValue = item.metadata?.[idKey]
      const data = config.transformer(item)

      return {
        updateOne: {
          filter: { [idKey]: idValue },
          update: {
            $set: { ...data, resourceVersion: item.metadata.resourceVersion },
          },
          upsert: true,
        },
      }
    })

    if (bulkOps.length > 0) {
      await config.model.bulkWrite(bulkOps)
    }

    return items.length
  }

  private getApiListFunction(config: K8sResourceConfig): () => Promise<any> {
    const apiGroup = this.getApiGroup(config.apiVersion)
    const api = this.getApi(apiGroup)

    // Convert resource name to method name (e.g., 'pods' -> 'listPodForAllNamespaces')
    const capitalized =
      config.plural.charAt(0).toUpperCase() + config.plural.slice(1)
    const methodName = `list${capitalized}ForAllNamespaces`

    if (typeof (api as any)[methodName] === 'function') {
      return (api as any)[methodName].bind(api)
    }

    throw new Error(`No list method found for ${config.plural}`)
  }

  private getApi(apiGroup: string): any {
    switch (apiGroup) {
      case 'core':
        return this.k8sApi.coreV1Api
      case 'apps':
        return this.k8sApi.appsV1Api
      case 'batch':
        return this.k8sApi.batchV1Api
      case 'networking.k8s.io':
        return this.k8sApi.networkingV1Api
      case 'apiextensions.k8s.io':
        return this.k8sApi.apiextensionsV1Api
      default:
        throw new Error(`Unsupported API group: ${apiGroup}`)
    }
  }

  private getApiGroup(apiVersion: string): string {
    if (apiVersion === 'v1') return 'core'
    if (apiVersion.includes('/')) {
      return apiVersion.split('/')[0]
    }
    return apiVersion
  }

  /**
   * Sync a specific resource type by name
   */
  async syncResourceType(plural: string): Promise<number> {
    const config = this.resourceConfigs.find(c => c.plural === plural)
    if (!config) {
      throw new Error(`Resource type ${plural} not found`)
    }

    return this.syncResource(config)
  }
}
