import 'dotenv/config'

import { config } from '@keystone-6/core'
import * as schema from '@k8s-adapter/schema'
import { withAuth, session } from './auth'

// Kubernetes informer imports
import {
  initializeK8sInformer,
  setupShutdownHandlers,
} from './src/k8s/optimized-init'
import routes from './src/api/routes'
import healthRoutes from './src/api/health-routes'
import { createContextMiddleware } from './src/middleware/context'
import { resourceIdentifier } from './src/middleware/resource-identifier'
import { syncStatusHeader } from './src/middleware/sync-status'
import { connectDB } from './src/lib/mongodb'
import { logger } from './src/lib/logger'
import { AppConfig } from './src/config/app-config'

// Configure logger based on app config
logger.configure({
  level: AppConfig.LOGGING.LEVEL,
  enableColors: AppConfig.LOGGING.ENABLE_COLORS,
  enableTimestamp: AppConfig.LOGGING.ENABLE_TIMESTAMPS,
  enableFileLogging: AppConfig.LOGGING.ENABLE_FILE_LOGGING,
  logDir: AppConfig.LOGGING.LOG_DIR,
})

export default withAuth(
  config({
    db: {
      provider: 'sqlite',
      url: 'file:./keystone.db',
    },
    ui: {
      isDisabled: true,
    },
    lists: schema.lists as any,
    session,
    server: {
      extendExpressApp(app, context) {
        // Initialize K8s Informer System with optimized sync strategy
        ;(async () => {
          try {
            // Connect to MongoDB first
            await connectDB()

            // Initialize Kubernetes Informer (optimized sync + watch)
            await initializeK8sInformer()

            // Setup graceful shutdown handlers
            setupShutdownHandlers()
          } catch (err) {
            logger.error('Failed to initialize K8s system', err)
          }
        })()

        // Attach Keystone context to all requests
        app.use(createContextMiddleware(context))

        // Mount health check routes first (before readiness check)
        app.use('/api/v1/health', healthRoutes)

        // Identify resource for all API requests (must be before syncStatusHeader)
        app.use('/api/v1', resourceIdentifier)

        // Add sync status headers to API responses (resource-specific only)
        app.use('/api/v1', syncStatusHeader)

        // Mount K8s API routes
        app.use('/api/v1', routes)
      },
      extendHttpServer() {},
    },
  }),
)
