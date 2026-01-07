// Welcome to Keystone!
//
// This file is what Keystone uses as the entry-point to your headless backend
//
// Keystone imports the default export of this file, expecting a Keystone configuration object
//   you can find out more at https://keystonejs.com/docs/apis/config
import 'dotenv/config'

import { config } from '@keystone-6/core'

// to keep this file tidy, we define our schema in a different file
import { lists } from './schema'

// authentication is configured separately here too, but you might move this elsewhere
// when you write your list-level access control functions, as they typically rely on session data
import { withAuth, session } from './auth'

// Kubernetes informer imports
import {
  initializeK8sInformer,
  setupShutdownHandlers,
  getHealthStatus,
} from './src/k8s/hybrid-init'
import routes from './src/api/routes'
import healthRoutes from './src/api/health-routes'
import { createContextMiddleware } from './src/middleware/context'
import { syncStatusHeader } from './src/middleware/sync-status'
import { connectDB } from './src/lib/mongodb'

export default withAuth(
  config({
    db: {
      // we're using sqlite for the fastest startup experience
      //   for more information on what database might be appropriate for you
      //   see https://keystonejs.com/docs/guides/choosing-a-database#title
      provider: 'sqlite',
      url: 'file:./keystone.db',
    },
    lists,
    session,
    server: {
      extendExpressApp(app, context) {
        // Initialize K8s Informer System with hybrid sync strategy
        ;(async () => {
          try {
            // Connect to MongoDB first
            await connectDB()

            // Initialize Kubernetes Informer (hybrid sync + watch)
            await initializeK8sInformer(context)

            // Setup graceful shutdown handlers
            setupShutdownHandlers()
          } catch (err) {
            console.error('❌ Failed to initialize K8s system:', err)
          }
        })()

        // Attach Keystone context to all requests
        app.use(createContextMiddleware(context))

        // Add sync status headers to all API responses
        app.use('/api/v1', syncStatusHeader)

        // Mount health check routes first (before readiness check)
        app.use('/api/v1/health', healthRoutes)

        // Add readiness check middleware to protect main API routes
        app.use('/api/v1', (req, res, next) => {
          // Skip readiness check for health endpoints
          if (req.path.startsWith('/health')) {
            return next()
          }

          // Check if system is ready
          const health = getHealthStatus()

          if (!health.ready) {
            return res.status(503).json({
              error: 'System not ready',
              message: 'Kubernetes sync in progress',
              uptime: health.uptime,
            })
          }

          next()
        })

        // Mount K8s API routes
        app.use('/api/v1', routes)
      },
      extendHttpServer() {},
    },
  }),
)
