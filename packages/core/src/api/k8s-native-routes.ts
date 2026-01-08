/**
 * Kubernetes Native Operations Routes
 * Provides direct Kubernetes API access using @kubernetes/client-node
 * Uses K8s native API path patterns for consistency
 */

import { Router } from 'express'
import {
  getPodLogs,
  getK8sObject,
  getEventsForResource,
  createK8sResource,
  updateK8sResource,
  deleteK8sResource,
  getCurrentContext,
  getContexts,
} from '../lib/k8s-client'
import { getResourceConfig } from '../k8s/types'
import { createLogger } from '../lib/logger'

const logger = createLogger('K8sNativeAPI')

const router = Router()

// =============================================================================
// Cluster Information
// =============================================================================

/**
 * GET /api/v1/cluster/info
 * Get current Kubernetes cluster context information
 */
router.get('/cluster/info', (_req, res) => {
  try {
    const currentContext = getCurrentContext()
    const contexts = getContexts()

    res.json({
      currentContext,
      availableContexts: contexts,
    })
  } catch (error: any) {
    logger.error('Error getting cluster info', error)
    res
      .status(500)
      .json({ error: `Failed to get cluster info: ${error.message}` })
  }
})

// =============================================================================
// Pod Specific Operations
// =============================================================================

/**
 * GET /api/v1/namespaces/:namespace/pods/:name/logs
 * Get logs for a specific pod
 * Query params:
 *   - container: container name (for multi-container pods)
 *   - tailLines: number of lines from the end of the logs (default: 100)
 *
 * @example GET /api/v1/namespaces/default/pods/my-pod/logs?tailLines=100
 */
router.get('/namespaces/:namespace/pods/:name/logs', async (req, res) => {
  try {
    const { namespace, name } = req.params
    const { container, tailLines } = req.query

    const logs = await getPodLogs(
      namespace,
      name,
      container as string | undefined,
      tailLines ? parseInt(tailLines as string) : undefined,
    )

    res.type('text/plain').send(logs)
  } catch (error: any) {
    logger.error('Error getting pod logs', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/v1/namespaces/:namespace/pods/:name/events
 * Get events for a specific pod
 *
 * @example GET /api/v1/namespaces/default/pods/my-pod/events
 */
router.get('/namespaces/:namespace/pods/:name/events', async (req, res) => {
  try {
    const { namespace, name } = req.params
    const events = await getEventsForResource('Pod', namespace, name)

    res.json({
      data: events,
      count: events.length,
    })
  } catch (error: any) {
    logger.error('Error getting pod events', error)
    res.status(500).json({ error: error.message })
  }
})

// =============================================================================
// Generic Resource Operations (Direct K8s API Access)
// These routes provide real-time access to Kubernetes resources
// =============================================================================

/**
 * GET /api/v1/namespaces/:namespace/:resource/:name/yaml
 * Get raw Kubernetes YAML/JSON manifest for any namespaced resource
 *
 * @example GET /api/v1/namespaces/default/configmaps/my-config/yaml
 * @example GET /api/v1/namespaces/kube-system/deployments/coredns/yaml
 */
router.get('/namespaces/:namespace/:resource/:name/yaml', async (req, res) => {
  try {
    const { resource, namespace, name } = req.params

    // Get resource config to determine the kind
    const config = getResourceConfig(resource)
    if (!config) {
      return res
        .status(404)
        .json({ error: `Resource type '${resource}' not found` })
    }

    // Verify resource is namespaced
    if (!config.namespaced) {
      return res.status(400).json({
        error: `Resource '${resource}' is cluster-scoped. Use /api/v1/${resource}/${name}/yaml instead`,
      })
    }

    const obj = await getK8sObject(config.kind, name, namespace)

    if (!obj) {
      return res.status(404).json({
        error: `${config.kind} '${name}' not found in namespace '${namespace}'`,
      })
    }

    res.json(obj)
  } catch (error: any) {
    logger.error('Error getting resource manifest', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/v1/:resource/:name/yaml
 * Get raw Kubernetes YAML/JSON for cluster-scoped resources
 *
 * @example GET /api/v1/nodes/node-1/yaml
 * @example GET /api/v1/persistentvolumes/pv-1/yaml
 */
router.get('/:resource/:name/yaml', async (req, res) => {
  try {
    const { resource, name } = req.params

    // Get resource config
    const config = getResourceConfig(resource)
    if (!config) {
      return res
        .status(404)
        .json({ error: `Resource type '${resource}' not found` })
    }

    // Only allow for cluster-scoped resources
    if (config.namespaced) {
      return res.status(400).json({
        error: `Resource '${resource}' is namespaced. Use /api/v1/namespaces/:namespace/${resource}/${name}/yaml instead`,
      })
    }

    const obj = await getK8sObject(config.kind, name)

    if (!obj) {
      return res
        .status(404)
        .json({ error: `${config.kind} '${name}' not found` })
    }

    res.json(obj)
  } catch (error: any) {
    logger.error('Error getting resource manifest', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/v1/namespaces/:namespace/:resource/:name/events
 * Get events for any namespaced resource
 *
 * @example GET /api/v1/namespaces/default/deployments/my-deployment/events
 */
router.get(
  '/namespaces/:namespace/:resource/:name/events',
  async (req, res) => {
    try {
      const { resource, namespace, name } = req.params

      // Get resource config to determine the kind
      const config = getResourceConfig(resource)
      if (!config) {
        return res
          .status(404)
          .json({ error: `Resource type '${resource}' not found` })
      }

      if (!config.namespaced) {
        return res.status(400).json({
          error: `Resource '${resource}' is cluster-scoped and does not support namespace filtering`,
        })
      }

      const events = await getEventsForResource(config.kind, namespace, name)

      res.json({
        data: events,
        count: events.length,
      })
    } catch (error: any) {
      logger.error('Error getting resource events', error)
      res.status(500).json({ error: error.message })
    }
  },
)

// =============================================================================
// CRUD Operations (Direct K8s API Access)
// =============================================================================

/**
 * POST /api/v1/namespaces/:namespace/:resource
 * Create a new namespaced Kubernetes resource
 * Body: Kubernetes manifest (JSON)
 *
 * @example POST /api/v1/namespaces/default/configmaps
 * Body: { "kind": "ConfigMap", "metadata": { "name": "my-config", "namespace": "default" }, "data": {} }
 */
router.post('/namespaces/:namespace/:resource', async (req, res) => {
  try {
    const { resource, namespace } = req.params
    const manifest = req.body

    // Validate manifest
    if (!manifest || !manifest.kind || !manifest.metadata) {
      return res.status(400).json({
        error: 'Invalid manifest. Must include kind and metadata fields',
      })
    }

    // Get resource config
    const config = getResourceConfig(resource)
    if (!config) {
      return res
        .status(404)
        .json({ error: `Resource type '${resource}' not found` })
    }

    // Verify kind matches
    if (manifest.kind !== config.kind) {
      return res.status(400).json({
        error: `Kind mismatch. Expected '${config.kind}', got '${manifest.kind}'`,
      })
    }

    // Verify namespace matches
    if (manifest.metadata.namespace !== namespace) {
      return res.status(400).json({
        error: `Namespace mismatch. URL param '${namespace}', manifest field '${manifest.metadata.namespace}'`,
      })
    }

    const result = await createK8sResource(config.kind, namespace, manifest)

    res.status(201).json({
      message: `${config.kind} created successfully`,
      data: result,
    })
  } catch (error: any) {
    logger.error('Error creating resource', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/v1/:resource
 * Create a new cluster-scoped Kubernetes resource
 * Body: Kubernetes manifest (JSON)
 *
 * @example POST /api/v1/persistentvolumes
 */
router.post('/:resource', async (req, res) => {
  try {
    const { resource } = req.params
    const manifest = req.body

    // Validate manifest
    if (!manifest || !manifest.kind || !manifest.metadata) {
      return res.status(400).json({
        error: 'Invalid manifest. Must include kind and metadata fields',
      })
    }

    // Get resource config
    const config = getResourceConfig(resource)
    if (!config) {
      return res
        .status(404)
        .json({ error: `Resource type '${resource}' not found` })
    }

    // Verify kind matches
    if (manifest.kind !== config.kind) {
      return res.status(400).json({
        error: `Kind mismatch. Expected '${config.kind}', got '${manifest.kind}'`,
      })
    }

    // Verify resource is cluster-scoped
    if (config.namespaced) {
      return res.status(400).json({
        error: `Resource '${resource}' is namespaced. Use POST /api/v1/namespaces/:namespace/${resource} instead`,
      })
    }

    const result = await createK8sResource(config.kind, undefined, manifest)

    res.status(201).json({
      message: `${config.kind} created successfully`,
      data: result,
    })
  } catch (error: any) {
    logger.error('Error creating resource', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PUT /api/v1/namespaces/:namespace/:resource/:name
 * Update an existing namespaced Kubernetes resource
 * Body: Kubernetes manifest (JSON)
 *
 * @example PUT /api/v1/namespaces/default/configmaps/my-config
 */
router.put('/namespaces/:namespace/:resource/:name', async (req, res) => {
  try {
    const { resource, namespace, name } = req.params
    const manifest = req.body

    // Validate manifest
    if (!manifest || !manifest.kind || !manifest.metadata) {
      return res.status(400).json({
        error: 'Invalid manifest. Must include kind and metadata fields',
      })
    }

    // Get resource config
    const config = getResourceConfig(resource)
    if (!config) {
      return res
        .status(404)
        .json({ error: `Resource type '${resource}' not found` })
    }

    // Verify kind matches
    if (manifest.kind !== config.kind) {
      return res.status(400).json({
        error: `Kind mismatch. Expected '${config.kind}', got '${manifest.kind}'`,
      })
    }

    // Verify name matches
    if (manifest.metadata.name !== name) {
      return res.status(400).json({
        error: `Name mismatch. URL param '${name}', manifest field '${manifest.metadata.name}'`,
      })
    }

    // Verify namespace matches
    if (manifest.metadata.namespace !== namespace) {
      return res.status(400).json({
        error: `Namespace mismatch. URL param '${namespace}', manifest field '${manifest.metadata.namespace}'`,
      })
    }

    const result = await updateK8sResource(
      config.kind,
      namespace,
      name,
      manifest,
    )

    res.json({
      message: `${config.kind} updated successfully`,
      data: result,
    })
  } catch (error: any) {
    logger.error('Error updating resource', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PUT /api/v1/:resource/:name
 * Update a cluster-scoped Kubernetes resource
 * Body: Kubernetes manifest (JSON)
 *
 * @example PUT /api/v1/persistentvolumes/pv-1
 */
router.put('/:resource/:name', async (req, res) => {
  try {
    const { resource, name } = req.params
    const manifest = req.body

    // Validate manifest
    if (!manifest || !manifest.kind || !manifest.metadata) {
      return res.status(400).json({
        error: 'Invalid manifest. Must include kind and metadata fields',
      })
    }

    // Get resource config
    const config = getResourceConfig(resource)
    if (!config) {
      return res
        .status(404)
        .json({ error: `Resource type '${resource}' not found` })
    }

    // Verify resource is cluster-scoped
    if (config.namespaced) {
      return res.status(400).json({
        error: `Resource '${resource}' is namespaced. Use PUT /api/v1/namespaces/:namespace/${resource}/:name instead`,
      })
    }

    // Verify kind matches
    if (manifest.kind !== config.kind) {
      return res.status(400).json({
        error: `Kind mismatch. Expected '${config.kind}', got '${manifest.kind}'`,
      })
    }

    // Verify name matches
    if (manifest.metadata.name !== name) {
      return res.status(400).json({
        error: `Name mismatch. URL param '${name}', manifest field '${manifest.metadata.name}'`,
      })
    }

    const result = await updateK8sResource(
      config.kind,
      undefined,
      name,
      manifest,
    )

    res.json({
      message: `${config.kind} updated successfully`,
      data: result,
    })
  } catch (error: any) {
    logger.error('Error updating resource', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/v1/namespaces/:namespace/:resource/:name
 * Delete a namespaced Kubernetes resource
 *
 * @example DELETE /api/v1/namespaces/default/configmaps/my-config
 */
router.delete('/namespaces/:namespace/:resource/:name', async (req, res) => {
  try {
    const { resource, namespace, name } = req.params

    // Get resource config
    const config = getResourceConfig(resource)
    if (!config) {
      return res
        .status(404)
        .json({ error: `Resource type '${resource}' not found` })
    }

    if (!config.namespaced) {
      return res.status(400).json({
        error: `Resource '${resource}' is cluster-scoped. Use DELETE /api/v1/${resource}/${name} instead`,
      })
    }

    await deleteK8sResource(config.kind, namespace, name)

    res.json({
      message: `${config.kind} '${name}' deleted successfully from namespace '${namespace}'`,
    })
  } catch (error: any) {
    logger.error('Error deleting resource', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/v1/:resource/:name
 * Delete a cluster-scoped Kubernetes resource
 *
 * @example DELETE /api/v1/persistentvolumes/pv-1
 */
router.delete('/:resource/:name', async (req, res) => {
  try {
    const { resource, name } = req.params

    // Get resource config
    const config = getResourceConfig(resource)
    if (!config) {
      return res
        .status(404)
        .json({ error: `Resource type '${resource}' not found` })
    }

    // Verify resource is cluster-scoped
    if (config.namespaced) {
      return res.status(400).json({
        error: `Resource '${resource}' is namespaced. Use DELETE /api/v1/namespaces/:namespace/${resource}/:name instead`,
      })
    }

    await deleteK8sResource(config.kind, undefined, name)

    res.json({
      message: `${config.kind} '${name}' deleted successfully`,
    })
  } catch (error: any) {
    logger.error('Error deleting resource', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
