/**
 * Context Middleware
 * Attaches Keystone context to Express requests for use in authentication and authorization
 */

import { Request, Response, NextFunction } from 'express'
import { KeystoneContext } from '@keystone-6/core/types'

type SessionDataType = any

declare module 'express' {
  export interface Request {
    context?: KeystoneContext
    session?: SessionDataType
  }
}

/**
 * Creates a middleware that attaches the Keystone context to each request
 * This allows authentication middleware to access session data
 */
export function createContextMiddleware(context: KeystoneContext) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Attach Keystone context to request
    req.context = context

    next()
  }
}
