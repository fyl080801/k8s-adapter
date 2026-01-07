# Logger Usage Guide

The core package now includes a centralized logging utility powered by **Winston**, with colored console output by default and optional file logging with daily rotation.

## Features

- **Configurable log levels**: DEBUG, INFO, WARN, ERROR
- **Colored console output**: Easy-to-read, color-coded messages
- **Timestamps**: ISO timestamps for all messages
- **Contextual prefixes**: Create named loggers for better organization
- **Child loggers**: Create hierarchical loggers with prefixes
- **File logging**: Optional daily rotating log files
- **Production-ready**: Built on industry-standard Winston library

## Basic Usage

### Import the Logger

```typescript
// Use the default logger
import { logger } from './lib/logger'

// Create a named logger instance
import { createLogger } from './lib/logger'
const logger = createLogger('MyModule')
```

### Log Methods

```typescript
logger.debug('Detailed debugging information')
logger.info('General informational message')
logger.warn('Warning message')
logger.error('Error occurred', errorObject)

// Special success method with checkmark
logger.success('Operation completed successfully')

// Section headers for grouping logs
logger.section('Starting Data Sync Process')
```

### Log Levels

Set log level via environment variable:

```bash
# Development - show all logs including debug
LOG_LEVEL=debug

# Production - only info, warnings, and errors
LOG_LEVEL=info

# Minimal - only warnings and errors
LOG_LEVEL=warn

# Critical - only errors
LOG_LEVEL=error
```

## Configuration

### Environment Variables

```bash
# Log level (debug, info, warn, error)
LOG_LEVEL=info

# Enable colored output (default: true)
ENABLE_LOG_COLORS=true

# Enable timestamps (default: true)
ENABLE_LOG_TIMESTAMPS=true

# Enable file logging (default: false)
ENABLE_FILE_LOGGING=true

# Directory for log files (default: ./logs)
LOG_DIR=./logs
```

### Programmatic Configuration

```typescript
import { logger, LogLevel } from './lib/logger'

logger.configure({
  level: LogLevel.INFO,
  enableTimestamps: true,
  enableColors: true,
  enableFileLogging: true,
  logDir: './logs',
  prefix: 'MyApp',
})
```

## File Logging

When enabled, the logger creates two types of log files:

1. **Combined log** (`combined-YYYY-MM-DD.log`): Contains all log levels (debug and above)
2. **Error log** (`error-YYYY-MM-DD.log`): Contains only error-level messages

### File Rotation

- Files are created daily (date pattern: `YYYY-MM-DD`)
- Maximum file size: 20MB per file
- Combined logs retained for 14 days
- Error logs retained for 30 days

### Example File Output

```json
{
  "level": "info",
  "message": "MongoDB connected successfully",
  "label": "MongoDB",
  "timestamp": "2025-01-07T10:30:45.456Z"
}
```

## Examples

### With Error Objects

```typescript
try {
  await connectDB()
} catch (error) {
  logger.error('Database connection failed', error)
}
```

### With Additional Metadata

```typescript
logger.info('Processing items', { count: 150, namespace: 'default' })
logger.warn('High memory usage', { used: '85%', available: '15%' })
```

### Child Loggers

```typescript
const apiLogger = createLogger('API')
const k8sLogger = apiLogger.child('Kubernetes')

// Logs as: [API:Kubernetes] Message
k8sLogger.info('Connected to cluster')
```

## Output Format

### Console Output (with colors)

```
2025-01-07T10:30:45.123Z [ℹ️ INFO ] [MongoDB] Connecting to MongoDB
2025-01-07T10:30:45.456Z [✅ INFO ] [MongoDB] Connected successfully
2025-01-07T10:30:46.789Z [⚠️ WARN ] [K8sInit] Retrying connection
2025-01-07T10:30:47.012Z [❌ ERROR] [AppConfig] Fatal error, aborting retries
```

### Console Output (without colors)

```
2025-01-07T10:30:45.123Z [ℹ️ INFO ] [MongoDB] Connecting to MongoDB
2025-01-07T10:30:45.456Z [ℹ️ INFO ] [MongoDB] Connected successfully
```

### File Output (JSON format)

```json
{"level":"info","message":"Connecting to MongoDB","label":"MongoDB","timestamp":"2025-01-07T10:30:45.123Z"}
{"level":"info","message":"Connected successfully","label":"MongoDB","timestamp":"2025-01-07T10:30:45.456Z"}
{"level":"warn","message":"Retrying connection","label":"K8sInit","timestamp":"2025-01-07T10:30:46.789Z"}
```

## Best Practices

1. **Use descriptive log messages**

   ```typescript
   // Good
   logger.info('Successfully synced 150 pods from cluster')

   // Bad
   logger.info('done')
   ```

2. **Use appropriate log levels**
   - DEBUG: Detailed diagnostics for troubleshooting
   - INFO: Normal operation information
   - WARN: Unexpected but recoverable issues
   - ERROR: Errors that affect functionality

3. **Include context in messages**

   ```typescript
   logger.error(`Failed to process pod ${namespace}/${name}`, error)
   ```

4. **Use child loggers for modules**

   ```typescript
   const logger = createLogger('ModuleName')
   ```

5. **Don't log sensitive data**
   - Avoid logging passwords, tokens, or secrets
   - Sanitize data before logging if necessary

6. **Use metadata for structured data**
   ```typescript
   logger.info('User action', {
     userId: '123',
     action: 'create',
     resource: 'pod',
   })
   ```

## Integration in Existing Code

The logger has been integrated into:

- `keystone.ts` - Application initialization
- `src/lib/mongodb.ts` - MongoDB connection management
- `src/config/app-config.ts` - Retry logic
- `src/k8s/hybrid-init.ts` - Kubernetes Informer initialization

All `console.log`, `console.error`, and `console.warn` calls have been replaced with the appropriate logger methods.

## Advanced Features

### Winston Transports

The logger uses Winston's transport system:

- **Console transport**: Outputs to console with custom formatting
- **File transport**: Writes to rotating log files (when enabled)

### Error Handling

The logger automatically captures and formats Error objects:

```typescript
try {
  throw new Error('Something went wrong')
} catch (error) {
  // Automatically includes message and stack trace
  logger.error('Operation failed', error)
}
```

Output:

```
2025-01-07T10:30:45.123Z [❌ ERROR] [MyModule] Operation failed {"message":"Something went wrong","stack":"Error: Something went wrong\n    at ..."}
```

### Performance Considerations

- Winston is asynchronous and non-blocking
- File operations are buffered for performance
- Log rotation prevents disk space issues
- Consider log level in production (INFO recommended)

## Troubleshooting

**Logs not appearing?**

- Check `LOG_LEVEL` environment variable
- Verify logger configuration in `keystone.ts`

**File logging not working?**

- Ensure `ENABLE_FILE_LOGGING=true` is set
- Check write permissions for log directory
- Verify `LOG_DIR` path exists or can be created

**Too much output?**

- Increase log level to `warn` or `error`
- Disable debug logs in production

**Colors not showing?**

- Check `ENABLE_LOG_COLORS=true`
- Some CI/CD environments may not support colors
- Winston automatically disables colors for non-TTY streams

## Migration from console.log

### Before

```typescript
console.log('Starting connection...')
console.error('Connection failed', err)
console.warn('High memory usage')
```

### After

```typescript
logger.info('Starting connection...')
logger.error('Connection failed', err)
logger.warn('High memory usage')
```

## Winston Documentation

For more advanced Winston features, see:

- [Winston GitHub](https://github.com/winstonjs/winston)
- [Winston Transports](https://github.com/winstonjs/winston/blob/master/docs/transports.md)
- [Winston Log Formats](https://github.com/winstonjs/winston/blob/master/docs/formats.md)
