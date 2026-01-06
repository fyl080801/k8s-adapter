# 项目结构说明

## 新增文件清单

### 核心实现文件

```
src/
├── lib/
│   └── mongodb.ts              # MongoDB 连接管理
├── models/
│   ├── Pod.ts                  # Pod 数据模型
│   ├── Deployment.ts           # Deployment 数据模型
│   ├── Service.ts              # Service 数据模型
│   └── Node.ts                 # Node 数据模型
├── k8s/
│   ├── informer.ts             # Kubernetes Informer 实现
│   └── sync.ts                 # 全量同步功能
└── api/
    ├── routes.ts               # RESTful API 路由定义
    └── server.ts               # 独立 API 服务器
```

### 配置文件

```
.env.example                    # 环境变量示例
README.k8s.md                   # K8s Informer 功能文档
PROJECT_STRUCTURE.md            # 本文件
```

### 脚本文件

```
scripts/
├── start-k8s-api.ts            # 独立启动 API 服务器
└── test-api.sh                 # API 测试脚本
```

### 修改的文件

```
keystone.ts                     # 集成了 K8s Informer 启动逻辑
package.json                    # 添加了新的依赖和脚本
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境

```bash
cp .env.example .env
# 编辑 .env 文件，设置 MONGODB_URI
```

### 3. 启动服务

**方式一：集成到 Keystone**

```bash
npm run dev
# 或生产模式
npm run build && npm start
```

**方式二：独立运行 API 服务器**

```bash
npm run k8s:api
```

### 4. 测试 API

```bash
./scripts/test-api.sh
```

## 功能说明

### 1. Kubernetes Informer

实时监控 Kubernetes 资源变化：

- **Pod Informer**: 监控 Pod 的增删改事件
- **Deployment Informer**: 监控 Deployment 的变化
- **Service Informer**: 监控 Service 的变化
- **Node Informer**: 监控 Node 的变化

### 2. 全量同步

服务启动时执行全量同步，确保 MongoDB 与 K8s 集群数据一致。

### 3. RESTful API

提供以下 API 端点：

```
GET /api/v1/health              # 健康检查
GET /api/v1/pods                # Pod 列表
GET /api/v1/pods/:uid           # Pod 详情
GET /api/v1/deployments         # Deployment 列表
GET /api/v1/deployments/:uid    # Deployment 详情
GET /api/v1/services            # Service 列表
GET /api/v1/services/:uid       # Service 详情
GET /api/v1/nodes               # Node 列表
GET /api/v1/nodes/:name         # Node 详情
GET /api/v1/stats/overview      # 统计概览
```

所有列表接口支持：

- 分页: `?page=1&limit=10`
- 过滤: `?namespace=default`
- 搜索: `?search=nginx`

## 数据流

```
Kubernetes Cluster
       ↓
   Informer Watch
       ↓
   Event Handler
       ↓
   MongoDB Sync
       ↓
   RESTful API
       ↓
   Frontend Query
```

## 技术栈

- **@kubernetes/client-node**: Kubernetes API 客户端
- **MongoDB**: 数据持久化
- **Mongoose**: MongoDB ODM
- **Express**: Web 服务器框架
- **Keystone**: CMS 框架（集成）

## 扩展指南

### 添加新的资源类型

1. 在 `src/models/` 创建数据模型
2. 在 `src/k8s/informer.ts` 添加 watch 函数
3. 在 `src/k8s/sync.ts` 添加 sync 函数
4. 在 `src/api/routes.ts` 添加 API 路由

示例：添加 ConfigMap 支持

```typescript
// 1. 创建模型 src/models/ConfigMap.ts
export interface IConfigMap extends Document {
  // ... 定义字段
}

// 2. 在 informer.ts 添加
private async watchConfigMaps() {
  const watch = await this.k8sApi.watch.watch(
    '/api/v1/configmaps',
    {},
    this.handleConfigMapEvent.bind(this),
    this.handleError.bind(this, 'ConfigMap')
  );
  this.watchers.push(() => watch.abort());
}

// 3. 在 sync.ts 添加
private async syncConfigMaps() {
  const res = await this.k8sApi.coreV1Api.listConfigMapForAllNamespaces();
  // ... 同步逻辑
}

// 4. 在 routes.ts 添加
router.get('/configmaps', async (req, res) => {
  // ... 查询逻辑
});
```

## 故障排查

### MongoDB 连接失败

```bash
# 检查 MongoDB 状态
brew services list | grep mongodb  # macOS
systemctl status mongodb           # Linux

# 启动 MongoDB
brew services start mongodb        # macOS
systemctl start mongodb            # Linux
```

### Kubernetes 访问失败

```bash
# 检查 kubeconfig
kubectl cluster-info
kubectl get nodes

# 检查当前上下文
kubectl config current-context
```

### 权限问题

确保 Service Account 有足够的 RBAC 权限：

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: k8s-informer
rules:
  - apiGroups: ['']
    resources: ['pods', 'services', 'nodes']
    verbs: ['get', 'list', 'watch']
  - apiGroups: ['apps']
    resources: ['deployments']
    verbs: ['get', 'list', 'watch']
```

## 性能优化建议

1. **索引优化**: MongoDB 查询字段已建立索引（namespace, name, uid）
2. **批量操作**: 对于大量资源，可使用 bulkWrite 提升性能
3. **缓存层**: 可考虑添加 Redis 缓存热点数据
4. **分页查询**: API 默认启用分页，避免一次性加载大量数据

## 安全建议

1. **API 认证**: 生产环境应添加 JWT 或 OAuth 认证
2. **RBAC**: 基于 Keystone 的访问控制集成
3. **HTTPS**: 使用 TLS 加密通信
4. **审计日志**: 记录所有资源变更操作

## 监控和日志

当前实现包含基础日志输出：

- Informer 启动/停止
- 资源变更事件
- 同步操作进度
- 错误信息

建议集成：

- Prometheus 指标导出
- 结构化日志（如 winston+pino）
- 分布式追踪（如 OpenTelemetry）
