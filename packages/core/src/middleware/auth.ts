/**
 * Authentication Middleware for API Routes
 * Provides unified authentication using Keystone session
 */

import { Request, Response, NextFunction } from 'express'
import { KeystoneContext } from '@keystone-6/core/types'

// Extend Express Request type to include keystone context
type SessionDataType = any

declare module 'express' {
  export interface Request {
    context?: KeystoneContext
    session?: SessionDataType
  }
}

/**
 * Authentication middleware that checks if user is authenticated via Keystone session
 *
 * This middleware:
 * 1. Checks for a valid Keystone session
 * 2. Makes the Keystone context available to route handlers
 * 3. Returns 401 if not authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // The Keystone context is attached to the request by Keystone's session middleware
  const context = req.context as any

  // Check if user is authenticated
  if (!context || !context.session) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be logged in to access this resource',
    })
  }

  // Session exists, user is authenticated
  // Attach session data to request for use in route handlers
  req.session = context.session

  next()
}

/**
 * Optional authentication middleware
 * Attaches session data if available, but doesn't require it
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const context = req.context as any

  if (context && context.session) {
    req.session = context.session
  }

  next()
}

/**
 * Role-based authorization middleware factory
 *
 * Usage:
 *   requireRole(['admin', 'editor']) - requires one of the specified roles
 *   requireRole(['admin']) - requires admin role only
 *
 * Note: This requires a 'role' field on your User list
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = req.context as any

    // First check if authenticated
    if (!context || !context.session) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to access this resource',
      })
    }

    // Check if user has required role
    const userRole = context.session.data?.role
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `You need one of the following roles to access this resource: ${allowedRoles.join(', ')}`,
      })
    }

    next()
  }
}

/**
 * Admin-only middleware
 * Shortcut for requireRole(['admin'])
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole(['admin'])(req, res, next)
}

/**
 * API key authentication middleware (optional)
 * Allows authentication via Bearer token or API key in header
 *
 * Usage: Add X-API-Key header or Authorization: Bearer <token>
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  // First check for Keystone session
  const context = req.context as any
  if (context && context.session) {
    req.session = context.session
    return next()
  }

  // Check for API key in headers
  const apiKey =
    (Array.isArray(req.headers['x-api-key'])
      ? req.headers['x-api-key'][0]
      : req.headers['x-api-key']) ||
    (req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ') &&
      req.headers.authorization.substring(7))

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key or valid session required',
    })
  }

  // Validate API key (you should implement your own validation logic here)
  // This is a simple example - in production, you would check against a database
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || []

  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    })
  }

  // API key is valid
  next()
}
