# API Authentication Guide

本文档说明如何使用 API 的认证系统。

## 概述

项目已集成 Keystone 的认证系统，所有 API 端点（除了健康检查）都需要身份验证。

### 认证方式

系统支持两种认证方式：

1. **Keystone Session（Cookie）** - 适用于 Web 应用
2. **API Key** - 适用于程序化访问和 API 客户端

## 公开端点

只有一个端点不需要认证：

```
GET /api/v1/health
```

## 认证方式

### 1. Keystone Session（Cookie 认证）

使用 Keystone 的会话系统，通过浏览器登录后自动携带认证 cookie。

**步骤：**

1. 访问 Keystone Admin UI 登录页面
2. 使用用户凭据登录
3. 登录后，浏览器会自动携带 session cookie
4. 所有 API 请求都会自动认证

**示例（浏览器环境）：**

```javascript
// 登录后，浏览器自动携带 cookie
fetch('/api/v1/pods')
  .then(res => res.json())
  .then(data => console.log(data))
```

### 2. API Key 认证

使用 API key 进行认证，适用于程序化访问。

#### 设置 API Key

在项目根目录的 `.env` 文件中添加：

```bash
VALID_API_KEYS=your-secret-api-key-1,your-secret-api-key-2
```

**⚠️ 重要提示：**

- 在生产环境中使用强密码生成 API key
- 定期轮换 API key
- 不要将 `.env` 文件提交到版本控制

#### 使用 API Key

有两种方式提供 API key：

**方式 1：使用 X-API-Key header**

```bash
curl -H "X-API-Key: your-secret-api-key-1" \
  http://localhost:3000/api/v1/pods
```

**方式 2：使用 Authorization Bearer header**

```bash
curl -H "Authorization: Bearer your-secret-api-key-1" \
  http://localhost:3000/api/v1/pods
```

**JavaScript 示例：**

```javascript
// 使用 fetch API
fetch('http://localhost:3000/api/v1/pods', {
  headers: {
    'X-API-Key': 'your-secret-api-key-1',
  },
})
  .then(res => res.json())
  .then(data => console.log(data))

// 使用 Axios
axios.get('http://localhost:3000/api/v1/pods', {
  headers: {
    'X-API-Key': 'your-secret-api-key-1',
  },
})
```

**Python 示例：**

```python
import requests

headers = {
    'X-API-Key': 'your-secret-api-key-1'
}

response = requests.get('http://localhost:3000/api/v1/pods', headers=headers)
print(response.json())
```

## 认证中间件

### 可用的中间件

在 [src/middleware/auth.ts](../src/middleware/auth.ts) 中定义了以下中间件：

1. **`requireAuth`** - 要求用户登录（Keystone session）
2. **`requireApiKey`** - 接受 session 或 API key（当前使用）
3. **`requireRole(roles)`** - 要求特定角色（需要 User 模型有 role 字段）
4. **`requireAdmin`** - 要求管理员角色
5. **`optionalAuth`** - 可选认证，不强制要求

### 当前配置

在 [src/api/routes.ts](../src/api/routes.ts) 中，所有路由使用 `requireApiKey` 中间件：

```typescript
// Public endpoints (no authentication required)
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Apply authentication to all routes except health check
router.use(requireApiKey)

// All routes below require authentication
router.use(genericRouter)
router.use(k8sNativeRoutes)
```

### 自定义认证规则

如果需要为特定路由配置不同的认证规则，可以修改 `src/api/routes.ts`：

```typescript
// 示例：只读端点使用 API key，写操作需要管理员
import { requireApiKey, requireAdmin } from '../middleware/auth'

// 公开端点
router.get('/health', (req, res) => { ... })

// 只读操作 - API key 或 session
router.use(requireApiKey)
router.get('/pods', listPods)
router.get('/deployments', listDeployments)

// 写操作 - 需要管理员
router.post('/pods', requireAdmin, createPod)
router.put('/pods/:namespace/:name', requireAdmin, updatePod)
router.delete('/pods/:namespace/:name', requireAdmin, deletePod)
```

## 错误响应

### 401 Unauthorized

当缺少认证或认证失败时返回：

```json
{
  "error": "Unauthorized",
  "message": "API key or valid session required"
}
```

**原因：**

- 没有提供 API key 或 session cookie
- API key 无效
- Session 已过期

**解决方法：**

- 检查是否正确提供了 API key header
- 确认 API key 在 `VALID_API_KEYS` 环境变量中
- 如果使用 session，重新登录 Keystone Admin UI

### 403 Forbidden

当用户已认证但没有足够权限时返回：

```json
{
  "error": "Forbidden",
  "message": "You need one of the following roles to access this resource: admin"
}
```

## 安全最佳实践

### 1. API Key 管理

✅ **推荐做法：**

- 为不同的客户端/应用使用不同的 API key
- 定期轮换 API key
- 使用强随机字符串生成 API key（至少 32 字符）
- 在生产环境中使用环境变量存储 API key
- 记录 API key 的使用情况（审计日志）

❌ **避免：**

- 在代码中硬编码 API key
- 将 API key 提交到版本控制系统
- 与他人共享 API key
- 使用简单的 API key（如 "secret123"）

### 2. 生成安全的 API Key

**使用 Node.js：**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**使用 OpenSSL：**

```bash
openssl rand -hex 32
```

**示例输出：**

```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 3. 环境变量配置

**.env 文件示例：**

```bash
# Session secret (用于 Keystone session)
SESSION_SECRET=your-random-session-secret-at-least-32-characters

# API keys (逗号分隔，可以为多个客户端设置不同的 key)
VALID_API_KEYS=client1-api-key-here,client2-api-key-here,admin-api-key-here

# MongoDB URI
MONGODB_URI=mongodb://localhost:27017/k8s-resources
```

### 4. 生产环境建议

1. **使用 HTTPS** - 确保 API 通信加密
2. **实施速率限制** - 防止 API 滥用
3. **添加审计日志** - 记录所有 API 调用
4. **实施 IP 白名单**（可选）- 限制特定 IP 访问
5. **定期审查 API key** - 撤销不再使用的 key

## 测试认证

### 测试 Session 认证

```bash
# 1. 启动开发服务器
npm run dev

# 2. 在浏览器中访问
open http://localhost:3000

# 3. 使用 Keystone Admin UI 登录
#    默认首次访问会提示创建管理员账户

# 4. 登录后在浏览器控制台测试
fetch('/api/v1/pods')
  .then(res => res.json())
  .then(data => console.log(data))
```

### 测试 API Key 认证

```bash
# 1. 在 .env 文件中添加 API key
echo "VALID_API_KEYS=test-key-123" >> .env

# 2. 重启服务器
npm run dev

# 3. 测试 API（应该返回 401）
curl http://localhost:3000/api/v1/pods

# 4. 测试 API with API key（应该返回数据）
curl -H "X-API-Key: test-key-123" \
  http://localhost:3000/api/v1/pods
```

## 故障排查

### 问题：总是返回 401 Unauthorized

**可能原因：**

1. API key 未设置或未正确加载

   ```bash
   # 检查环境变量
   echo $VALID_API_KEYS
   ```

2. API key 拼写错误

   ```bash
   # 确认 header 格式正确
   curl -H "X-API-Key: your-api-key" http://localhost:3000/api/v1/health
   ```

3. Session cookie 未正确发送（浏览器问题）
   ```javascript
   // 检查是否有 cookie
   console.log(document.cookie)
   ```

### 问题：API key 认证不工作

**解决方案：**

1. 确保 `.env` 文件存在且包含 `VALID_API_KEYS`
2. 重启开发服务器使环境变量生效
3. 检查 API key 是否在 `VALID_API_KEYS` 列表中（用逗号分隔）
4. 确认 header 名称正确（`X-API-Key` 或 `Authorization`）

### 问题：Session 认证不工作

**解决方案：**

1. 确认已通过 Keystone Admin UI 登录
2. 检查 `SESSION_SECRET` 环境变量是否设置
3. 清除浏览器 cookie 并重新登录
4. 检查浏览器控制台是否有 JavaScript 错误

## 相关文件

- [src/middleware/auth.ts](../src/middleware/auth.ts) - 认证中间件定义
- [src/middleware/context.ts](../src/middleware/context.ts) - Context 中间件
- [src/api/routes.ts](../src/api/routes.ts) - API 路由配置
- [keystone.ts](../keystone.ts) - Keystone 配置
- [auth.ts](../auth.ts) - Keystone 认证配置

## 更多信息

- [Keystone 认证文档](https://keystonejs.com/docs/apis/auth)
- [Keystone Session API](https://keystonejs.com/docs/apis/session)
- [K8S Native API 文档](./K8S_NATIVE_API.md)
