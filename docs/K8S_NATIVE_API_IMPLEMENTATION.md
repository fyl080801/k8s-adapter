# Kubernetes 原生 API 实现总结

## 实施概述

本次实现为项目添加了完整的 Kubernetes 原生 API 操作接口，补充了除了数据库查询之外的所有 K8s 资源操作功能。

## 实现的功能

### 1. 核心 K8s 客户端工具 ([src/lib/k8s-client.ts](src/lib/k8s-client.ts))

创建了统一的 Kubernetes 客户端工具模块，提供以下功能：

- **资源查询**：`getK8sObject()` - 获取 K8s 资源的原始对象
- **Pod 日志**：`getPodLogs()` - 获取 Pod 日志，支持容器选择和行数限制
- **资源事件**：`getEventsForResource()` - 获取资源相关的事件
- **创建资源**：`createK8sResource()` - 创建新资源
- **更新资源**：`updateK8sResource()` - 更新现有资源
- **删除资源**：`deleteK8sResource()` - 删除资源
- **集群信息**：`getCurrentContext()` 和 `getContexts()` - 获取集群上下文信息

### 2. K8s 原生操作路由 ([src/api/k8s-native-routes.ts](src/api/k8s-native-routes.ts))

实现了完整的 RESTful API 接口：

#### Pod 特定操作

- `GET /api/v1/pods/:namespace/:name/logs` - 获取 Pod 日志
- `GET /api/v1/pods/:namespace/:name/yaml` - 获取 Pod 原始清单
- `GET /api/v1/pods/:namespace/:name/events` - 获取 Pod 事件

#### 通用资源操作

- `GET /api/v1/:resource/:namespace/:name/yaml` - 获取任何资源的原始清单
- `GET /api/v1/:resource/:namespace/:name/events` - 获取任何资源的事件
- `GET /api/v1/:resource/:name/yaml` - 获取集群范围资源的原始清单

#### CRUD 操作

- `POST /api/v1/{resource}` - 创建资源
- `PUT /api/v1/{resource}/:namespace/:name` - 更新 namespaced 资源
- `PUT /api/v1/{resource}/:name` - 更新集群范围资源
- `DELETE /api/v1/{resource}/:namespace/:name` - 删除 namespaced 资源
- `DELETE /api/v1/{resource}/:name` - 删除集群范围资源

#### 集群信息

- `GET /api/v1/cluster/info` - 获取当前集群上下文信息

### 3. 增强的路由注册表 ([src/api/routes.ts](src/api/routes.ts))

更新了主路由文件，集成新的原生 K8s 路由，并完善了 API 文档端点。

### 4. 测试脚本 ([scripts/test-native-api.sh](scripts/test-native-api.sh))

创建了自动化测试脚本，用于验证所有新增的 API 端点。

### 5. 详细文档 ([docs/K8S_NATIVE_API.md](docs/K8S_NATIVE_API.md))

创建了完整的 API 使用文档，包括：

- 所有端点的详细说明
- 请求和响应示例
- 错误处理
- 使用场景建议
- 安全考虑

## 架构设计

```
数据库查询（已有）
├─ GET /api/v1/{resource}          → MongoDB
├─ GET /api/v1/{resource}/:id      → MongoDB
└─ GET /api/v1/namespace/:ns/{resource} → MongoDB

K8s 原生 API（新增）
├─ Pod 操作
│  ├─ GET /api/v1/pods/:ns/:name/logs
│  ├─ GET /api/v1/pods/:ns/:name/yaml
│  └─ GET /api/v1/pods/:ns/:name/events
├─ 资源清单
│  ├─ GET /api/v1/{resource}/:ns/:name/yaml
│  └─ GET /api/v1/{resource}/:name/yaml
├─ 资源事件
│  ├─ GET /api/v1/{resource}/:ns/:name/events
│  └─ GET /api/v1/pods/:ns/:name/events
├─ CRUD 操作
│  ├─ POST /api/v1/{resource}
│  ├─ PUT /api/v1/{resource}/:ns/:name
│  ├─ PUT /api/v1/{resource}/:name
│  ├─ DELETE /api/v1/{resource}/:ns/:name
│  └─ DELETE /api/v1/{resource}/:name
└─ 集群信息
   └─ GET /api/v1/cluster/info
```

## 支持的资源类型

所有在 `RESOURCE_CONFIGS` 中注册的资源都支持 K8s 原生操作：

### Namespaced Resources

- Pod
- Service
- Deployment
- StatefulSet
- DaemonSet
- ConfigMap
- Secret
- PersistentVolumeClaim
- Ingress
- Event

### Cluster-Scoped Resources

- Node
- PersistentVolume
- CustomResourceDefinition

## 使用示例

### 获取 Pod 日志

```bash
curl http://localhost:3000/api/v1/pods/default/nginx-pod/logs?tailLines=100
```

### 获取 Deployment 的原始清单

```bash
curl http://localhost:3000/api/v1/deployments/default/nginx-deployment/yaml
```

### 创建新的 Pod

```bash
curl -X POST http://localhost:3000/api/v1/pods \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

### 获取资源事件

```bash
curl http://localhost:3000/api/v1/deployments/default/my-deployment/events
```

### 获取集群信息

```bash
curl http://localhost:3000/api/v1/cluster/info
```

## 与数据库查询的区别

| 特性       | 数据库查询               | K8s 原生 API          |
| ---------- | ------------------------ | --------------------- |
| 数据源     | MongoDB（Informer 同步） | Kubernetes API Server |
| 响应速度   | 快（已缓存）             | 较慢（实时查询）      |
| 适用场景   | 列表、详情、搜索         | 日志、事件、CRUD      |
| API 负载   | 无                       | 有                    |
| 数据一致性 | 最终一致                 | 强一致                |

## 文件清单

### 新增文件

1. `src/lib/k8s-client.ts` - K8s 客户端工具模块
2. `src/api/k8s-native-routes.ts` - K8s 原生操作路由
3. `scripts/test-native-api.sh` - API 测试脚本
4. `docs/K8S_NATIVE_API.md` - API 使用文档

### 修改文件

1. `src/api/routes.ts` - 集成新的路由模块并更新 API 文档

## 测试

```bash
# 启动开发服务器
npm run dev

# 运行测试脚本
./scripts/test-native-api.sh

# 或手动测试
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/cluster/info
curl http://localhost:3000/api/v1/pods/default/test-pod/logs
```

## 构建验证

项目已成功编译，所有 TypeScript 类型检查通过：

```bash
npm run build
# ✅ Build successful
```

## 注意事项

⚠️ **安全警告：**

当前实现没有身份验证和授权机制。在生产环境中使用前，必须添加：

1. 身份验证（JWT token、API key 等）
2. 授权控制（RBAC、权限检查）
3. 请求限流
4. 审计日志
5. HTTPS 加密

## 后续改进建议

1. **添加身份验证中间件**

   ```typescript
   app.use('/api/v1', authMiddleware)
   ```

2. **实现请求限流**

   ```typescript
   import rateLimit from 'express-rate-limit'
   const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })
   app.use('/api/v1', limiter)
   ```

3. **添加 WebSocket 支持**（用于 Pod exec 实时输出）

4. **实现批量操作**（批量创建、删除资源）

5. **添加操作审计日志**

6. **实现更细粒度的 RBAC 权限控制**

## 总结

本次实现成功地为项目添加了完整的 Kubernetes 原生 API 操作功能，包括：

✅ K8s 客户端工具模块
✅ Pod 日志查询
✅ 资源 YAML/JSON 清单获取
✅ 资源事件查询
✅ 通用 CRUD 操作（创建、更新、删除）
✅ 集群信息查询
✅ 完善的文档和测试

项目现在支持两种数据访问方式：

1. **数据库查询** - 用于高性能的列表和详情查询
2. **K8s 原生 API** - 用于实时操作和 CRUD

这为使用者提供了灵活性和性能的最佳平衡。
