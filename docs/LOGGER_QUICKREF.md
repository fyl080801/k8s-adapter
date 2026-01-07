# Logger Quick Reference

## Quick Start

```typescript
import { createLogger } from './lib/logger'

const logger = createLogger('MyModule')

logger.info('Message')
logger.warn('Warning')
logger.error('Error', err)
logger.success('Success!')
logger.debug('Debug info')
```

## Import Options

```typescript
// Use default logger
import { logger } from './lib/logger'

// Create named logger
import { createLogger } from './lib/logger'
const logger = createLogger('ModuleName')
```

## Log Methods

| Method             | Level | Usage                 |
| ------------------ | ----- | --------------------- |
| `logger.debug()`   | 0     | Detailed diagnostics  |
| `logger.info()`    | 1     | General information   |
| `logger.warn()`    | 2     | Warning messages      |
| `logger.error()`   | 3     | Error messages        |
| `logger.success()` | 1     | Success messages (✅) |
| `logger.section()` | -     | Section headers       |

## Environment Variables

```bash
# Log level (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR)
LOG_LEVEL=1

# Enable colors (default: true)
ENABLE_LOG_COLORS=true

# Enable timestamps (default: true)
ENABLE_LOG_TIMESTAMPS=true
```

## Configuration

```typescript
import { LogLevel } from './lib/logger'

logger.configure({
  level: LogLevel.INFO,
  enableColors: true,
  enableTimestamps: true,
  prefix: 'MyApp',
})

// Change level at runtime
logger.setLevel(LogLevel.ERROR)

// Get current level
const currentLevel = logger.getLevel()
```

## Child Loggers

```typescript
const parent = createLogger('App')
const child = parent.child('Database')
const grandchild = child.child('Connection')

parent.info('Starting') // [App] Starting
child.info('Connecting') // [App:Database] Connecting
grandchild.info('Connected') // [App:Database:Connection] Connected
```

## Common Patterns

### Error Handling

```typescript
try {
  await riskyOperation()
} catch (error) {
  logger.error('Operation failed', error)
}
```

### With Context

```typescript
logger.info('User logged in', { userId: '123', role: 'admin' })
logger.warn('High memory usage', { used: '85%', available: '15%' })
```

### Conditional Logging

```typescript
if (logger.getLevel() <= LogLevel.DEBUG) {
  logger.debug('Expensive operation result', complexObject)
}
```

### Section Headers

```typescript
logger.section('Data Sync Process')
logger.info('Step 1: Fetch data')
logger.info('Step 2: Transform')
logger.success('Step 3: Save to database')
```

## Output Examples

### Info

```
[2025-01-07T10:30:45.123Z] [ℹ️ INFO] [Database] Connected to MongoDB
```

### Warning

```
[2025-01-07T10:30:45.456Z] [⚠️ WARN] [API] Rate limit approaching
```

### Error

```
[2025-01-07T10:30:46.789Z] [❌ ERROR] [Kubernetes] Connection failed: Error: timeout
```

### Success

```
[2025-01-07T10:30:47.012Z] [✅ SUCCESS] [Sync] Synced 150 resources
```

### Section

```

════════════════════════════════════════════════════════════
  Data Sync Process
════════════════════════════════════════════════════════════

```

## Best Practices

✅ DO:

- Use descriptive messages
- Include context (IDs, names, counts)
- Use appropriate log levels
- Create named loggers for modules
- Log errors with error objects

❌ DON'T:

- Log sensitive data (passwords, tokens)
- Use vague messages like "error occurred"
- Log at INFO level in tight loops
- Include large objects in logs
- Log every function call

## Module Examples

```typescript
// API Routes
const logger = createLogger('API')
logger.info('GET /api/v1/pods', { namespace, limit })

// Kubernetes
const logger = createLogger('K8s')
logger.info('Watching pods', { namespace: 'default' })

// MongoDB
const logger = createLogger('MongoDB')
logger.info('Connection pool stats', { size: 10, active: 3 })

// Sync Manager
const logger = createLogger('Sync')
logger.section('Full Sync Started')
logger.success(`Synced ${count} resources`)
```

## Color Reference

| Level   | Color      | Emoji |
| ------- | ---------- | ----- |
| DEBUG   | Gray (dim) | 🔍    |
| INFO    | Blue       | ℹ️    |
| WARN    | Yellow     | ⚠️    |
| ERROR   | Red        | ❌    |
| SUCCESS | Green      | ✅    |
