/**
 * Health Monitoring & Auto-Recovery System
 * Monitors informer health and performs automatic reconnection
 */

export interface HealthCheckConfig {
  /** Health check interval in milliseconds */
  intervalMs: number
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Delay between retries in milliseconds */
  retryDelayMs: number
  /** Enable automatic reconnection */
  autoReconnect: boolean
}

export interface InformerHealth {
  resourceType: string
  isHealthy: boolean
  lastEventTime?: Date
  errorCount: number
  lastError?: Error
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  intervalMs: 30000, // 30 seconds
  maxRetries: 5,
  retryDelayMs: 5000, // 5 seconds
  autoReconnect: true,
}

export class HealthMonitor {
  private config: HealthCheckConfig
  private healthStatus: Map<string, InformerHealth> = new Map()
  private checkInterval?: NodeJS.Timeout
  private reconnectCallbacks: Map<string, () => Promise<void>> = new Map()

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Register a resource type for monitoring
   */
  registerResource(resourceType: string, reconnectFn: () => Promise<void>) {
    this.healthStatus.set(resourceType, {
      resourceType,
      isHealthy: true,
      lastEventTime: new Date(),
      errorCount: 0,
    })

    this.reconnectCallbacks.set(resourceType, reconnectFn)

    console.log(`✅ Registered health monitor for ${resourceType}`)
  }

  /**
   * Update health status when an event is received
   */
  recordEvent(resourceType: string) {
    const health = this.healthStatus.get(resourceType)
    if (health) {
      health.isHealthy = true
      health.lastEventTime = new Date()
      health.errorCount = 0
      health.lastError = undefined
    }
  }

  /**
   * Record an error for a resource type
   */
  recordError(resourceType: string, error: Error) {
    const health = this.healthStatus.get(resourceType)
    if (health) {
      health.errorCount++
      health.lastError = error

      // Mark as unhealthy after 3 consecutive errors
      if (health.errorCount >= 3) {
        health.isHealthy = false
        console.warn(
          `⚠️  ${resourceType} informer marked as unhealthy (${health.errorCount} errors)`,
        )
      }
    }
  }

  /**
   * Start health monitoring
   */
  start() {
    if (this.checkInterval) {
      console.warn('⚠️  Health monitor already running')
      return
    }

    console.log(
      `🏥 Starting health monitor (check every ${this.config.intervalMs}ms)`,
    )

    this.checkInterval = setInterval(() => {
      this.performHealthCheck()
    }, this.config.intervalMs)
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = undefined
      console.log('🏥 Health monitor stopped')
    }
  }

  /**
   * Perform health check on all registered resources
   */
  private async performHealthCheck() {
    const now = new Date()

    for (const [resourceType, health] of this.healthStatus) {
      const timeSinceLastEvent = health.lastEventTime
        ? now.getTime() - health.lastEventTime.getTime()
        : Infinity

      // Check if no events received in 2x interval
      if (timeSinceLastEvent > this.config.intervalMs * 2 && health.isHealthy) {
        console.warn(
          `⚠️  No events from ${resourceType} for ${Math.floor(
            timeSinceLastEvent / 1000,
          )}s`,
        )
        health.isHealthy = false
      }

      // Attempt reconnection if unhealthy and auto-reconnect enabled
      if (!health.isHealthy && this.config.autoReconnect) {
        if (health.errorCount < this.config.maxRetries) {
          console.log(
            `🔄 Attempting to reconnect ${resourceType} (attempt ${
              health.errorCount + 1
            }/${this.config.maxRetries})`,
          )

          const reconnectFn = this.reconnectCallbacks.get(resourceType)
          if (reconnectFn) {
            try {
              await reconnectFn()
              health.isHealthy = true
              health.errorCount = 0
              console.log(`✅ Successfully reconnected ${resourceType}`)
            } catch (error) {
              health.errorCount++
              health.lastError = error as Error
              console.error(`❌ Failed to reconnect ${resourceType}:`, error)
            }
          }
        } else {
          console.error(
            `💀 ${resourceType} max reconnection attempts reached. Giving up.`,
          )
        }
      }
    }
  }

  /**
   * Get health status for all resources
   */
  getHealthStatus(): InformerHealth[] {
    return Array.from(this.healthStatus.values())
  }

  /**
   * Get health status for a specific resource
   */
  getResourceHealth(resourceType: string): InformerHealth | undefined {
    return this.healthStatus.get(resourceType)
  }

  /**
   * Check if all resources are healthy
   */
  isAllHealthy(): boolean {
    return Array.from(this.healthStatus.values()).every(h => h.isHealthy)
  }
}

// Global health monitor instance
let globalHealthMonitor: HealthMonitor | null = null

/**
 * Initialize global health monitor
 */
export function initHealthMonitor(
  config?: Partial<HealthCheckConfig>,
): HealthMonitor {
  if (!globalHealthMonitor) {
    globalHealthMonitor = new HealthMonitor(config)
  }
  return globalHealthMonitor
}

/**
 * Get global health monitor instance
 */
export function getHealthMonitor(): HealthMonitor {
  if (!globalHealthMonitor) {
    throw new Error(
      'Health monitor not initialized. Call initHealthMonitor() first.',
    )
  }
  return globalHealthMonitor
}
