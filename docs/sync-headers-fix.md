# Sync Status Headers Fix

## 问题描述

发现使用新的 K8s 原生路径格式（如 `/api/v1/namespaces/apps/configmaps`）请求资源列表时，响应头中没有包含 `X-Sync-Status`、`X-Sync-Resource` 和 `X-Sync-Count` 等同步状态信息。

## 根本原因

`resource-identifier.ts` 中间件只支持旧的路径格式，没有识别新的 K8s 原生路径格式：

- **旧格式**：`/namespace/:namespace/{resource}`（支持）
- **新格式**：`/namespaces/:namespace/{resource}`（不支持）

导致中间件无法识别资源类型，因此无法添加同步状态响应头。

## 解决方案

### 修改文件

**[resource-identifier.ts](packages/core/src/middleware/resource-identifier.ts)**

在 `identifyResource` 函数中添加对新路径格式的支持：

```typescript
// Pattern 1: /namespaces/:namespace/{plural} (K8s native)
// Pattern 2: /namespaces/:namespace/{plural}/:name (K8s native)
const k8sNativeMatch = path.match(
  /^\/namespaces\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/,
)
if (k8sNativeMatch) {
  const namespace = k8sNativeMatch[1]
  const plural = k8sNativeMatch[2]
  // k8sNativeMatch[3] is the resource name, which we don't need for identification

  const config = RESOURCE_CONFIGS.find(c => c.plural === plural)
  if (config) {
    return {
      name: config.name,
      plural: config.plural,
      namespaced: config.namespaced,
      namespace,
    }
  }
}
```

### 路径匹配优先级

修改后的路径匹配按以下优先级进行：

1. **K8s 原生格式**（最优先）：`/namespaces/:namespace/{resource}` 和 `/namespaces/:namespace/{resource}/:name`
2. **旧格式**（向后兼容）：`/namespace/:namespace/{resource}` 和 `/namespace/:namespace/{resource}/:id`
3. **直接路径**：`/{resource}` 和 `/{resource}/:name`（支持查询参数 `?namespace=`）

## 验证

### 测试脚本

提供了测试脚本 [test-sync-headers.sh](test-sync-headers.sh) 用于验证响应头：

```bash
./test-sync-headers.sh
```

### 预期行为

所有资源端点都应包含以下响应头：

```
X-Sync-Resource: Pod
X-Sync-Status: synced
X-Sync-Count: 42
```

### 测试用例

```bash
# K8s 原生路径格式（现在应该包含响应头）
curl -I http://localhost:3000/api/v1/namespaces/default/pods
curl -I http://localhost:3000/api/v1/namespaces/apps/configmaps
curl -I http://localhost:3000/api/v1/namespaces/apps/configmaps/firecrawl-config

# 旧路径格式（仍然支持）
curl -I http://localhost:3000/api/v1/pods?namespace=default

# 集群级别资源
curl -I http://localhost:3000/api/v1/nodes
curl -I http://localhost:3000/api/v1/nodes/node-1
```

## 中间件工作流程

1. **resource-identifier** (resource-identifier.ts)
   - 识别请求路径中的资源类型
   - 提取资源名称、复数形式、命名空间等信息
   - 将信息添加到 `req.resourceInfo`

2. **sync-status-header** (sync-status.ts)
   - 从 `req.resourceInfo` 获取资源信息
   - 查询该资源的同步状态
   - 添加响应头：
     - `X-Sync-Resource`: 资源名称
     - `X-Sync-Status`: 同步状态（synced/syncing/error/unknown）
     - `X-Sync-Count`: 已同步数量（如果有）
     - `X-Sync-Error`: 错误信息（如果失败）

## 支持的路径格式

### 命名空间资源

| 路径格式                           | 示例                              | 状态                |
| ---------------------------------- | --------------------------------- | ------------------- |
| `/namespaces/:ns/{resource}`       | `/namespaces/default/pods`        | ✅ 推荐（K8s 原生） |
| `/namespaces/:ns/{resource}/:name` | `/namespaces/default/pods/my-pod` | ✅ 推荐（K8s 原生） |
| `/namespace/:ns/{resource}`        | `/namespace/default/pods`         | ✅ 支持（旧格式）   |
| `/{resource}?namespace=:ns`        | `/pods?namespace=default`         | ✅ 支持（查询参数） |

### 集群级别资源

| 路径格式            | 示例            | 状态    |
| ------------------- | --------------- | ------- |
| `/{resource}`       | `/nodes`        | ✅ 推荐 |
| `/{resource}/:name` | `/nodes/node-1` | ✅ 推荐 |

## 相关文件

- [resource-identifier.ts](packages/core/src/middleware/resource-identifier.ts) - 资源识别中间件
- [sync-status.ts](packages/core/src/middleware/sync-status.ts) - 同步状态响应头中间件
- [generic-routes.ts](packages/core/src/api/generic-routes.ts) - 数据库查询路由
- [routes.ts](packages/core/src/api/routes.ts) - 主路由配置

## 总结

✅ **问题已解决**

- 更新了 `resource-identifier.ts` 中间件以支持 K8s 原生路径格式
- 所有使用 `/namespaces/:namespace/{resource}` 的请求现在都会包含同步状态响应头
- 保持了对旧路径格式的向后兼容性
- 代码通过 lint 检查和构建测试

现在无论是使用新的 K8s 原生路径格式还是旧格式，都能正确获得 `X-Sync-Status`、`X-Sync-Resource` 和 `X-Sync-Count` 响应头信息。
