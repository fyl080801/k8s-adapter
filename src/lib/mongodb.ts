import mongoose from 'mongoose'
import { AppConfig } from '../config/app-config'

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/k8s-resources'

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable')
}

let isConnected = false
let reconnectTimer: NodeJS.Timeout | null = null

/**
 * Connect to MongoDB with retry logic and proper configuration
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose
  }

  // Connection options with timeouts and pool settings
  const opts = {
    bufferCommands: false,
    maxPoolSize: AppConfig.MONGO_POOL.maxPoolSize,
    minPoolSize: AppConfig.MONGO_POOL.minPoolSize,
    maxIdleTimeMS: AppConfig.MONGO_POOL.maxIdleTimeMs,
    waitQueueTimeoutMS: AppConfig.MONGO_POOL.waitQueueTimeoutMs,
    socketTimeoutMS: AppConfig.TIMEOUT.mongodbSocket,
    serverSelectionTimeoutMS: AppConfig.TIMEOUT.mongodbServerSelection,
    connectTimeoutMS: AppConfig.TIMEOUT.mongodbConnection,
    // Retry settings
    retryWrites: true,
    retryReads: true,
  }

  try {
    await AppConfig.retryWithBackoff(
      async () => {
        await mongoose.connect(MONGODB_URI, opts)
      },
      'MongoDB connection',
      {
        isFatal: (error: any) => {
          // Don't retry on authentication errors
          return error?.name === 'MongoServerError' && error?.code === 18
        },
      },
    )

    isConnected = true
    console.log('✅ Connected to MongoDB')

    // Setup connection event handlers
    setupConnectionHandlers()

    return mongoose
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error)
    throw error
  }
}

/**
 * Setup MongoDB connection event handlers for automatic reconnection
 */
function setupConnectionHandlers() {
  if (!AppConfig.FEATURES.ENABLE_MONGO_RECONNECT) {
    return
  }

  // Remove existing listeners to avoid duplicates
  mongoose.connection.removeAllListeners('disconnected')
  mongoose.connection.removeAllListeners('error')
  mongoose.connection.removeAllListeners('connected')
  mongoose.connection.removeAllListeners('reconnected')

  mongoose.connection.on('disconnected', event => {
    isConnected = false
    console.warn('⚠️  MongoDB disconnected:', event)

    // Schedule reconnection attempt
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        console.log('🔄 Attempting to reconnect to MongoDB...')
        connectDB().catch(err => {
          console.error('❌ MongoDB reconnection failed:', err)
        })
        reconnectTimer = null
      }, AppConfig.RETRY.initialDelayMs)
    }
  })

  mongoose.connection.on('error', error => {
    console.error('❌ MongoDB connection error:', error)
  })

  mongoose.connection.on('connected', () => {
    isConnected = true
    console.log('✅ MongoDB connected')
  })

  mongoose.connection.on('reconnected', () => {
    isConnected = true
    console.log('✅ MongoDB reconnected')
  })
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectDB() {
  // Clear any pending reconnection timers
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  isConnected = false
  await mongoose.disconnect()
  console.log('✅ MongoDB disconnected')
}

/**
 * Check if MongoDB is connected
 */
export function isMongoConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1
}

/**
 * Get connection health status
 */
export function getMongoHealth() {
  return {
    connected: isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    dbName: mongoose.connection.name,
  }
}
