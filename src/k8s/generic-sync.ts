/**
 * Generic Kubernetes Sync
 * Configuration-driven full sync that supports all registered resource types
 */

import * as k8s from '@kubernetes/client-node'
import { K8sResourceConfig } from './types'
import { AppConfig } from '../config/app-config'

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

  async syncAll(
    progressCallback?: (
      resourceName: string,
      progress: {
        status: 'in_progress' | 'completed' | 'failed'
        count?: number
        error?: string
      },
    ) => void,
  ) {
    console.log('🔄 Starting full sync of Kubernetes resources...')

    try {
      const syncPromises = this.resourceConfigs.map(async config => {
        try {
          // Notify progress callback: start
          progressCallback?.(config.name, { status: 'in_progress' })

          const count = await AppConfig.retryWithBackoff(
            () => this.syncResource(config),
            `Sync ${config.name}`,
            {
              isFatal: (error: any) => {
                // Don't retry on certain K8s API errors
                return error?.statusCode === 403 || error?.statusCode === 401
              },
            },
          )
          console.log(`✅ ${config.icon} Synced ${count} ${config.plural}`)

          // Notify progress callback: completed
          progressCallback?.(config.name, {
            status: 'completed',
            count,
          })

          return { resource: config.name, count, success: true }
        } catch (error) {
          console.error(`❌ Failed to sync ${config.name}:`, error)

          // Notify progress callback: failed
          progressCallback?.(config.name, {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          })

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

    // Prepare bulk operations
    const bulkOps = items
      .filter((item: any) => {
        // Filter out items without the required ID field
        const idKey = config.getIdKey()
        const idValue = item.metadata?.[idKey]
        if (!idValue) {
          console.warn(
            `⚠️  Skipping ${config.name} with missing ${idKey}: ${item.metadata?.name || 'unknown'}`,
          )
          return false
        }
        return true
      })
      .map((item: any) => {
        const idKey = config.getIdKey()
        const idValue = item.metadata?.[idKey]
        const data = config.transformer(item)

        // Use flattened uid field for queries (e.g., just 'uid' instead of 'metadata.uid')
        const queryKey = idKey === 'uid' ? 'uid' : `metadata.${idKey}`

        return {
          updateOne: {
            filter: { [queryKey]: idValue },
            update: {
              $set: data,
            },
            upsert: true,
          },
        }
      })

    if (bulkOps.length > 0) {
      if (AppConfig.FEATURES.ENABLE_CHUNKED_BULK_WRITE) {
        await this.chunkedBulkWrite(config, bulkOps)
      } else {
        await config.model.bulkWrite(bulkOps)
      }
    }

    return items.length
  }

  /**
   * Perform chunked bulk writes to prevent EPIPE errors on large datasets
   */
  private async chunkedBulkWrite(
    config: K8sResourceConfig,
    bulkOps: any[],
  ): Promise<void> {
    const batchSize = AppConfig.BULK_WRITE.batchSize
    const totalOps = bulkOps.length
    let processedOps = 0

    console.log(`   📦 Using chunked bulk writes (batch size: ${batchSize})`)

    // Process in chunks
    for (let i = 0; i < totalOps; i += batchSize) {
      const chunk = bulkOps.slice(i, Math.min(i + batchSize, totalOps))
      const chunkNum = Math.floor(i / batchSize) + 1
      const totalChunks = Math.ceil(totalOps / batchSize)

      try {
        await config.model.bulkWrite(chunk)
        processedOps += chunk.length

        console.log(
          `   ✅ Chunk ${chunkNum}/${totalChunks} processed (${processedOps}/${totalOps} operations)`,
        )

        // Add delay between batches to avoid overwhelming the database
        if (i + batchSize < totalOps) {
          await AppConfig.sleep(AppConfig.BULK_WRITE.batchDelayMs)
        }
      } catch (error: any) {
        // Log detailed error for debugging
        console.error(
          `❌ Failed to write chunk ${chunkNum}/${totalChunks} for ${config.name}:`,
        )
        console.error(`   Error: ${error.message}`)
        console.error(
          `   Chunk size: ${chunk.length}, Processed: ${processedOps}/${totalOps}`,
        )

        // Check if error is recoverable (network issues, timeouts, etc.)
        const isRecoverable =
          error.message?.includes('EPIPE') ||
          error.message?.includes('ETIMEDOUT') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('timeout')

        if (isRecoverable) {
          console.log(`   🔄 Retrying chunk ${chunkNum} after error...`)

          // Retry this specific chunk with exponential backoff
          await AppConfig.sleep(AppConfig.calculateBackoff(0))

          try {
            await config.model.bulkWrite(chunk)
            processedOps += chunk.length
            console.log(`   ✅ Chunk ${chunkNum} retry succeeded`)
          } catch (retryError: any) {
            console.error(
              `❌ Chunk ${chunkNum} retry failed: ${retryError.message}`,
            )
            throw retryError
          }
        } else {
          // Non-recoverable error, throw immediately
          throw error
        }
      }
    }

    console.log(
      `   ✅ All chunks processed successfully (${processedOps} operations)`,
    )
  }

  private getApiListFunction(config: K8sResourceConfig): () => Promise<any> {
    const apiGroup = this.getApiGroup(config.apiVersion)
    const api = this.getApi(apiGroup)

    // Use the methodSingular if provided, otherwise construct from plural
    const singular = config.methodSingular || config.name

    // For namespaced resources, try listXForAllNamespaces first
    if (config.namespaced) {
      const methodName = `list${singular}ForAllNamespaces`
      if (typeof (api as any)[methodName] === 'function') {
        return (api as any)[methodName].bind(api)
      }
    } else {
      // For cluster-scoped resources, use listX (without ForAllNamespaces)
      const methodName = `list${singular}`
      if (typeof (api as any)[methodName] === 'function') {
        return (api as any)[methodName].bind(api)
      }
    }

    throw new Error(
      `No list method found for ${config.plural} (tried: ${config.namespaced ? `list${singular}ForAllNamespaces` : `list${singular}`})`,
    )
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
