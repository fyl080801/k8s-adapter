/**
 * Generic API Routes Generator
 * Auto-generates RESTful routes for all registered K8s resources
 */

import { Router, Request, Response } from 'express'
import { K8sResourceConfig, getAllResourceConfigs } from '../k8s/types'

/**
 * Create list route handler for a resource
 */
function createListHandler(config: K8sResourceConfig) {
  return async (req: Request, res: Response) => {
    try {
      const { namespace, page = 1, limit = 10, search } = req.query

      const query: any = {}
      if (config.namespaced && namespace) {
        query.namespace = namespace // Use flattened namespace field
      }
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
      console.error(`Error fetching ${config.plural}:`, error)
      res.status(500).json({ error: `Failed to fetch ${config.plural}` })
    }
  }
}

/**
 * Create detail route handler for a resource
 */
function createDetailHandler(config: K8sResourceConfig) {
  return async (req: Request, res: Response) => {
    try {
      const idKey = config.getIdKey()
      // Use flattened field (uid) instead of nested metadata.uid
      const queryKey = idKey
      const item = await config.model.findOne({ [queryKey]: req.params.id })

      if (!item) {
        return res.status(404).json({ error: `${config.name} not found` })
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
    // List endpoint: GET /api/v1/{plural}
    router.get(`/${config.plural}`, createListHandler(config))

    // Detail endpoint: GET /api/v1/{plural}/:id
    router.get(`/${config.plural}/:id`, createDetailHandler(config))

    // Namespace-specific list endpoint (for namespaced resources)
    if (config.namespaced) {
      router.get(
        `/namespace/:namespace/${config.plural}`,
        createNamespaceListHandler(config),
      )
    }

    console.log(`✅ Generated routes for ${config.name}:`)
    console.log(`   GET    /api/v1/${config.plural}`)
    console.log(`   GET    /api/v1/${config.plural}/:id`)
    if (config.namespaced) {
      console.log(`   GET    /api/v1/namespace/:namespace/${config.plural}`)
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
