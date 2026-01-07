/**
 * Generic Kubernetes Sync
 * Configuration-driven full sync that supports all registered resource types
 */

import * as k8s from '@kubernetes/client-node'
import { K8sResourceConfig } from './types'
import { AppConfig } from '../config/app-config'
import { createLogger } from '../lib/logger'

const logger = createLogger('K8sSync')

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
    logger.info(
      `Starting sync for ${this.resourceConfigs.length} resource types`,
    )

    try {
      // Sort resources by priority (lower values first)
      const sortedConfigs = [...this.resourceConfigs].sort(
        (a, b) => (a.syncPriority || 100) - (b.syncPriority || 100),
      )

      const results: Array<{
        resource: string
        count: number
        success: boolean
        error?: string
      }> = []

      // Decide whether to use concurrent sync based on config
      if (AppConfig.SYNC_CONCURRENCY.enableConcurrentSync) {
        const concurrency = AppConfig.SYNC_CONCURRENCY.maxConcurrentResources
        logger.info(
          `Using concurrent sync with max ${concurrency} resources in parallel`,
        )

        // Use concurrent sync with limited concurrency
        const syncResults = await AppConfig.processWithConcurrency(
          sortedConfigs,
          async config => {
            try {
              logger.debug(`${config.icon} Starting sync for ${config.name}`)
              // Notify progress callback: start
              progressCallback?.(config.name, { status: 'in_progress' })

              const count = await AppConfig.retryWithBackoff(
                () => this.syncResource(config),
                `Sync ${config.name}`,
                {
                  isFatal: (error: any) => {
                    // Don't retry on certain K8s API errors
                    return (
                      error?.statusCode === 403 || error?.statusCode === 401
                    )
                  },
                },
              )

              // Notify progress callback: completed
              progressCallback?.(config.name, {
                status: 'completed',
                count,
              })

              logger.success(
                `${config.icon} Synced ${count} ${config.name} resources`,
              )

              return {
                resource: config.name,
                count,
                success: true,
              }
            } catch (error) {
              logger.error(
                `${config.icon} Failed to sync ${config.name}`,
                error,
              )

              // Notify progress callback: failed
              progressCallback?.(config.name, {
                status: 'failed',
                error: error instanceof Error ? error.message : String(error),
              })

              return {
                resource: config.name,
                count: 0,
                success: false,
                error: error instanceof Error ? error.message : String(error),
              }
            }
          },
          concurrency,
        )

        results.push(...syncResults)
      } else {
        // Sequential sync (original behavior)
        for (const config of sortedConfigs) {
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

            // Notify progress callback: completed
            progressCallback?.(config.name, {
              status: 'completed',
              count,
            })

            results.push({ resource: config.name, count, success: true })
          } catch (error) {
            console.error(`Failed to sync ${config.name}:`, error)

            // Notify progress callback: failed
            progressCallback?.(config.name, {
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
            })

            results.push({
              resource: config.name,
              count: 0,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }

      return results
    } catch (error) {
      console.error('Error during full sync:', error)
      throw error
    }
  }

  private async syncResource(config: K8sResourceConfig): Promise<number> {
    const listFn = this.getApiListFunction(config)
    const response = await listFn()
    const items = response.items

    // Prepare bulk operations
    const bulkOps = items
      .filter((item: any) => {
        // Filter out items without the required ID field
        const idKey = config.getIdKey()
        const idValue = item.metadata?.[idKey]
        if (!idValue) {
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

    // Process in chunks
    for (let i = 0; i < totalOps; i += batchSize) {
      const chunk = bulkOps.slice(i, Math.min(i + batchSize, totalOps))
      const chunkNum = Math.floor(i / batchSize) + 1
      const totalChunks = Math.ceil(totalOps / batchSize)

      try {
        await config.model.bulkWrite(chunk)

        // Add delay between batches to avoid overwhelming the database
        if (i + batchSize < totalOps) {
          await AppConfig.sleep(AppConfig.BULK_WRITE.batchDelayMs)
        }
      } catch (error: any) {
        // Log detailed error for debugging
        console.error(
          `Failed to write chunk ${chunkNum}/${totalChunks} for ${config.name}: ${error.message}`,
        )

        // Check if error is recoverable (network issues, timeouts, etc.)
        const isRecoverable =
          error.message?.includes('EPIPE') ||
          error.message?.includes('ETIMEDOUT') ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('timeout')

        if (isRecoverable) {
          // Retry this specific chunk with exponential backoff
          await AppConfig.sleep(AppConfig.calculateBackoff(0))

          try {
            await config.model.bulkWrite(chunk)
          } catch (retryError: any) {
            console.error(
              `Chunk ${chunkNum} retry failed: ${retryError.message}`,
            )
            throw retryError
          }
        } else {
          // Non-recoverable error, throw immediately
          throw error
        }
      }
    }
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
        const boundMethod = (api as any)[methodName].bind(api)

        // Return an async function that applies timeout if needed
        return async () => {
          const timeout = config.useExtendedTimeout
            ? AppConfig.TIMEOUT.k8sLargeResourceRequest
            : AppConfig.TIMEOUT.k8sRequest

          // Add timeout to the promise
          return Promise.race([
            boundMethod(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error(`Request timeout after ${timeout}ms`)),
                timeout,
              ),
            ),
          ])
        }
      }
    } else {
      // For cluster-scoped resources, use listX (without ForAllNamespaces)
      const methodName = `list${singular}`
      if (typeof (api as any)[methodName] === 'function') {
        const boundMethod = (api as any)[methodName].bind(api)

        // Return an async function that applies timeout if needed
        return async () => {
          const timeout = config.useExtendedTimeout
            ? AppConfig.TIMEOUT.k8sLargeResourceRequest
            : AppConfig.TIMEOUT.k8sRequest

          // Add timeout to the promise
          return Promise.race([
            boundMethod(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error(`Request timeout after ${timeout}ms`)),
                timeout,
              ),
            ),
          ])
        }
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
