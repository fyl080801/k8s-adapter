# Kubernetes Native API Path Patterns - Migration Guide

## 概述

项目已成功迁移到 Kubernetes 原生 API 路径格式，提供更一致、更直观的 API 体验。

## 主要变更

### 1. 统一路径格式

**之前的路径格式**：

```
GET /api/v1/pods                          # 列出所有 pods
GET /api/v1/pods/:id                      # 通过 ID/UID 获取单个 pod
GET /api/v1/namespace/:namespace/pods     # 列出特定命名空间的 pods
GET /api/v1/pods/:namespace/:name/yaml    # 获取原生 YAML
```

**现在的路径格式（K8s 原生）**：

```
GET /api/v1/pods                               # 列出所有 pods（支持 ?namespace= 过滤）
GET /api/v1/namespaces/:namespace/pods          # 列出特定命名空间的 pods
GET /api/v1/namespaces/:namespace/pods/:name    # 通过 namespace + name 获取 pod
GET /api/v1/namespaces/:namespace/pods/:name/yaml   # 获取原生 YAML
```

### 2. 命名空间资源的路径模式

#### 列表查询（从 MongoDB）

```bash
# 方式 1：使用 /namespaces/:namespace/{resource}（推荐，符合 K8s 规范）
GET /api/v1/namespaces/default/pods?page=1&limit=10

# 方式 2：使用查询参数
GET /api/v1/pods?namespace=default&page=1&limit=10
```

#### 详情查询（从 MongoDB）

```bash
# 使用 namespace + name 组合
GET /api/v1/namespaces/default/pods/my-pod
GET /api/v1/namespaces/apps/configmaps/firecrawl-config
```

#### 原生资源获取（从 K8s API）

```bash
# 获取原始 YAML/JSON
GET /api/v1/namespaces/default/pods/my-pod/yaml
GET /api/v1/namespaces/apps/deployments/my-deployment/yaml

# 获取资源事件
GET /api/v1/namespaces/default/pods/my-pod/events
GET /api/v1/namespaces/apps/deployments/my-deployment/events
```

### 3. 集群级别资源的路径模式

集群级别资源（如 Node, PersistentVolume, CustomResourceDefinition）不需要命名空间：

```bash
# 列表查询
GET /api/v1/nodes?page=1&limit=10
GET /api/v1/persistentvolumes

# 详情查询
GET /api/v1/nodes/node-1
GET /api/v1/persistentvolumes/pv-1

# 原生资源
GET /api/v1/nodes/node-1/yaml
GET /api/v1/persistentvolumes/pv-1/yaml
```

### 4. Pod 特殊操作

```bash
# 获取日志
GET /api/v1/namespaces/default/pods/my-pod/logs?tailLines=100&container=my-container

# 获取事件
GET /api/v1/namespaces/default/pods/my-pod/events
```

### 5. CRUD 操作（直接操作 K8s）

#### 创建资源

```bash
# 创建命名空间资源
POST /api/v1/namespaces/default/configmaps
Body: {
  "kind": "ConfigMap",
  "metadata": {
    "name": "my-config",
    "namespace": "default"
  },
  "data": {}
}

# 创建集群级别资源
POST /api/v1/persistentvolumes
Body: {...}
```

#### 更新资源

```bash
# 更新命名空间资源
PUT /api/v1/namespaces/default/configmaps/my-config
Body: {...}

# 更新集群级别资源
PUT /api/v1/persistentvolumes/pv-1
Body: {...}
```

#### 删除资源

```bash
# 删除命名空间资源
DELETE /api/v1/namespaces/default/configmaps/my-config

# 删除集群级别资源
DELETE /api/v1/persistentvolumes/pv-1
```

## 实际使用示例

### 示例 1：获取 ConfigMap（你的用例）

```bash
# 从 MongoDB 查询（快速）
curl http://localhost:3000/api/v1/namespaces/apps/configmaps/firecrawl-config

# 从 K8s API 查询（实时）
curl http://localhost:3000/api/v1/namespaces/apps/configmaps/firecrawl-config/yaml
```

### 示例 2：列出所有命名空间的 Pods

```bash
# 方式 1：使用查询参数
curl "http://localhost:3000/api/v1/pods?page=1&limit=20"

# 方式 2：指定命名空间
curl "http://localhost:3000/api/v1/namespaces/default/pods?page=1&limit=20"
```

### 示例 3：获取 Pod 日志

```bash
curl "http://localhost:3000/api/v1/namespaces/default/pods/my-pod/logs?tailLines=100"
```

## 技术实现

### 修改的文件

1. **generic-routes.ts** - 数据库查询路由
   - 修改详情路由：从 `/api/v1/{resource}/:id` 改为 `/api/v1/namespaces/:namespace/{resource}/:name`
   - 修改列表路由：添加 `/api/v1/namespaces/:namespace/{resource}` 路径
   - 支持两种查询方式：路径参数和查询参数

2. **k8s-native-routes.ts** - K8s 原生操作路由
   - 重写所有路由以符合 K8s 原生路径格式
   - 统一命名空间资源和集群资源的路径模式
   - 改进错误消息和验证

3. **routes.ts** - API 文档
   - 更新 API 注册表以反映新的路径格式
   - 添加详细的使用示例

### 路由优先级

为了避免路由冲突，路由按以下顺序匹配：

1. 特定路由（如 Pod logs, events）优先
2. 命名空间资源路由（`/namespaces/:namespace/:resource/:name/...`）
3. 集群资源路由（`/:resource/:name/...`）
4. 通用列表路由（`/:resource`）

## 向后兼容性

虽然路径格式已经更改，但旧的路由仍然保留以确保向后兼容：

- `GET /api/v1/{resource}?namespace=xxx` - 仍然支持
- `GET /api/v1/namespace/:namespace/{resource}` - 仍然支持（但推荐使用 `/namespaces/`）

## 测试

项目包含测试脚本 `test-k8s-native-api.sh` 用于验证所有 API 端点：

```bash
./test-k8s-native-api.sh
```

## API 文档

完整的 API 文档可通过以下端点获取：

```bash
curl http://localhost:3000/api/v1/resources/registry
```

## 优势

1. **一致性**：与 Kubernetes 原生 API 路径格式完全一致
2. **直观性**：路径明确表达资源层级关系
3. **可扩展性**：易于添加新资源和操作
4. **双模式**：
   - 数据库模式：快速查询已同步的数据（MongoDB）
   - 原生模式：实时访问 K8s API
5. **标准化**：遵循行业标准的 RESTful API 设计

## 资源类型支持

### 命名空间资源

- Pods
- Deployments
- StatefulSets
- DaemonSets
- Services
- ConfigMaps
- Secrets
- PersistentVolumeClaims
- Ingresses
- Events

### 集群级别资源

- Nodes
- PersistentVolumes
- CustomResourceDefinitions

## 总结

这次迁移使 API 路径完全符合 Kubernetes 原生规范，提供了一致、直观的开发体验。无论是通过数据库查询还是直接访问 K8s API，都使用相同的路径模式，降低了学习成本并提高了 API 的易用性。
