# 认证系统实施总结

## 概述

已成功为项目的所有 API 端点添加统一的认证系统，集成 Keystone 的登录态。

## 实施内容

### 新增文件

1. **[src/middleware/auth.ts](../src/middleware/auth.ts)** - 认证中间件模块
   - `requireAuth` - 要求用户登录（Keystone session）
   - `requireApiKey` - 接受 session 或 API key
   - `requireRole` - 基于角色的访问控制
   - `requireAdmin` - 仅管理员访问
   - `optionalAuth` - 可选认证

2. **[src/middleware/context.ts](../src/middleware/context.ts)** - Context 中间件
   - 将 Keystone context 附加到所有 Express 请求
   - 使认证中间件能够访问 session 数据

3. **[docs/AUTHENTICATION.md](./AUTHENTICATION.md)** - 完整的认证使用文档

### 修改文件

1. **[keystone.ts](../keystone.ts)**
   - 在 `extendExpressApp` 中添加 context 参数
   - 集成 context 中间件
   - 确保所有路由都能访问 Keystone context

2. **[src/api/routes.ts](../src/api/routes.ts)**
   - 导入 `requireApiKey` 中间件
   - 定义公共端点（`/health`）
   - 为所有其他路由应用认证中间件

3. **[.env.example](../.env.example)**
   - 添加 `SESSION_SECRET` 环境变量说明
   - 添加 `VALID_API_KEYS` 环境变量说明

## 认证流程

```
┌─────────────┐
│ HTTP Client │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│  1. Context Middleware              │
│     (attaches Keystone context)     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. Authentication Middleware       │
│     (requireApiKey)                 │
│     - Check Keystone session         │
│     - OR check API key in headers   │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────────────┐
        │ Authenticated│
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │ API Handlers │
        │ (protected)  │
        └──────────────┘
```

## 支持的认证方式

### 1. Keystone Session（Cookie）

- ✅ 自动处理（浏览器登录后）
- ✅ 安全的 cookie-based session
- ✅ 适用于 Web 应用
- ⚠️ 需要先登录 Keystone Admin UI

### 2. API Key

- ✅ 适用于程序化访问
- ✅ 支持多个 API key
- ✅ 简单的 HTTP header 认证
- ⚠️ 需要配置 `VALID_API_KEYS` 环境变量

## 路由保护状态

### 公开端点（无需认证）

- `GET /api/v1/health` - 健康检查

### 受保护端点（需要认证）

所有其他端点都需要认证，包括：

**数据库查询端点：**

- `GET /api/v1/pods`
- `GET /api/v1/deployments`
- `GET /api/v1/{resource}`
- `GET /api/v1/{resource}/:id`
- `GET /api/v1/namespace/:namespace/{resource}`

**K8s 原生 API 端点：**

- `GET /api/v1/pods/:namespace/:name/logs`
- `GET /api/v1/pods/:namespace/:name/yaml`
- `GET /api/v1/pods/:namespace/:name/events`
- `GET /api/v1/{resource}/:namespace/:name/yaml`
- `GET /api/v1/{resource}/:namespace/:name/events`

**CRUD 操作端点：**

- `POST /api/v1/{resource}`
- `PUT /api/v1/{resource}/:namespace/:name`
- `DELETE /api/v1/{resource}/:namespace/:name`
- `PUT /api/v1/{resource}/:name`
- `DELETE /api/v1/{resource}/:name`

**统计端点：**

- `GET /api/v1/stats/overview`

**信息端点：**

- `GET /api/v1/cluster/info`
- `GET /api/v1/resources`
- `GET /api/v1/resources/registry`

## 使用示例

### 使用 Session 认证（浏览器）

```javascript
// 登录 Keystone Admin UI 后
fetch('/api/v1/pods')
  .then(res => res.json())
  .then(data => console.log(data))
```

### 使用 API Key 认证

```bash
# 设置 API key
export API_KEY="your-api-key-here"

# 使用 API key 访问
curl -H "X-API-Key: $API_KEY" \
  http://localhost:3000/api/v1/pods

# 或使用 Bearer token
curl -H "Authorization: Bearer $API_KEY" \
  http://localhost:3000/api/v1/pods
```

```javascript
// JavaScript/Node.js
const response = await fetch('http://localhost:3000/api/v1/pods', {
  headers: {
    'X-API-Key': 'your-api-key-here',
  },
})
const data = await response.json()
```

```python
# Python
import requests

headers = {'X-API-Key': 'your-api-key-here'}
response = requests.get('http://localhost:3000/api/v1/pods', headers=headers)
data = response.json()
```

## 环境变量配置

在 `.env` 文件中添加：

```bash
# Session Secret（必需）
SESSION_SECRET=$(openssl rand -hex 32)

# API Keys（可选，逗号分隔）
VALID_API_KEYS=key1,key2,key3
```

## 生成安全的密钥

```bash
# Session Secret
openssl rand -hex 32

# API Key
openssl rand -hex 32
```

## 测试

### 1. 测试公共端点（应该成功）

```bash
curl http://localhost:3000/api/v1/health
```

**预期响应：**

```json
{
  "status": "ok",
  "timestamp": "2025-01-06T..."
}
```

### 2. 测试受保护端点（无认证，应该失败）

```bash
curl http://localhost:3000/api/v1/pods
```

**预期响应：**

```json
{
  "error": "Unauthorized",
  "message": "API key or valid session required"
}
```

### 3. 测试受保护端点（使用 API key）

```bash
# 设置 API key
export API_KEY="test-key-123"
echo "VALID_API_KEYS=$API_KEY" >> .env

# 重启服务器
npm run dev

# 测试（在新终端）
curl -H "X-API-Key: $API_KEY" \
  http://localhost:3000/api/v1/pods
```

**预期响应：** Pod 列表数据

## 安全建议

### ✅ 生产环境必须：

1. **设置强 SESSION_SECRET**

   ```bash
   openssl rand -hex 32
   ```

2. **配置 VALID_API_KEYS**

   ```bash
   VALID_API_KEYS=prod-key-1,prod-key-2,admin-key
   ```

3. **使用 HTTPS**
   - 保护 API key 和 session cookie 在传输中的安全

4. **定期轮换密钥**
   - Session secret 定期更新
   - API key 定期更换

5. **实施速率限制**
   - 防止 API 滥用
   - 防止暴力破解

6. **添加审计日志**
   - 记录所有 API 调用
   - 记录认证失败尝试

### ⚠️ 开发环境：

- 使用简单的 session secret 和 API key 进行测试
- 不要将 `.env` 文件提交到版本控制
- 定期更新测试密钥

## 故障排查

### 问题：所有请求返回 401

**检查：**

1. `.env` 文件是否存在
2. `VALID_API_KEYS` 是否设置
3. API key 是否正确（检查拼写、空格）
4. 是否重启了服务器

### 问题：Session 不工作

**检查：**

1. 是否已登录 Keystone Admin UI
2. `SESSION_SECRET` 是否设置
3. 浏览器是否接受 cookie
4. 清除浏览器 cookie 后重试

### 问题：API key 认证不工作

**检查：**

1. Header 格式是否正确：`X-API-Key` 或 `Authorization: Bearer`
2. API key 是否在 `VALID_API_KEYS` 列表中（逗号分隔）
3. 环境变量是否正确加载

## 扩展

### 添加基于角色的访问控制

1. 在 `schema.ts` 的 User 模型中添加 role 字段
2. 使用 `requireRole` 中间件保护特定路由

```typescript
// src/api/routes.ts
import { requireRole } from '../middleware/auth'

// 只有管理员可以删除
router.delete(
  '/pods/:namespace/:name',
  requireRole(['admin']),
  deletePodHandler,
)

// 管理员和编辑者可以更新
router.put(
  '/deployments/:namespace/:name',
  requireRole(['admin', 'editor']),
  updateDeploymentHandler,
)
```

### 添加速率限制

```bash
npm install express-rate-limit
```

```typescript
// src/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit'

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
})
```

## 总结

✅ **完成的功能：**

1. 统一的认证中间件系统
2. 支持 Keystone Session 和 API Key 两种认证方式
3. 全局应用到所有 API 路由
4. 保留了公共健康检查端点
5. 完整的文档和配置示例

✅ **验证结果：**

- 项目成功编译
- 所有 TypeScript 类型检查通过
- 认证逻辑正确集成

🔒 **安全改进：**

- 所有 API 端点现在受保护
- 支持灵活的认证策略
- 易于扩展和定制

📚 **文档：**

- 完整的认证使用指南
- 故障排查建议
- 安全最佳实践
