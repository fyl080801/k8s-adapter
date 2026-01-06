/**
 * Optimized API Routes
 * Auto-generated routes for all registered K8s resources
 */

import { Router } from 'express'
import { generateRoutes, generateStatsHandler } from './generic-routes'
import { getInformer, getHealthStatus } from '../k8s/optimized-init'

const router = Router()

// Generate all resource routes automatically
const generatedRouter = generateRoutes()

// Mount generated routes
router.use('/', generatedRouter)

// Statistics endpoint
router.get('/stats/overview', generateStatsHandler())

// Informer health status endpoint
router.get('/status', (req, res) => {
  try {
    const health = getHealthStatus()
    res.json(health)
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' })
  }
})

// Resource type listing endpoint
router.get('/resources', (req, res) => {
  try {
    const informer = getInformer()
    const status = informer.getStatus()
    res.json({
      resources: status,
      count: status.length,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to get resource list' })
  }
})

export default router
