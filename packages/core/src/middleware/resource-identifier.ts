/**
 * Resource Identification Middleware
 * Adds resource information to the request object based on the URL path
 * Supports both querystring and path-based namespace parameters
 */

import { Request, Response, NextFunction } from 'express'
import { RESOURCE_CONFIGS } from '../k8s/types'
import { createLogger } from '../lib/logger'

const logger = createLogger('ResourceIdentifier')

/**
 * Extended Request type with resource information
 */
export interface ResourceRequest extends Request {
  resourceInfo?: {
    name: string // Resource name (e.g., 'Pod')
    plural: string // Resource plural (e.g., 'pods')
    namespaced: boolean // Whether this resource is namespaced
    namespace?: string // Namespace if provided
  }
}

/**
 * Extract resource information from the request path
 * Supports:
 * - /pods?namespace=default (when mounted at /api/v1)
 * - /pods/:id (when mounted at /api/v1)
 * - /namespace/:namespace/pods (legacy, when mounted at /api/v1)
 * - /namespace/:namespace/pods/:id (legacy, when mounted at /api/v1)
 * - /namespaces/:namespace/pods (K8s native pattern, when mounted at /api/v1)
 * - /namespaces/:namespace/pods/:name (K8s native pattern, when mounted at /api/v1)
 * Note: When using app.use('/api/v1', middleware), Express strips the /api/v1 prefix
 */
function identifyResource(
  req: ResourceRequest,
): ResourceRequest['resourceInfo'] {
  const path = req.path

  // Pattern 1: /namespaces/:namespace/{plural} (K8s native)
  // Pattern 2: /namespaces/:namespace/{plural}/:name (K8s native)
  const k8sNativeMatch = path.match(
    /^\/namespaces\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/,
  )
  if (k8sNativeMatch) {
    const namespace = k8sNativeMatch[1]
    const plural = k8sNativeMatch[2]
    // k8sNativeMatch[3] is the resource name, which we don't need for identification

    const config = RESOURCE_CONFIGS.find(c => c.plural === plural)
    if (config) {
      return {
        name: config.name,
        plural: config.plural,
        namespaced: config.namespaced,
        namespace,
      }
    }
  }

  // Pattern 3: /namespace/:namespace/{plural} (legacy pattern)
  // Pattern 4: /namespace/:namespace/{plural}/:id (legacy pattern)
  const legacyNamespaceMatch = path.match(/^\/namespace\/([^/]+)\/([^/]+)/)
  if (legacyNamespaceMatch) {
    const namespace = legacyNamespaceMatch[1]
    const plural = legacyNamespaceMatch[2]

    const config = RESOURCE_CONFIGS.find(c => c.plural === plural)
    if (config) {
      return {
        name: config.name,
        plural: config.plural,
        namespaced: config.namespaced,
        namespace,
      }
    }
  }

  // Pattern 5: /{plural}
  // Pattern 6: /{plural}/:name
  const directPathMatch = path.match(/^\/([^/]+)/)
  if (directPathMatch) {
    const plural = directPathMatch[1]
    const config = RESOURCE_CONFIGS.find(c => c.plural === plural)

    if (config) {
      // For namespaced resources, check if namespace is in query string
      const namespace = req.query.namespace as string | undefined

      // Validate that cluster-scoped resources don't have namespace parameter
      if (!config.namespaced && namespace) {
        // Cluster-scoped resource should not have namespace
        return {
          name: config.name,
          plural: config.plural,
          namespaced: config.namespaced,
        }
      }

      return {
        name: config.name,
        plural: config.plural,
        namespaced: config.namespaced,
        namespace: config.namespaced ? namespace : undefined,
      }
    }
  }

  return undefined
}

/**
 * Middleware to add resource information to the request
 * This identifies what resource is being requested and adds it to req.resourceInfo
 */
export function resourceIdentifier(
  req: ResourceRequest,
  res: Response,
  next: NextFunction,
) {
  req.resourceInfo = identifyResource(req)

  // Debug logging
  if (req.resourceInfo) {
    logger.debug(`Path: ${req.path} -> Resource: ${req.resourceInfo.name}`)
  }

  next()
}

/**
 * Helper function to get resource info from a request
 */
export function getResourceInfo(
  req: ResourceRequest,
): ResourceRequest['resourceInfo'] {
  return req.resourceInfo
}
