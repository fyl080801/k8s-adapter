/**
 * API Routes - Using Generic Route Generator
 * All routes are automatically generated based on registered K8s resources
 */

import { Router } from 'express'
import { generateRoutes, generateStatsHandler } from './generic-routes'
import k8sNativeRoutes from './k8s-native-routes'
import { requireApiKey } from '../middleware/auth'
import { getSyncStatus } from '../k8s/optimized-init'

const router = Router()

// Public endpoints (no authentication required)
router.get('/health', (_req, res) => {
  const syncStatus = getSyncStatus()
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sync: syncStatus,
  })
})

// Sync status endpoint (public)
router.get('/sync/status', (_req, res) => {
  const syncStatus = getSyncStatus()
  res.json(syncStatus)
})

// Apply authentication to all routes except health check
// All routes below this line require authentication
router.use(requireApiKey)

// Generate all routes for registered resources (database-backed)
const genericRouter = generateRoutes()
router.use(genericRouter)

// Mount Kubernetes native operations routes (direct K8s API access)
router.use(k8sNativeRoutes)

// Add statistics endpoint (requires authentication)
router.get('/stats/overview', generateStatsHandler())

// Add informative endpoint about available resources
router.get('/resources', (_req, res) => {
  res.json({
    message: 'This API now uses a generic route generator',
    note: 'All resource routes are auto-generated from RESOURCE_CONFIGS',
    documentation: '/api/v1/resources/registry',
  })
})

// Resource registry endpoint
router.get('/resources/registry', (_req, res) => {
  res.json({
    apiVersion: 'v1',
    format: 'Kubernetes Native API Path Patterns',
    note: 'This API follows Kubernetes native path conventions for consistency',
    endpoints: [
      {
        category: 'Health & Stats',
        endpoints: [
          {
            path: '/api/v1/health',
            method: 'GET',
            description: 'Health check endpoint (includes sync status)',
          },
          {
            path: '/api/v1/sync/status',
            method: 'GET',
            description: 'Get detailed sync progress and status',
          },
          {
            path: '/api/v1/stats/overview',
            method: 'GET',
            description: 'Get statistics for all resources',
          },
          {
            path: '/api/v1/cluster/info',
            method: 'GET',
            description: 'Get current Kubernetes cluster context information',
          },
        ],
      },
      {
        category: 'Database-Backed Queries (from MongoDB)',
        note: 'These endpoints query data synced from Kubernetes Informer. Uses K8s native path patterns.',
        endpoints: [
          {
            path: '/api/v1/namespaces/:namespace/{resource}',
            method: 'GET',
            description:
              'List resources in a specific namespace (with pagination)',
            parameters: {
              page: 'Page number (default: 1)',
              limit: 'Items per page (default: 10)',
              search: 'Search by name (case-insensitive)',
            },
            examples: [
              '/api/v1/namespaces/default/pods',
              '/api/v1/namespaces/kube-system/deployments?page=2&limit=20',
            ],
          },
          {
            path: '/api/v1/namespaces/:namespace/{resource}/:name',
            method: 'GET',
            description: 'Get a specific resource by namespace and name',
            examples: [
              '/api/v1/namespaces/default/pods/my-pod',
              '/api/v1/namespaces/apps/configmaps/firecrawl-config',
            ],
          },
          {
            path: '/api/v1/{resource}',
            method: 'GET',
            description:
              'List all resources of a type (with optional namespace filter)',
            parameters: {
              namespace: 'Filter by namespace (optional)',
              page: 'Page number (default: 1)',
              limit: 'Items per page (default: 10)',
              search: 'Search by name (case-insensitive)',
            },
            examples: [
              '/api/v1/pods',
              '/api/v1/nodes',
              '/api/v1/pods?namespace=default',
            ],
          },
          {
            path: '/api/v1/{resource}/:name',
            method: 'GET',
            description: 'Get a specific cluster-scoped resource by name',
            examples: [
              '/api/v1/nodes/node-1',
              '/api/v1/persistentvolumes/pv-1',
            ],
          },
        ],
      },
      {
        category: 'Direct Kubernetes API Access (Real-Time)',
        note: 'These endpoints use @kubernetes/client-node for real-time operations on K8s API',
        endpoints: [
          {
            path: '/api/v1/namespaces/:namespace/pods/:name/logs',
            method: 'GET',
            description: 'Get logs for a specific pod',
            parameters: {
              container: 'Container name (for multi-container pods, optional)',
              tailLines: 'Number of lines from end of logs (optional)',
            },
            examples: [
              '/api/v1/namespaces/default/pods/my-pod/logs?tailLines=100',
            ],
          },
          {
            path: '/api/v1/namespaces/:namespace/pods/:name/events',
            method: 'GET',
            description: 'Get events for a specific pod',
            examples: ['/api/v1/namespaces/default/pods/my-pod/events'],
          },
          {
            path: '/api/v1/namespaces/:namespace/{resource}/:name/yaml',
            method: 'GET',
            description:
              'Get raw Kubernetes manifest for any namespaced resource',
            examples: [
              '/api/v1/namespaces/default/configmaps/my-config/yaml',
              '/api/v1/namespaces/apps/deployments/my-deployment/yaml',
            ],
          },
          {
            path: '/api/v1/namespaces/:namespace/{resource}/:name/events',
            method: 'GET',
            description: 'Get events for any namespaced resource',
            examples: [
              '/api/v1/namespaces/default/deployments/my-deployment/events',
            ],
          },
          {
            path: '/api/v1/{resource}/:name/yaml',
            method: 'GET',
            description:
              'Get raw Kubernetes manifest for cluster-scoped resources',
            examples: [
              '/api/v1/nodes/node-1/yaml',
              '/api/v1/persistentvolumes/pv-1/yaml',
            ],
          },
        ],
      },
      {
        category: 'CRUD Operations (Direct K8s API)',
        note: 'Create, update, and delete resources directly in Kubernetes',
        endpoints: [
          {
            path: '/api/v1/namespaces/:namespace/{resource}',
            method: 'POST',
            description: 'Create a new namespaced Kubernetes resource',
            body: 'Kubernetes manifest (JSON)',
            examples: [
              'POST /api/v1/namespaces/default/configmaps with ConfigMap manifest',
            ],
          },
          {
            path: '/api/v1/{resource}',
            method: 'POST',
            description: 'Create a new cluster-scoped Kubernetes resource',
            body: 'Kubernetes manifest (JSON)',
            examples: ['POST /api/v1/persistentvolumes with PV manifest'],
          },
          {
            path: '/api/v1/namespaces/:namespace/{resource}/:name',
            method: 'PUT',
            description: 'Update an existing namespaced resource',
            body: 'Kubernetes manifest (JSON)',
            examples: ['PUT /api/v1/namespaces/default/configmaps/my-config'],
          },
          {
            path: '/api/v1/{resource}/:name',
            method: 'PUT',
            description: 'Update a cluster-scoped resource',
            body: 'Kubernetes manifest (JSON)',
            examples: ['PUT /api/v1/persistentvolumes/pv-1'],
          },
          {
            path: '/api/v1/namespaces/:namespace/{resource}/:name',
            method: 'DELETE',
            description: 'Delete a namespaced resource',
            examples: ['DELETE /api/v1/namespaces/default/pods/my-pod'],
          },
          {
            path: '/api/v1/{resource}/:name',
            method: 'DELETE',
            description: 'Delete a cluster-scoped resource',
            examples: ['DELETE /api/v1/persistentvolumes/pv-1'],
          },
        ],
      },
    ],
  })
})

export default router
