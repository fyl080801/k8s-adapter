/**
 * Kubernetes Native Operations Routes
 * Provides direct Kubernetes API access using @kubernetes/client-node
 * These routes complement the database-backed routes in generic-routes.ts
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
    console.error('Error getting cluster info:', error)
    res
      .status(500)
      .json({ error: `Failed to get cluster info: ${error.message}` })
  }
})

// =============================================================================
// Pod Specific Operations
// =============================================================================

/**
 * GET /api/v1/pods/:namespace/:name/logs
 * Get logs for a specific pod
 * Query params:
 *   - container: container name (for multi-container pods)
 *   - tailLines: number of lines from the end of the logs (default: 100)
 */
router.get('/pods/:namespace/:name/logs', async (req, res) => {
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
    console.error('Error getting pod logs:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/v1/pods/:namespace/:name/yaml
 * Get raw Kubernetes YAML/JSON manifest for a pod
 */
router.get('/pods/:namespace/:name/yaml', async (req, res) => {
  try {
    const { namespace, name } = req.params
    const pod = await getK8sObject('Pod', name, namespace)

    if (!pod) {
      return res.status(404).json({ error: 'Pod not found' })
    }

    res.json(pod)
  } catch (error: any) {
    console.error('Error getting pod manifest:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/v1/pods/:namespace/:name/events
 * Get events for a specific pod
 */
router.get('/pods/:namespace/:name/events', async (req, res) => {
  try {
    const { namespace, name } = req.params
    const events = await getEventsForResource('Pod', namespace, name)

    res.json({
      data: events,
      count: events.length,
    })
  } catch (error: any) {
    console.error('Error getting pod events:', error)
    res.status(500).json({ error: error.message })
  }
})

// =============================================================================
// Generic Resource Operations (Direct K8s API Access)
// =============================================================================

/**
 * GET /api/v1/:resource/:namespace/:name/yaml
 * Get raw Kubernetes YAML/JSON manifest for any resource
 */
router.get('/:resource/:namespace/:name/yaml', async (req, res) => {
  try {
    const { resource, namespace, name } = req.params

    // Get resource config to determine the kind
    const config = getResourceConfig(resource)
    if (!config) {
      return res
        .status(404)
        .json({ error: `Resource type '${resource}' not found` })
    }

    const obj = await getK8sObject(config.kind, name, namespace)

    if (!obj) {
      return res
        .status(404)
        .json({ error: `${config.kind} '${name}' not found` })
    }

    res.json(obj)
  } catch (error: any) {
    console.error('Error getting resource manifest:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/v1/:resource/:namespace/:name/events
 * Get events for any resource
 */
router.get('/:resource/:namespace/:name/events', async (req, res) => {
  try {
    const { resource, namespace, name } = req.params

    // Get resource config to determine the kind
    const config = getResourceConfig(resource)
    if (!config) {
      return res
        .status(404)
        .json({ error: `Resource type '${resource}' not found` })
    }

    const events = await getEventsForResource(config.kind, namespace, name)

    res.json({
      data: events,
      count: events.length,
    })
  } catch (error: any) {
    console.error('Error getting resource events:', error)
    res.status(500).json({ error: error.message })
  }
})

// =============================================================================
// CRUD Operations (Direct K8s API Access)
// =============================================================================

/**
 * POST /api/v1/:resource
 * Create a new Kubernetes resource
 * Body: Kubernetes manifest (JSON)
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

    const namespace = manifest.metadata.namespace

    const result = await createK8sResource(config.kind, namespace, manifest)

    res.status(201).json({
      message: `${config.kind} created successfully`,
      data: result,
    })
  } catch (error: any) {
    console.error('Error creating resource:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PUT /api/v1/:resource/:namespace/:name
 * Update an existing Kubernetes resource
 * Body: Kubernetes manifest (JSON)
 */
router.put('/:resource/:namespace/:name', async (req, res) => {
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
    console.error('Error updating resource:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/v1/:resource/:namespace/:name
 * Delete a Kubernetes resource
 */
router.delete('/:resource/:namespace/:name', async (req, res) => {
  try {
    const { resource, namespace, name } = req.params

    // Get resource config
    const config = getResourceConfig(resource)
    if (!config) {
      return res
        .status(404)
        .json({ error: `Resource type '${resource}' not found` })
    }

    await deleteK8sResource(config.kind, namespace, name)

    res.json({
      message: `${config.kind} '${name}' deleted successfully`,
    })
  } catch (error: any) {
    console.error('Error deleting resource:', error)
    res.status(500).json({ error: error.message })
  }
})

// =============================================================================
// Cluster-scoped Resources (No Namespace)
// =============================================================================

/**
 * GET /api/v1/:resource/:name/yaml
 * Get raw Kubernetes YAML/JSON for cluster-scoped resources
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
        error: `Resource '${resource}' is namespaced. Use /api/v1/${resource}/:namespace/:name/yaml instead`,
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
    console.error('Error getting resource manifest:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PUT /api/v1/:resource/:name
 * Update a cluster-scoped Kubernetes resource
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

    // Only allow for cluster-scoped resources
    if (config.namespaced) {
      return res.status(400).json({
        error: `Resource '${resource}' is namespaced. Use /api/v1/${resource}/:namespace/:name instead`,
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
    console.error('Error updating resource:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/v1/:resource/:name
 * Delete a cluster-scoped Kubernetes resource
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

    // Only allow for cluster-scoped resources
    if (config.namespaced) {
      return res.status(400).json({
        error: `Resource '${resource}' is namespaced. Use /api/v1/${resource}/:namespace/:name instead`,
      })
    }

    await deleteK8sResource(config.kind, undefined, name)

    res.json({
      message: `${config.kind} '${name}' deleted successfully`,
    })
  } catch (error: any) {
    console.error('Error deleting resource:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
