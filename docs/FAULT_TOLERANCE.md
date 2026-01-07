# Fault Tolerance & Reconnection Implementation

This document describes the fault tolerance and reconnection mechanisms implemented to handle network issues, timeouts, and connection failures.

## Overview

The system now includes comprehensive error handling and automatic recovery mechanisms for:

- **MongoDB Connection** - Automatic reconnection with retry logic
- **Kubernetes Watches** - Automatic watch reconnection on failure
- **Bulk Operations** - Chunked writes to prevent EPIPE errors
- **General Operations** - Exponential backoff retry logic

## Architecture

### 1. Configuration System ([src/config/app-config.ts](../src/config/app-config.ts))

Centralized configuration with environment variable support:

#### Retry Configuration

```typescript
RETRY_MAX_ATTEMPTS = 5 // Max retry attempts
RETRY_INITIAL_DELAY_MS = 1000 // Initial delay (1s)
RETRY_MAX_DELAY_MS = 30000 // Max delay (30s)
RETRY_BACKOFF_MULTIPLIER = 2.0 // Exponential backoff (2x)
```

#### Timeout Configuration

```typescript
MONGODB_TIMEOUT_MS = 30000 // Connection timeout (30s)
MONGODB_SOCKET_TIMEOUT_MS = 45000 // Socket timeout (45s)
MONGODB_SERVER_SELECTION_TIMEOUT_MS = 30000 // Server selection (30s)
K8S_REQUEST_TIMEOUT_MS = 30000 // K8s API timeout (30s)
K8S_WATCH_TIMEOUT_MS = 60000 // K8s watch timeout (60s)
```

#### Bulk Write Configuration

```typescript
BULK_WRITE_BATCH_SIZE = 100 // Documents per batch
BULK_WRITE_MAX_CONCURRENT = 3 // Concurrent bulk writes
BULK_WRITE_BATCH_DELAY_MS = 100 // Delay between batches (0.1s)
```

#### Feature Flags

```typescript
ENABLE_K8S_WATCH_RECONNECT = true // K8s watch auto-reconnect
ENABLE_MONGO_RECONNECT = true // MongoDB auto-reconnect
ENABLE_CHUNKED_BULK_WRITE = true // Use chunked bulk writes
```

### 2. MongoDB Fault Tolerance ([src/lib/mongodb.ts](../src/lib/mongodb.ts))

#### Features

- ✅ **Retry Logic**: Connection attempts with exponential backoff
- ✅ **Automatic Reconnection**: Listens for disconnection events
- ✅ **Connection Pool**: Configurable pool size (2-10 connections)
- ✅ **Timeouts**: Socket, connection, and server selection timeouts
- ✅ **Health Monitoring**: Connection state tracking

#### Connection Options

```typescript
{
  maxPoolSize: 10,                    // Pool configuration
  minPoolSize: 2,
  socketTimeoutMS: 45000,             // Timeouts
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  retryWrites: true,                  // Automatic retries
  retryReads: true,
}
```

#### Error Handling

- **Fatal Errors**: Authentication errors (code 18) don't retry
- **Network Errors**: Timeout, EPIPE, ECONNRESET - automatic retry
- **Disconnection**: Automatic reconnection after 1s delay

### 3. Kubernetes Watch Reconnection ([src/k8s/generic-informer.ts](../src/k8s/generic-informer.ts))

#### Features

- ✅ **Automatic Reconnection**: Watches restart on failure
- ✅ **Exponential Backoff**: Delay increases with each retry (1s, 2s, 4s, 8s, 16s)
- ✅ **Resource Version Tracking**: Resume from last known state
- ✅ **Max Attempts**: Stops after 5 failed reconnection attempts
- ✅ **Graceful Shutdown**: No reconnection during shutdown

#### Reconnection Logic

```typescript
Error Detected
  ↓
Calculate Backoff (1s * 2^attempt)
  ↓
Wait for Delay
  ↓
Restart Watch with resourceVersion
  ↓
Success → Reset Attempts
Failure → Retry Next Attempt
```

#### Watch Errors Recovered

- `socket hang up` - Connection reset
- `ECONNRESET` - Connection reset by peer
- `ETIMEDOUT` - Network timeout
- `HTTP 502/503/504` - Server errors

### 4. Chunked Bulk Writes ([src/k8s/generic-sync.ts](../src/k8s/generic-sync.ts))

#### Features

- ✅ **Batch Processing**: Splits large bulk writes into chunks (100 docs)
- ✅ **Retry on Failure**: Individual chunk retry on error
- ✅ **Progress Tracking**: Shows chunk progress during sync
- ✅ **Delay Between Batches**: Prevents overwhelming MongoDB

#### Chunk Processing

```typescript
Items: 1000 documents
  ↓
Split into 10 chunks (100 each)
  ↓
Process sequentially:
  Chunk 1: ✅ (100/1000)
  Chunk 2: ❌ EPIPE → Retry → ✅ (200/1000)
  Chunk 3: ✅ (300/1000)
  ...
```

#### Errors Recovered

- `EPIPE` - Broken pipe (large writes)
- `ETIMEDOUT` - Socket timeout
- `ECONNRESET` - Connection reset
- `MongoNetworkTimeoutError` - Network timeout

### 5. Generic Retry Logic

The `AppConfig.retryWithBackoff()` method provides retry logic for any operation:

```typescript
await AppConfig.retryWithBackoff(() => doSomething(), 'Operation Name', {
  isFatal: error => {
    // Don't retry on authentication errors
    return error?.code === 401
  },
})
```

#### Retry Pattern

```
Attempt 1: Fail → Wait 1s
Attempt 2: Fail → Wait 2s (with jitter)
Attempt 3: Fail → Wait 4s (with jitter)
Attempt 4: Fail → Wait 8s (with jitter)
Attempt 5: Fail → Throw error
```

## Usage Examples

### Basic Usage (Using Defaults)

No configuration needed - the system uses sensible defaults:

```bash
# All features enabled by default
npm run dev
```

### Custom Configuration

Create `.env` file with custom values:

```bash
# For unstable networks
RETRY_MAX_ATTEMPTS=10
RETRY_INITIAL_DELAY_MS=2000

# For slow MongoDB
BULK_WRITE_BATCH_SIZE=50
BULK_WRITE_BATCH_DELAY_MS=500

# For production
MONGO_POOL_MAX=20
MONGODB_SOCKET_TIMEOUT_MS=60000
```

### Disable Features

If you need to disable automatic reconnection:

```bash
# Disable K8s watch reconnection
ENABLE_K8S_WATCH_RECONNECT=false

# Disable chunked bulk writes
ENABLE_CHUNKED_BULK_WRITE=false
```

## Monitoring & Debugging

### Startup Logs

```
⚙️  Application Configuration:
   Retry: { maxAttempts: 5, initialDelayMs: 1000, maxDelayMs: 30000 }
   Timeouts: { mongodb: '30000ms', k8sRequest: '30000ms', k8sWatch: '60000ms' }
   Bulk Write: { batchSize: 100, maxConcurrent: 3 }
   Features: { k8sWatchReconnect: true, mongoReconnect: true, chunkedBulkWrite: true }
```

### Reconnection Logs

```
❌ Error in Pod informer: socket hang up
🔄 Pod informer: Reconnecting in 1000ms (attempt 1/5)...
🔄 Pod informer: Reconnecting...
✅ Pod informer: Reconnected successfully
```

### Chunked Write Logs

```
📦 Using chunked bulk writes (batch size: 100)
   ✅ Chunk 1/10 processed (100/1000 operations)
   ✅ Chunk 2/10 processed (200/1000 operations)
   ❌ Failed to write chunk 3/10 for Secret:
      Error: write EPIPE
      Chunk size: 100, Processed: 200/1000
   🔄 Retrying chunk 3 after error...
   ✅ Chunk 3 retry succeeded
```

## Troubleshooting

### Issue: Frequent MongoDB Timeouts

**Solution**: Increase timeouts and reduce batch size

```bash
MONGODB_SOCKET_TIMEOUT_MS=60000
MONGODB_SERVER_SELECTION_TIMEOUT_MS=60000
BULK_WRITE_BATCH_SIZE=50
```

### Issue: K8s Watch Keeps Disconnecting

**Solution**: Increase watch timeout and retry attempts

```bash
K8S_WATCH_TIMEOUT_MS=120000
RETRY_MAX_ATTEMPTS=10
RETRY_INITIAL_DELAY_MS=2000
```

### Issue: EPIPE Errors During Sync

**Solution**: Reduce batch size and increase delay

```bash
BULK_WRITE_BATCH_SIZE=50
BULK_WRITE_BATCH_DELAY_MS=500
BULK_WRITE_MAX_CONCURRENT=2
```

### Issue: MongoDB Connection Pool Exhausted

**Solution**: Increase pool size

```bash
MONGO_POOL_MAX=20
MONGO_POOL_MIN=5
```

## Performance Impact

### Benefits

- ✅ **Resilience**: System recovers automatically from network issues
- ✅ **Reliability**: No data loss from temporary disconnections
- ✅ **Monitoring**: Detailed logs for debugging

### Trade-offs

- ⚠️ **Memory**: Reconnection state tracking (minimal)
- ⚠️ **Network**: Retry attempts generate additional traffic
- ⚠️ **Latency**: Failed operations add retry delays

### Best Practices

1. **Start with defaults**: Default values work for most scenarios
2. **Monitor logs**: Watch for retry patterns and adjust accordingly
3. **Tune gradually**: Change one variable at a time
4. **Test failures**: Simulate network issues to verify recovery

## API Reference

### AppConfig

```typescript
// Retry with backoff
AppConfig.retryWithBackoff<T>(
  fn: () => Promise<T>,
  context: string,
  options?: { isFatal?: (error: any) => boolean }
): Promise<T>

// Calculate backoff delay
AppConfig.calculateBackoff(attempt: number): number

// Sleep utility
AppConfig.sleep(ms: number): Promise<void>

// Log configuration
AppConfig.logConfig(): void
```

### MongoDB

```typescript
// Connect with retry
connectDB(): Promise<mongoose>

// Check connection
isMongoConnected(): boolean

// Health status
getMongoHealth(): {
  connected: boolean
  readyState: number
  host: string
  port: number
  dbName: string
}

// Disconnect
disconnectDB(): Promise<void>
```

## Future Enhancements

Potential improvements for future versions:

1. **Circuit Breaker**: Temporarily stop retrying after consecutive failures
2. **Metrics**: Export retry counts and failure rates to monitoring systems
3. **Dynamic Configuration**: Adjust timeouts based on observed performance
4. **Dead Letter Queue**: Store failed events for later processing
5. **Health Endpoints**: HTTP endpoints for connection health checks
