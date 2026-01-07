# Kubernetes Native API Documentation

本文档详细说明了项目中新增加的 Kubernetes 原生 API 接口。

## 概述

本项目实现了两种类型的 API 接口：

1. **数据库查询接口** - 从 MongoDB 读取由 Informer 同步的数据
2. **K8s 原生 API 接口** - 直接使用 `@kubernetes/client-node` 调用 Kubernetes API

### 架构说明

```
┌─────────────────┐
│   HTTP Client   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Express Routes (/api/v1)       │
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │ generic-routes.ts         │  │ ← MongoDB Queries (Cached Data)
│  │ - List resources          │  │
│  │ - Get resource by ID      │  │
│  │ - Filter by namespace     │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ k8s-native-routes.ts      │  │ ← Direct K8s API Access (Real-time)
│  │ - Pod logs                │  │
│  │ - Resource YAML/JSON      │  │
│  │ - Events                  │  │
│  │ - CRUD operations         │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  @kubernetes/client-node        │
│  (k8s-client.ts)                │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Kubernetes API Server          │
└─────────────────────────────────┘
```

## API 端点列表

### 1. Health & Stats (健康检查与统计)

#### GET /api/v1/health

健康检查端点。

**响应示例：**

```json
{
  "status": "ok",
  "timestamp": "2025-01-06T10:00:00.000Z"
}
```

#### GET /api/v1/stats/overview

获取所有资源的统计信息（从 MongoDB）。

**响应示例：**

```json
{
  "pods": {
    "total": 50,
    "running": 45,
    "failed": 2,
    "pending": 3
  },
  "nodes": {
    "total": 3,
    "ready": 3
  },
  "deployments": 10,
  "services": 5
}
```

#### GET /api/v1/cluster/info

获取当前 Kubernetes 集群上下文信息。

**响应示例：**

```json
{
  "currentContext": "docker-desktop",
  "availableContexts": [
    {
      "name": "docker-desktop",
      "cluster": "docker-desktop",
      "user": "docker-desktop"
    }
  ]
}
```

### 2. 数据库查询接口（来自 MongoDB）

这些接口查询由 Informer 实时同步到 MongoDB 的数据。

#### GET /api/v1/{resource}

列出指定类型的所有资源（支持分页和过滤）。

**参数：**

- `namespace` (可选): 按 namespace 过滤
- `page` (可选): 页码，默认 1
- `limit` (可选): 每页条目数，默认 10
- `search` (可选): 按名称搜索（不区分大小写）

**示例：**

```bash
# 列出所有 Pods
GET /api/v1/pods

# 列出 default namespace 的 Pods，第 2 页，每页 20 条
GET /api/v1/pods?namespace=default&page=2&limit=20

# 搜索名称包含 "nginx" 的 Pods
GET /api/v1/pods?search=nginx
```

**响应示例：**

```json
{
  "data": [
    {
      "namespace": "default",
      "name": "nginx-deployment-abc123",
      "uid": "uid-123",
      "phase": "Running",
      "createdAt": "2025-01-06T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

#### GET /api/v1/{resource}/:id

根据 ID 获取特定资源。

**示例：**

```bash
# 根据 uid 获取 Pod
GET /api/v1/pods/pod-uid-123

# 根据 name 获取 Node（Node 使用 name 作为 ID）
GET /api/v1/nodes/node-1
```

#### GET /api/v1/namespace/:namespace/{resource}

列出特定 namespace 中的资源。

**示例：**

```bash
# 列出 kube-system namespace 中的所有 Pods
GET /api/v1/namespace/kube-system/pods
```

### 3. K8s 原生 API 接口（直接访问）

这些接口直接调用 Kubernetes API，用于实时操作。

#### Pod 特定操作

##### GET /api/v1/pods/:namespace/:name/logs

获取 Pod 的日志。

**参数：**

- `container` (可选): 容器名称（多容器 Pod）
- `tailLines` (可选): 从日志末尾返回的行数

**示例：**

```bash
# 获取 Pod 日志（默认 100 行）
GET /api/v1/pods/default/nginx-pod/logs

# 获取特定容器的日志
GET /api/v1/pods/default/multi-container-pod/logs?container=sidecar

# 获取最近 1000 行日志
GET /api/v1/pods/default/nginx-pod/logs?tailLines=1000
```

**响应：**

```
2025-01-06T10:00:00.000Z INFO  Starting server...
2025-01-06T10:00:01.000Z INFO  Server started on port 80
```

##### GET /api/v1/pods/:namespace/:name/yaml

获取 Pod 的原始 Kubernetes YAML/JSON 清单。

**示例：**

```bash
GET /api/v1/pods/default/nginx-pod/yaml
```

**响应示例：**

```json
{
  "kind": "Pod",
  "apiVersion": "v1",
  "metadata": {
    "name": "nginx-pod",
    "namespace": "default",
    "uid": "uid-123",
    "resourceVersion": "12345",
    ...
  },
  "spec": {
    "containers": [...],
    ...
  },
  "status": {
    "phase": "Running",
    ...
  }
}
```

##### GET /api/v1/pods/:namespace/:name/events

获取与 Pod 相关的事件。

**示例：**

```bash
GET /api/v1/pods/default/nginx-pod/events
```

**响应示例：**

```json
{
  "data": [
    {
      "type": "Normal",
      "reason": "Scheduled",
      "message": "Successfully assigned default/nginx-pod to node-1",
      "source": { "component": "scheduler" },
      "firstTimestamp": "2025-01-06T10:00:00Z",
      "lastTimestamp": "2025-01-06T10:00:00Z"
    }
  ],
  "count": 1
}
```

#### 通用资源操作

##### GET /api/v1/{resource}/:namespace/:name/yaml

获取任何 namespaced 资源的原始清单。

**示例：**

```bash
GET /api/v1/deployments/default/nginx-deployment/yaml
GET /api/v1/services/default/kubernetes-service/yaml
GET /api/v1/configmaps/default/app-config/yaml
```

##### GET /api/v1/{resource}/:namespace/:name/events

获取与任何 namespaced 资源相关的事件。

**示例：**

```bash
GET /api/v1/deployments/default/nginx-deployment/events
GET /api/v1/statefulsets/kube-system/core-dns/events
```

##### GET /api/v1/{resource}/:name/yaml

获取集群范围资源的原始清单。

**示例：**

```bash
GET /api/v1/persistentvolumes/pv-1/yaml
GET /api/v1/nodes/node-1/yaml
GET /api/v1/customresourcedefinitions/certificates.cert-manager.io/yaml
```

### 4. CRUD 操作（直接 K8s API）

这些接口允许直接创建、更新和删除 Kubernetes 资源。

#### POST /api/v1/{resource}

创建新的 Kubernetes 资源。

**请求体：** Kubernetes 资源清单（JSON 格式）

**示例：**

```bash
POST /api/v1/pods
Content-Type: application/json

{
  "kind": "Pod",
  "apiVersion": "v1",
  "metadata": {
    "name": "test-pod",
    "namespace": "default"
  },
  "spec": {
    "containers": [{
      "name": "nginx",
      "image": "nginx:latest"
    }]
  }
}
```

**响应示例：**

```json
{
  "message": "Pod created successfully",
  "data": {
    "kind": "Pod",
    "metadata": {
      "name": "test-pod",
      "uid": "new-uid-123",
      ...
    }
  }
}
```

#### PUT /api/v1/{resource}/:namespace/:name

更新 namespaced 资源。

**请求体：** 完整的 Kubernetes 资源清单

**示例：**

```bash
PUT /api/v1/deployments/default/nginx-deployment
Content-Type: application/json

{
  "kind": "Deployment",
  "apiVersion": "apps/v1",
  "metadata": {
    "name": "nginx-deployment",
    "namespace": "default"
  },
  "spec": {
    "replicas": 5,
    ...
  }
}
```

#### DELETE /api/v1/{resource}/:namespace/:name

删除 namespaced 资源。

**示例：**

```bash
DELETE /api/v1/pods/default/test-pod
```

**响应示例：**

```json
{
  "message": "Pod 'test-pod' deleted successfully"
}
```

#### PUT /api/v1/{resource}/:name

更新集群范围资源。

**示例：**

```bash
PUT /api/v1/persistentvolumes/pv-1
```

#### DELETE /api/v1/{resource}/:name

删除集群范围资源。

**示例：**

```bash
DELETE /api/v1/persistentvolumes/pv-1
```

## 支持的资源类型

当前支持以下 Kubernetes 资源类型：

### Core v1 (Namespaced)

- Pod (`pods`)
- Service (`services`)
- ConfigMap (`configmaps`)
- Secret (`secrets`)
- Event (`events`)
- PersistentVolumeClaim (`persistentvolumeclaims`)

### Core v1 (Cluster-scoped)

- Node (`nodes`)
- PersistentVolume (`persistentvolumes`)

### Apps/v1 (Namespaced)

- Deployment (`deployments`)
- StatefulSet (`statefulsets`)
- DaemonSet (`daemonsets`)

### Networking.k8s.io/v1 (Namespaced)

- Ingress (`ingresses`)

### APIextensions.k8s.io/v1 (Cluster-scoped)

- CustomResourceDefinition (`customresourcedefinitions`)

## 错误处理

所有端点遵循统一的错误响应格式：

**HTTP 状态码：**

- `200` - 成功
- `201` - 创建成功
- `400` - 错误的请求
- `404` - 资源未找到
- `500` - 服务器内部错误

**错误响应示例：**

```json
{
  "error": "Resource type 'invalid-resource' not found"
}
```

或

```json
{
  "error": "Failed to get pod logs: Pod not found"
}
```

## 使用场景

### 使用数据库查询接口（推荐用于列表和详情）

✅ **优势：**

- 性能更好（数据已缓存在 MongoDB）
- 支持复杂查询和过滤
- 不增加 Kubernetes API Server 负载

**适用于：**

- 列表展示
- 资源搜索
- 统计分析
- Dashboard 数据展示

### 使用 K8s 原生 API 接口

✅ **优势：**

- 实时数据（直接从 K8s API Server 获取）
- 支持 CRUD 操作
- 支持日志和事件查询

**适用于：**

- 查看 Pod 日志
- 查看资源事件
- 创建/更新/删除资源
- 获取完整的资源清单（YAML/JSON）
- 实时调试和故障排查

## 测试

运行测试脚本验证所有 API 端点：

```bash
# 确保服务正在运行
npm run dev

# 在另一个终端运行测试
./scripts/test-native-api.sh
```

## 安全考虑

⚠️ **重要提示：**

当前实现没有认证和授权机制。在生产环境中使用时，请确保：

1. **添加身份验证** - 验证 API 调用者的身份
2. **添加授权** - 控制谁能执行哪些操作（特别是 CRUD 操作）
3. **使用 RBAC** - 为 Service Account 配置适当的权限
4. **启用 HTTPS** - 加密 API 通信
5. **审计日志** - 记录所有敏感操作

示例安全中间件：

```typescript
// 在 keystone.ts 中添加认证中间件
app.use('/api/v1', (req, res, next) => {
  // 验证 JWT token 或 API key
  if (!isValidRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})
```

## 扩展

添加新的 K8s 原生操作：

1. 在 `src/lib/k8s-client.ts` 中添加新的客户端函数
2. 在 `src/api/k8s-native-routes.ts` 中添加新的路由处理器
3. 更新本文档

## 相关文档

- [CLAUDE.md](../CLAUDE.md) - 项目整体架构说明
- [K8S_TYPES_MIGRATION.md](guides/K8S_TYPES_MIGRATION.md) - K8s 类型系统迁移指南
- [@kubernetes/client-node 官方文档](https://github.com/kubernetes-client/javascript)
