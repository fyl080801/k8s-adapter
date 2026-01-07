/**
 * Generic API Routes Generator
 * Auto-generates RESTful routes for all registered K8s resources
 */

import { Router, Request, Response } from 'express'
import { K8sResourceConfig, getAllResourceConfigs } from '../k8s/types'

/**
 * Create list route handler for a resource
 * Query params:
 *   - namespaces: comma-separated list of namespaces (e.g., "default,kube-system")
 *   - page: page number (default: 1)
 *   - limit: items per page (default: 10)
 *   - search: search by name (case-insensitive regex)
 */
function createListHandler(config: K8sResourceConfig) {
  return async (req: Request, res: Response) => {
    try {
      const { namespaces, page = 1, limit = 10, search } = req.query
      const startTime = Date.now()

      const query: any = {}
      if (config.namespaced && namespaces) {
        // Support multiple namespaces via comma-separated values
        const namespaceList = (namespaces as string)
          .split(',')
          .map(ns => ns.trim())
        console.log(
          `[API] Querying ${config.plural} from namespaces:`,
          namespaceList,
        )
        query.namespace = { $in: namespaceList }
      }
      if (search) {
        query.name = { $regex: search, $options: 'i' } // Use flattened name field
      }

      const skip = (Number(page) - 1) * Number(limit)

      console.log(`[API] Query:`, JSON.stringify(query))
      console.log(`[API] Fetching ${config.plural}...`)

      const items = await config.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-raw')
        .lean() // Add lean() for better performance with read-only operations
        .exec()

      const queryTime = Date.now() - startTime
      console.log(
        `[API] Query completed in ${queryTime}ms, found ${items.length} items`,
      )

      console.log(`[API] Counting total documents...`)
      const countStart = Date.now()
      const total = await config.model.countDocuments(query).lean()
      const countTime = Date.now() - countStart
      console.log(`[API] Count completed in ${countTime}ms, total: ${total}`)

      res.json({
        data: items,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
        debug:
          process.env.NODE_ENV === 'development'
            ? {
                queryTime: `${queryTime}ms`,
                countTime: `${countTime}ms`,
                totalTime: `${Date.now() - startTime}ms`,
              }
            : undefined,
      })
    } catch (error) {
      console.error(`Error fetching ${config.plural}:`, error)
      res.status(500).json({ error: `Failed to fetch ${config.plural}` })
    }
  }
}

/**
 * Create detail route handler for a resource (by namespace and name)
 * Matches K8s native API pattern: GET /api/v1/namespaces/{namespace}/pods/{name}
 */
function createDetailHandler(config: K8sResourceConfig) {
  return async (req: Request, res: Response) => {
    try {
      const { namespace, name } = req.params

      // For namespaced resources, query by namespace + name
      // For cluster-scoped resources, query by name only
      const query: any = { name }
      if (config.namespaced && namespace) {
        query.namespace = namespace
      }

      const item = await config.model.findOne(query)

      if (!item) {
        return res.status(404).json({
          error: `${config.name} not found`,
          details: config.namespaced
            ? `${config.name} '${name}' not found in namespace '${namespace}'`
            : `${config.name} '${name}' not found`,
        })
      }

      res.json(item)
    } catch (error) {
      console.error(`Error fetching ${config.name}:`, error)
      res.status(500).json({ error: `Failed to fetch ${config.name}` })
    }
  }
}

/**
 * Create namespace-specific list route handler
 */
function createNamespaceListHandler(config: K8sResourceConfig) {
  return async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 10, search } = req.query
      const { namespace } = req.params

      const query: any = { namespace: namespace } // Use flattened namespace field
      if (search) {
        query.name = { $regex: search, $options: 'i' } // Use flattened name field
      }

      const skip = (Number(page) - 1) * Number(limit)

      const items = await config.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-raw')

      const total = await config.model.countDocuments(query)

      res.json({
        data: items,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      })
    } catch (error) {
      console.error(
        `Error fetching ${config.plural} for namespace ${req.params.namespace}:`,
        error,
      )
      res.status(500).json({ error: `Failed to fetch ${config.plural}` })
    }
  }
}

/**
 * Generate all routes for registered resources
 * Uses K8s native API path patterns:
 * - Namespaced resources: /namespaces/{ns}/{resource} and /namespaces/{ns}/{resource}/{name}
 * - Cluster resources: /{resource} and /{resource}/{name}
 *
 * Query parameters for list endpoints:
 * - namespaces: comma-separated list of namespaces (e.g., "default,kube-system,monitoring")
 * - page: page number (default: 1)
 * - limit: items per page (default: 10)
 * - search: search by name (case-insensitive regex)
 *
 * Examples:
 * - GET /api/v1/pods?namespaces=default,kube-system
 * - GET /api/v1/deployments?namespaces=monitoring&page=2&limit=20
 * - GET /api/v1/pods?namespaces=default&search=nginx
 */
export function generateRoutes(): Router {
  const router = Router()
  const configs = getAllResourceConfigs()

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // Generate routes for each resource type
  configs.forEach(config => {
    if (config.namespaced) {
      // Namespaced resources follow K8s pattern: /namespaces/{namespace}/{resource}
      // List all across namespaces: GET /api/v1/namespaces/{namespace}/pods
      router.get(
        `/namespaces/:namespace/${config.plural}`,
        createNamespaceListHandler(config),
      )

      // Get specific resource: GET /api/v1/namespaces/{namespace}/pods/{name}
      router.get(
        `/namespaces/:namespace/${config.plural}/:name`,
        createDetailHandler(config),
      )

      // Alternative: List across multiple namespaces (with query param)
      // GET /api/v1/pods?namespaces=default,kube-system
      router.get(`/${config.plural}`, createListHandler(config))
    } else {
      // Cluster-scoped resources: /nodes, /persistentvolumes, etc.
      // List all: GET /api/v1/nodes
      router.get(`/${config.plural}`, createListHandler(config))

      // Get specific resource: GET /api/v1/nodes/{name}
      router.get(`/${config.plural}/:name`, (req, res) => {
        // Inject empty namespace for cluster-scoped resources
        req.params.namespace = undefined as any
        return createDetailHandler(config)(req, res)
      })
    }
  })

  return router
}

/**
 * Generate statistics endpoint that aggregates all resource counts
 */
export function generateStatsHandler() {
  return async (req: Request, res: Response) => {
    try {
      const configs = getAllResourceConfigs()

      const stats: Record<string, any> = {}

      await Promise.all(
        configs.map(async config => {
          const total = await config.model.countDocuments()

          if (config.name === 'Pod') {
            const running = await config.model.countDocuments({
              phase: 'Running',
            })
            const failed = await config.model.countDocuments({
              phase: 'Failed',
            })
            const pending = await config.model.countDocuments({
              phase: 'Pending',
            })

            stats.pods = {
              total,
              running,
              failed,
              pending,
            }
          } else if (config.name === 'Node') {
            const ready = await config.model.countDocuments({ phase: 'Ready' })
            stats.nodes = {
              total,
              ready,
            }
          } else {
            stats[config.plural] = total
          }
        }),
      )

      res.json(stats)
    } catch (error) {
      console.error('Error fetching statistics:', error)
      res.status(500).json({ error: 'Failed to fetch statistics' })
    }
  }
}

/**
 * Generate status endpoint showing informer health
 */
export function generateStatusHandler(informer: {
  getStatus: () => Array<any>
}) {
  return async (req: Request, res: Response) => {
    try {
      const status = informer.getStatus()
      res.json({
        timestamp: new Date().toISOString(),
        informers: status,
      })
    } catch (error) {
      console.error('Error fetching status:', error)
      res.status(500).json({ error: 'Failed to fetch status' })
    }
  }
}
