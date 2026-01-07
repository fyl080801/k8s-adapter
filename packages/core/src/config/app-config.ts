/**
 * Application Configuration
 * Centralized configuration with environment variables and defaults
 */
import { LogLevel, createLogger } from '../lib/logger'

const logger = createLogger('AppConfig')

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number
  /** Initial delay in milliseconds */
  initialDelayMs: number
  /** Maximum delay in milliseconds */
  maxDelayMs: number
  /** Exponential backoff multiplier */
  backoffMultiplier: number
}

export interface TimeoutConfig {
  /** MongoDB connection timeout in milliseconds */
  mongodbConnection: number
  /** MongoDB socket timeout in milliseconds */
  mongodbSocket: number
  /** MongoDB server selection timeout in milliseconds */
  mongodbServerSelection: number
  /** K8s API request timeout in milliseconds */
  k8sRequest: number
  /** K8s watch connection timeout in milliseconds */
  k8sWatch: number
  /** Extended timeout for large resources (Secret, ConfigMap, etc.) */
  k8sLargeResourceRequest: number
}

export interface BulkWriteConfig {
  /** Number of documents per bulk write batch */
  batchSize: number
  /** Maximum number of concurrent bulk writes */
  maxConcurrent: number
  /** Delay between batches in milliseconds */
  batchDelayMs: number
}

export interface SyncConcurrencyConfig {
  /** Maximum number of resources to sync concurrently */
  maxConcurrentResources: number
  /** Whether to enable concurrent sync (false = sequential) */
  enableConcurrentSync: boolean
}

export class AppConfig {
  // Retry Configuration
  static readonly RETRY: RetryConfig = {
    maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '5', 10),
    initialDelayMs: parseInt(process.env.RETRY_INITIAL_DELAY_MS || '1000', 10),
    maxDelayMs: parseInt(process.env.RETRY_MAX_DELAY_MS || '30000', 10),
    backoffMultiplier: parseFloat(
      process.env.RETRY_BACKOFF_MULTIPLIER || '2.0',
    ),
  }

  // Timeout Configuration
  static readonly TIMEOUT: TimeoutConfig = {
    mongodbConnection: parseInt(process.env.MONGODB_TIMEOUT_MS || '30000', 10),
    mongodbSocket: parseInt(
      process.env.MONGODB_SOCKET_TIMEOUT_MS || '45000',
      10,
    ),
    mongodbServerSelection: parseInt(
      process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '30000',
      10,
    ),
    k8sRequest: parseInt(process.env.K8S_REQUEST_TIMEOUT_MS || '30000', 10),
    k8sWatch: parseInt(process.env.K8S_WATCH_TIMEOUT_MS || '60000', 10),
    k8sLargeResourceRequest: parseInt(
      process.env.K8S_LARGE_RESOURCE_TIMEOUT_MS || '120000',
      10,
    ),
  }

  // Bulk Write Configuration
  static readonly BULK_WRITE: BulkWriteConfig = {
    batchSize: parseInt(process.env.BULK_WRITE_BATCH_SIZE || '100', 10),
    maxConcurrent: parseInt(process.env.BULK_WRITE_MAX_CONCURRENT || '3', 10),
    batchDelayMs: parseInt(process.env.BULK_WRITE_BATCH_DELAY_MS || '100', 10),
  }

  // Sync Concurrency Configuration
  static readonly SYNC_CONCURRENCY: SyncConcurrencyConfig = {
    maxConcurrentResources: parseInt(
      process.env.SYNC_MAX_CONCURRENT_RESOURCES || '3',
      10,
    ),
    enableConcurrentSync: process.env.ENABLE_CONCURRENT_SYNC !== 'false',
  }

  // MongoDB Connection Pool Configuration
  static readonly MONGO_POOL = {
    minPoolSize: parseInt(process.env.MONGO_POOL_MIN || '10', 10),
    maxPoolSize: parseInt(process.env.MONGO_POOL_MAX || '50', 10),
    maxIdleTimeMs: parseInt(
      process.env.MONGO_POOL_MAX_IDLE_TIME_MS || '60000',
      10,
    ),
    waitQueueTimeoutMs: parseInt(
      process.env.MONGO_POOL_WAIT_QUEUE_TIMEOUT_MS || '60000',
      10,
    ),
  }

  // Feature Flags
  static readonly FEATURES = {
    /** Enable automatic reconnection for K8s watches */
    ENABLE_K8S_WATCH_RECONNECT:
      process.env.ENABLE_K8S_WATCH_RECONNECT !== 'false',
    /** Enable automatic reconnection for MongoDB */
    ENABLE_MONGO_RECONNECT: process.env.ENABLE_MONGO_RECONNECT !== 'false',
    /** Enable chunked bulk writes */
    ENABLE_CHUNKED_BULK_WRITE:
      process.env.ENABLE_CHUNKED_BULK_WRITE !== 'false',
    /** Enable colored console output */
    ENABLE_LOG_COLORS: process.env.ENABLE_LOG_COLORS !== 'false',
    /** Enable timestamps in logs */
    ENABLE_LOG_TIMESTAMPS: process.env.ENABLE_LOG_TIMESTAMPS !== 'false',
  }

  // Logging Configuration
  static readonly LOGGING = {
    /** Log level: 0=DEBUG, 1=INFO, 2=WARN, 3=ERROR */
    LEVEL: parseInt(
      process.env.LOG_LEVEL ||
        (process.env.NODE_ENV === 'production' ? '1' : '0'),
      10,
    ) as LogLevel,
    /** Enable colored console output */
    ENABLE_COLORS: this.FEATURES.ENABLE_LOG_COLORS,
    /** Enable timestamps in logs */
    ENABLE_TIMESTAMPS: this.FEATURES.ENABLE_LOG_TIMESTAMPS,
    /** Enable file logging with daily rotation */
    ENABLE_FILE_LOGGING: process.env.ENABLE_FILE_LOGGING === 'true',
    /** Directory for log files (default: ./logs) */
    LOG_DIR: process.env.LOG_DIR || './logs',
  }

  // Hybrid Sync Configuration
  static readonly HYBRID_SYNC = {
    /** Sync strategy on startup: 'auto', 'always', 'never' */
    SYNC_ON_STARTUP: (process.env.SYNC_ON_STARTUP || 'auto') as
      | 'auto'
      | 'always'
      | 'never',
    /** Automatically trigger full sync when informer fails */
    AUTO_SYNC_ON_INFORMER_FAILURE:
      process.env.AUTO_SYNC_ON_INFORMER_FAILURE !== 'false',
    /** Periodic sync interval in hours (0 = disabled) */
    PERIODIC_SYNC_INTERVAL_HOURS: parseInt(
      process.env.PERIODIC_SYNC_INTERVAL_HOURS || '0',
      10,
    ),
    /** Data staleness threshold in seconds */
    DATA_STALE_THRESHOLD_SECONDS: parseInt(
      process.env.DATA_STALE_THRESHOLD_SECONDS || '86400',
      10,
    ),
  }

  /**
   * Calculate delay with exponential backoff
   */
  static calculateBackoff(attempt: number): number {
    const delay = Math.min(
      this.RETRY.initialDelayMs *
        Math.pow(this.RETRY.backoffMultiplier, attempt),
      this.RETRY.maxDelayMs,
    )
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1)
    return Math.max(0, delay + jitter)
  }

  /**
   * Sleep for specified milliseconds
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Process items with limited concurrency
   * @param items - Array of items to process
   * @param handler - Async function to process each item
   * @param concurrency - Maximum number of concurrent operations
   * @returns Array of results
   */
  static async processWithConcurrency<T, R>(
    items: T[],
    handler: (item: T) => Promise<R>,
    concurrency: number,
  ): Promise<R[]> {
    // If concurrency is 1, process sequentially
    if (concurrency <= 1) {
      const results: R[] = []
      for (const item of items) {
        results.push(await handler(item))
      }
      return results
    }

    const results: R[] = new Array(items.length)
    let index = 0

    // Process items with limited concurrency
    const processNext = async (): Promise<void> => {
      while (index < items.length) {
        const currentIndex = index++
        const item = items[currentIndex]

        results[currentIndex] = await handler(item)
      }
    }

    // Start concurrent workers
    const workers: Promise<void>[] = []
    for (let i = 0; i < Math.min(concurrency, items.length); i++) {
      workers.push(processNext())
    }

    // Wait for all workers to complete
    await Promise.all(workers)
    return results
  }

  /**
   * Retry a function with exponential backoff
   */
  static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    context: string,
    options?: { isFatal?: (error: any) => boolean },
  ): Promise<T> {
    let lastError: any

    for (let attempt = 0; attempt < this.RETRY.maxAttempts; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error

        // Check if error is fatal (should not retry)
        if (options?.isFatal?.(error)) {
          logger.error(`${context} - Fatal error, aborting retries`, error)
          throw error
        }

        if (attempt < this.RETRY.maxAttempts - 1) {
          const delay = this.calculateBackoff(attempt)
          logger.warn(
            `${context} - Attempt ${attempt + 1}/${this.RETRY.maxAttempts} failed, retrying in ${Math.round(delay)}ms`,
            error,
          )
          await this.sleep(delay)
        }
      }
    }

    logger.error(
      `${context} failed after ${this.RETRY.maxAttempts} attempts`,
      lastError,
    )
    throw lastError
  }
}
