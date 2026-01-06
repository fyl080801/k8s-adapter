# Kubernetes Informer 同步服务

基于 @kubernetes/client-node 实现 Informer，将 K8s 资源同步到 MongoDB，并通过 Keystone 提供 RESTful API 查询。

## 功能特性

- ✅ Kubernetes Informer 实时监控资源变化
- ✅ MongoDB 持久化存储资源数据
- ✅ 服务启动时全量同步现有资源
- ✅ RESTful API 提供资源查询接口
- ✅ 支持分页、搜索、过滤功能
- ✅ 集成到 Keystone，无需独立服务器

## 支持的资源类型

- **Pods** - Pod 列表和详情
- **Deployments** - Deployment 列表和详情
- **Services** - Service 列表和详情
- **Nodes** - Node 列表和详情

## 安装依赖

```bash
npm install
```

## 配置环境变量

创建 `.env` 文件：

```bash
# MongoDB Connection URI
MONGODB_URI=mongodb://localhost:27017/k8s-resources
```

## 启动服务

### 开发模式

```bash
npm run dev
```

### 生产模式

```bash
npm run build
npm start
```

服务启动后会自动：

1. 连接到 MongoDB
2. 执行全量同步所有 K8s 资源
3. 启动 Informer 实时监控资源变化
4. 挂载 API 路由到 Keystone (http://localhost:3000/api/v1)

## API 接口文档

### 基础路径

所有 API 路径都以 `/api/v1` 开头，通过 Keystone 服务器提供。

### 健康检查

```
GET /api/v1/health
```

响应：

```json
{
  "status": "ok",
  "timestamp": "2024-01-06T12:00:00.000Z"
}
```

### Pods

**获取 Pod 列表**

```
GET /api/v1/pods?page=1&limit=10&namespace=default&search=nginx
```

查询参数：

- `page` - 页码（默认 1）
- `limit` - 每页数量（默认 10）
- `namespace` - 按命名空间过滤
- `search` - 搜索 Pod 名称

响应：

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

**获取 Pod 详情**

```
GET /api/v1/pods/:uid
```

### Deployments

**获取 Deployment 列表**

```
GET /api/v1/deployments?page=1&limit=10&namespace=default&search=app
```

**获取 Deployment 详情**

```
GET /api/v1/deployments/:uid
```

### Services

**获取 Service 列表**

```
GET /api/v1/services?page=1&limit=10&namespace=default&search=web
```

**获取 Service 详情**

```
GET /api/v1/services/:uid
```

### Nodes

**获取 Node 列表**

```
GET /api/v1/nodes?page=1&limit=10&search=node-1
```

**获取 Node 详情**

```
GET /api/v1/nodes/:name
```

### 统计数据

**获取概览统计**

```
GET /api/v1/stats/overview
```

响应：

```json
{
  "pods": {
    "total": 50,
    "running": 45,
    "failed": 2,
    "pending": 3
  },
  "deployments": 10,
  "services": 15,
  "nodes": {
    "total": 3,
    "ready": 3
  }
}
```

## 快速测试

使用提供的测试脚本：

```bash
npm run test:api
```

或手动测试：

```bash
# 健康检查
curl http://localhost:3000/api/v1/health

# 获取所有 pods
curl http://localhost:3000/api/v1/pods

# 获取统计概览
curl http://localhost:3000/api/v1/stats/overview
```

## 数据模型

### Pod

```typescript
{
  namespace: string
  name: string
  uid: string
  resourceVersion: string
  labels: Record<string, string>
  annotations: Record<string, string>
  phase: string // Pending, Running, Succeeded, Failed, Unknown
  podIP: string
  nodeName: string
  startTime: Date
  containers: Array<{
    name: string
    image: string
    ready: boolean
    restartCount: number
  }>
}
```

### Deployment

```typescript
{
  namespace: string
  name: string
  uid: string
  replicas: number
  readyReplicas: number
  updatedReplicas: number
  availableReplicas: number
  selector: Record<string, string>
  strategyType: string
}
```

### Service

```typescript
{
  namespace: string
  name: string
  uid: string
  clusterIP: string
  externalIPs: string[]
  type: string  // ClusterIP, NodePort, LoadBalancer
  ports: Array<{
    name: string
    port: number
    targetPort: number
    protocol: string
    nodePort?: number
  }>
  selector: Record<string, string>
}
```

### Node

```typescript
{
  name: string
  uid: string
  phase: string
  addresses: Array<{
    type: string
    address: string
  }>
  nodeInfo: {
    osImage: string
    kernelVersion: string
    kubeletVersion: string
    containerRuntimeVersion: string
  }
  capacity: Record<string, string>
  allocatable: Record<string, string>
  conditions: Array<{
    type: string
    status: string
    reason: string
    message: string
  }>
}
```

## 项目结构

```
src/
├── api/
│   └── routes.ts            # RESTful API 路由（集成到 Keystone）
├── k8s/
│   ├── init.ts              # Informer 初始化模块
│   ├── informer.ts          # Kubernetes Informer 实现
│   └── sync.ts              # 全量同步功能
├── lib/
│   └── mongodb.ts           # MongoDB 连接管理
└── models/
    ├── Pod.ts               # Pod 数据模型
    ├── Deployment.ts        # Deployment 数据模型
    ├── Service.ts           # Service 数据模型
    └── Node.ts              # Node 数据模型

keystone.ts                  # Keystone 入口（已集成 K8s Informer）
```

## 工作原理

1. **启动流程**：
   - Keystone 服务器启动
   - 在 `extendExpressApp` 中初始化 K8s Informer
   - 连接 MongoDB
   - 执行全量同步
   - 启动 Informer 监听资源变化
   - 挂载 API 路由到 `/api/v1`

2. **数据同步**：
   - Informer 通过 Watch API 监听 K8s 资源变化
   - 资源变更（ADDED/MODIFIED/DELETED）实时同步到 MongoDB
   - 增量更新保证数据一致性

3. **API 查询**：
   - RESTful API 从 MongoDB 读取数据
   - 支持分页、搜索、过滤
   - 通过 Keystone 的 Express 服务器提供服务

## Kubernetes 配置

确保你的 Kubernetes 配置文件位于默认位置：

- `~/.kube/config`
- 或通过 `KUBECONFIG` 环境变量指定

服务会自动加载默认的 Kubernetes 配置。

## 注意事项

1. **MongoDB 连接**：确保 MongoDB 服务正在运行并可访问
2. **Kubernetes 权限**：确保 Service Account 有足够的权限读取 K8s 资源
3. **资源限制**：大量资源同步可能需要较长时间
4. **网络连接**：确保能访问 Kubernetes API Server

## 故障排查

### MongoDB 连接失败

检查 MongoDB 是否运行：

```bash
# macOS
brew services list | grep mongodb

# Linux
systemctl status mongodb
```

### Kubernetes API 访问失败

检查 kubeconfig 配置：

```bash
kubectl cluster-info
kubectl get nodes
```

### Informer 启动失败

检查 Service Account 权限，确保有读取资源的权限。

## 开发

添加新的资源类型：

1. 在 `src/models/` 创建数据模型
2. 在 `src/k8s/informer.ts` 添加 watch 函数
3. 在 `src/k8s/sync.ts` 添加 sync 函数
4. 在 `src/api/routes.ts` 添加 API 路由
5. 在 `src/k8s/init.ts` 的初始化流程中包含新资源

详细步骤请参考 [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)。
