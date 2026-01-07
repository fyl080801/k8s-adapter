# Winston Logger Implementation Summary

## 概述

已成功将日志系统从自定义实现迁移到 **Winston** - 业界标准的 Node.js 日志库。

## 主要变更

### 1. 新增依赖

在 `package.json` 中添加：

```json
{
  "dependencies": {
    "winston": "^3.17.0",
    "winston-daily-rotate-file": "^5.0.0"
  },
  "devDependencies": {
    "@types/winston": "^2.4.4"
  }
}
```

### 2. 核心功能

**Winston Logger 实现** ([src/lib/logger.ts](src/lib/logger.ts))

- ✅ 控制台输出（带颜色和 emoji）
- ✅ 文件日志（可选，按日轮转）
- ✅ 多级日志（DEBUG, INFO, WARN, ERROR）
- ✅ 命名日志器（createLogger）
- ✅ 子日志器（logger.child）
- ✅ 自动错误捕获和格式化
- ✅ JSON 格式文件输出

### 3. 文件日志功能

当启用时，创建两个日志文件：

- `combined-YYYY-MM-DD.log` - 所有级别的日志
- `error-YYYY-MM-DD.log` - 仅错误日志

**配置：**

- 最大文件大小：20MB
- 保留时间：combined 14天，error 30天
- 按日轮转

### 4. 新增环境变量

```bash
# 日志级别 (debug, info, warn, error)
LOG_LEVEL=info

# 启用文件日志 (默认: false)
ENABLE_FILE_LOGGING=true

# 日志目录 (默认: ./logs)
LOG_DIR=./logs

# 启用彩色输出 (默认: true)
ENABLE_LOG_COLORS=true

# 启用时间戳 (默认: true)
ENABLE_LOG_TIMESTAMPS=true
```

## 使用示例

### 基本用法

```typescript
import { createLogger } from './lib/logger'

const logger = createLogger('MyModule')

logger.info('Application started')
logger.warn('High memory usage', { used: '85%' })
logger.error('Connection failed', error)
logger.success('Operation completed')
```

### 启用文件日志

```bash
# .env
ENABLE_FILE_LOGGING=true
LOG_DIR=./logs
```

日志文件将自动创建在 `./logs` 目录中。

### 子日志器

```typescript
const apiLogger = createLogger('API')
const k8sLogger = apiLogger.child('Kubernetes')

// 输出: [API:Kubernetes] Connected to cluster
k8sLogger.info('Connected to cluster')
```

## 输出格式

### 控制台（带颜色）

```
2025-01-07T10:30:45.123Z [ℹ️ INFO ] [MongoDB] Connecting to MongoDB
2025-01-07T10:30:45.456Z [✅ INFO ] [MongoDB] Connected successfully
2025-01-07T10:30:46.789Z [⚠️ WARN ] [K8sInit] Retrying connection
2025-01-07T10:30:47.012Z [❌ ERROR] [AppConfig] Fatal error
```

### 文件（JSON 格式）

```json
{"level":"info","message":"Connecting to MongoDB","label":"MongoDB","timestamp":"2025-01-07T10:30:45.123Z"}
{"level":"info","message":"Connected successfully","label":"MongoDB","timestamp":"2025-01-07T10:30:45.456Z"}
```

## 已集成的模块

- ✅ [keystone.ts](keystone.ts) - 应用初始化
- ✅ [src/lib/mongodb.ts](src/lib/mongodb.ts) - MongoDB 连接
- ✅ [src/config/app-config.ts](src/config/app-config.ts) - 重试逻辑
- ✅ [src/k8s/hybrid-init.ts](src/k8s/hybrid-init.ts) - K8s 初始化

## Winston 的优势

1. **行业标准** - Winston 是 Node.js 最流行的日志库
2. **高性能** - 异步、非阻塞
3. **可扩展** - 支持多种传输方式（transports）
4. **生产就绪** - 经过大规模应用验证
5. **灵活格式** - 自定义格式化器
6. **日志轮转** - 内置文件轮转支持

## 下一步（可选扩展）

如需更多功能，Winston 支持：

1. **外部传输** - 发送到 CloudWatch、Datadog、Loggly 等
2. **查询功能** - 使用 winston-mongodb 存储到数据库
3. **性能监控** - 集成 APM 工具
4. **日志聚合** - ELK Stack、Splunk 等
5. **自定义格式** - 添加请求 ID、用户信息等

## 文档

详细文档请查看：

- [LOGGING.md](LOGGING.md) - 完整使用指南
- [Winston GitHub](https://github.com/winstonjs/winston) - 官方文档
- [Winston Transports](https://github.com/winstonjs/winston/blob/master/docs/transports.md) - 传输方式

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量（可选）
export ENABLE_FILE_LOGGING=true
export LOG_LEVEL=debug

# 3. 启动应用
pnpm run dev
```

日志将同时输出到控制台和文件（如果启用）。
