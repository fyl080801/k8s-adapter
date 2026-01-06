/**
 * API Routes - Using Generic Route Generator
 * All routes are automatically generated based on registered K8s resources
 */

import { Router } from 'express'
import { generateRoutes, generateStatsHandler } from './generic-routes'

const router = Router()

// Generate all routes for registered resources
const genericRouter = generateRoutes()
router.use(genericRouter)

// Add statistics endpoint
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
  // This will be dynamically populated by the generic routes
  res.json({
    endpoints: [
      {
        path: '/api/v1/health',
        method: 'GET',
        description: 'Health check endpoint',
      },
      {
        path: '/api/v1/stats/overview',
        method: 'GET',
        description: 'Get statistics for all resources',
      },
      {
        path: '/api/v1/{resource}',
        method: 'GET',
        description: 'List all resources of a type (with pagination)',
        parameters: {
          namespace: 'Filter by namespace (optional)',
          page: 'Page number (default: 1)',
          limit: 'Items per page (default: 10)',
          search: 'Search by name (case-insensitive)',
        },
      },
      {
        path: '/api/v1/{resource}/:id',
        method: 'GET',
        description: 'Get a specific resource by ID',
      },
      {
        path: '/api/v1/namespace/:namespace/{resource}',
        method: 'GET',
        description: 'List resources in a specific namespace',
      },
    ],
  })
})

export default router
