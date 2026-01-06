# 如何添加新的 K8s 资源类型

## 概述

使用通用架构，添加新的 Kubernetes 资源类型非常简单。本文档以 **PersistentVolume (PV)** 和 **CustomResourceDefinition (CRD)** 为例，说明完整的添加过程。

## 步骤总览

只需要 **2 个步骤**：

1. 创建 Mongoose Model
2. 在 `types.ts` 中添加配置

## 详细步骤

### 步骤 1: 创建 Mongoose Model

在 `src/models/` 目录下创建 Model 文件。

#### 示例 1: PersistentVolume Model

创建文件 [src/models/PersistentVolume.ts](src/models/PersistentVolume.ts):

```typescript
import mongoose, { Schema, Document } from 'mongoose'

export interface IPersistentVolume extends Document {
  name: string
  uid: string
  resourceVersion: string
  labels: Record<string, string>
  annotations: Record<string, string>
  phase: string
  capacity: Record<string, string>
  accessModes: string[]
  persistentVolumeReclaimPolicy: string
  storageClass: string
  claimRef: {
    name: string
    namespace: string
  } | null
  reason: string
  raw: any
  createdAt: Date
  updatedAt: Date
}

const PersistentVolumeSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    uid: { type: String, required: true },
    resourceVersion: { type: String, required: true },
    labels: { type: Map, of: String, default: {} },
    annotations: { type: Map, of: String, default: {} },
    phase: { type: String },
    capacity: { type: Map, of: String, default: {} },
    accessModes: { type: [String], default: [] },
    persistentVolumeReclaimPolicy: { type: String },
    storageClass: { type: String },
    claimRef: {
      name: String,
      namespace: String,
    },
    reason: { type: String },
    raw: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  },
)

PersistentVolumeSchema.index({ name: 1 })

export default mongoose.models.PersistentVolume ||
  mongoose.model<IPersistentVolume>('PersistentVolume', PersistentVolumeSchema)
```

#### 示例 2: CustomResourceDefinition Model

创建文件 [src/models/CustomResourceDefinition.ts](src/models/CustomResourceDefinition.ts):

```typescript
import mongoose, { Schema, Document } from 'mongoose'

export interface ICustomResourceDefinition extends Document {
  name: string
  uid: string
  resourceVersion: string
  labels: Record<string, string>
  annotations: Record<string, string>
  group: string
  version: string
  scope: string
  names: {
    plural: string
    singular: string
    kind: string
    shortNames?: string[]
    listKind?: string
    categories?: string[]
  }
  versions: Array<{
    name: string
    served: boolean
    storage: boolean
    deprecated?: boolean
  }>
  conversion: {
    strategy: string
  } | null
  preservationUnknownFields: boolean
  raw: any
  createdAt: Date
  updatedAt: Date
}

const CustomResourceDefinitionSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    uid: { type: String, required: true },
    resourceVersion: { type: String, required: true },
    labels: { type: Map, of: String, default: {} },
    annotations: { type: Map, of: String, default: {} },
    group: { type: String },
    version: { type: String },
    scope: { type: String },
    names: {
      plural: { type: String },
      singular: { type: String },
      kind: { type: String },
      shortNames: { type: [String] },
      listKind: { type: String },
      categories: { type: [String] },
    },
    versions: {
      type: [
        new Schema(
          {
            name: { type: String },
            served: { type: Boolean },
            storage: { type: Boolean },
            deprecated: { type: Boolean },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    conversion: {
      strategy: { type: String },
    },
    preservationUnknownFields: { type: Boolean },
    raw: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  },
)

CustomResourceDefinitionSchema.index({ name: 1 })
CustomResourceDefinitionSchema.index({ group: 1 })

export default mongoose.models.CustomResourceDefinition ||
  mongoose.model<ICustomResourceDefinition>(
    'CustomResourceDefinition',
    CustomResourceDefinitionSchema,
  )
```

### 步骤 2: 在 types.ts 中添加配置

编辑 [src/k8s/types.ts](src/k8s/types.ts):

#### 2.1 导入 Model

在文件顶部添加导入：

```typescript
import PersistentVolume from '../models/PersistentVolume'
import CustomResourceDefinition from '../models/CustomResourceDefinition'
```

#### 2.2 添加资源配置

在 `RESOURCE_CONFIGS` 数组中添加配置对象：

```typescript
export const RESOURCE_CONFIGS: K8sResourceConfig[] = [
  // ... 现有资源配置 ...

  // PersistentVolume 配置
  {
    name: 'PersistentVolume',
    apiVersion: 'v1',
    kind: 'PersistentVolume',
    plural: 'persistentvolumes',
    namespaced: false, // PV 是集群级别资源
    model: PersistentVolume,
    icon: '💿',
    getIdKey: () => 'name', // 使用 name 作为唯一标识
    transformer: pv => ({
      name: pv.metadata?.name,
      uid: pv.metadata?.uid,
      resourceVersion: pv.metadata?.resourceVersion,
      labels: pv.metadata?.labels || {},
      annotations: pv.metadata?.annotations || {},
      phase: pv.status?.phase,
      capacity: pv.spec?.capacity || {},
      accessModes: pv.spec?.accessModes || [],
      persistentVolumeReclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy,
      storageClass: pv.spec?.storageClassName,
      claimRef: pv.spec?.claimRef
        ? {
            name: pv.spec.claimRef.name,
            namespace: pv.spec.claimRef.namespace,
          }
        : null,
      reason: pv.status?.reason,
      raw: pv,
    }),
  },

  // CustomResourceDefinition 配置
  {
    name: 'CustomResourceDefinition',
    apiVersion: 'apiextensions.k8s.io/v1',
    kind: 'CustomResourceDefinition',
    plural: 'customresourcedefinitions',
    namespaced: false, // CRD 是集群级别资源
    model: CustomResourceDefinition,
    icon: '🔧',
    getIdKey: () => 'name', // 使用 name 作为唯一标识
    transformer: crd => ({
      name: crd.metadata?.name,
      uid: crd.metadata?.uid,
      resourceVersion: crd.metadata?.resourceVersion,
      labels: crd.metadata?.labels || {},
      annotations: crd.metadata?.annotations || {},
      group: crd.spec?.group,
      version: crd.spec?.version,
      scope: crd.spec?.scope,
      names: {
        plural: crd.spec?.names?.plural,
        singular: crd.spec?.names?.singular,
        kind: crd.spec?.names?.kind,
        shortNames: crd.spec?.names?.shortNames || [],
        listKind: crd.spec?.names?.listKind,
        categories: crd.spec?.names?.categories || [],
      },
      versions: (crd.spec?.versions || []).map((v: any) => ({
        name: v.name,
        served: v.served,
        storage: v.storage,
        deprecated: v.deprecated,
      })),
      conversion: crd.spec?.conversion
        ? {
            strategy: crd.spec.conversion.strategy,
          }
        : null,
      preservationUnknownFields: crd.spec?.preserveUnknownFields,
      raw: crd,
    }),
  },
]
```

### 步骤 3: (可选) 添加新的 API 组支持

如果资源使用的是新的 API 组（例如 `apiextensions.k8s.io`），需要在 `generic-sync.ts` 中添加支持：

```typescript
// src/k8s/generic-sync.ts

private k8sApi: {
  coreV1Api: k8s.CoreV1Api;
  appsV1Api: k8s.AppsV1Api;
  batchV1Api: k8s.BatchV1Api;
  networkingV1Api: k8s.NetworkingV1Api;
  apiextensionsV1Api: k8s.ApiextensionsV1Api;  // 新增
};

// 在构造函数中初始化
this.k8sApi = {
  // ... 其他 API
  apiextensionsV1Api: kc.makeApiClient(k8s.ApiextensionsV1Api),
};

// 在 getApi 方法中添加 case
private getApi(apiGroup: string): any {
  switch (apiGroup) {
    // ... 其他 case
    case 'apiextensions.k8s.io':
      return this.k8sApi.apiextensionsV1Api;
    default:
      throw new Error(`Unsupported API group: ${apiGroup}`);
  }
}
```

## 完成！

添加完配置后，所有功能会自动生成：

✅ **全量同步**: 应用启动时自动同步所有 PV 和 CRD
✅ **实时 watch**: 自动监听 PV 和 CRD 的变更
✅ **RESTful API**:

- `GET /api/v1/persistentvolumes` - 列出所有 PV
- `GET /api/v1/persistentvolumes/:name` - 获取特定 PV
- `GET /api/v1/customresourcedefinitions` - 列出所有 CRD
- `GET /api/v1/customresourcedefinitions/:name` - 获取特定 CRD

## 验证

构建项目检查是否成功：

```bash
npm run build
```

你应该看到：

```
✅ Generated routes for PersistentVolume:
   GET    /api/v1/persistentvolumes
   GET    /api/v1/persistentvolumes/:id

✅ Generated routes for CustomResourceDefinition:
   GET    /api/v1/customresourcedefinitions
   GET    /api/v1/customresourcedefinitions/:id
```

## 配置项说明

| 字段          | 说明                      | 示例                                                 |
| ------------- | ------------------------- | ---------------------------------------------------- |
| `name`        | 资源名称（单数）          | `'PersistentVolume'`                                 |
| `apiVersion`  | K8s API 版本              | `'v1'` 或 `'apps/v1'` 或 `'apiextensions.k8s.io/v1'` |
| `kind`        | K8s Kind                  | `'PersistentVolume'`                                 |
| `plural`      | 复数形式（用于 API 路径） | `'persistentvolumes'`                                |
| `namespaced`  | 是否命名空间 scoped       | `false` (集群级别) 或 `true` (命名空间级别)          |
| `model`       | Mongoose Model            | `PersistentVolume`                                   |
| `icon`        | 日志图标                  | `'💿'`                                               |
| `getIdKey`    | 唯一标识字段              | `() => 'name'` 或 `() => 'uid'`                      |
| `transformer` | K8s 对象转换函数          | `(pv) => ({ ... })`                                  |

## 常见 API 组

| API 组         | apiVersion 值                    | 资源示例                                              |
| -------------- | -------------------------------- | ----------------------------------------------------- |
| Core           | `'v1'`                           | Pod, Service, Node, PV, PVC, ConfigMap, Secret, Event |
| Apps           | `'apps/v1'`                      | Deployment, StatefulSet, DaemonSet, ReplicaSet        |
| Batch          | `'batch/v1'`                     | Job, CronJob                                          |
| Networking     | `'networking.k8s.io/v1'`         | Ingress, NetworkPolicy                                |
| Storage        | `'storage.k8s.io/v1'`            | StorageClass, VolumeAttachment                        |
| RBAC           | `'rbac.authorization.k8s.io/v1'` | Role, ClusterRole, RoleBinding, ClusterRoleBinding    |
| API Extensions | `'apiextensions.k8s.io/v1'`      | CustomResourceDefinition                              |

## 更多示例

查看已实现的资源配置：

- [Pod](src/k8s/types.ts#L78) - Core v1 资源
- [Deployment](src/k8s/types.ts#L262) - Apps/v1 资源
- [Ingress](src/k8s/types.ts#L343) - Networking 资源
- [PersistentVolume](src/k8s/types.ts#L429) - 集群级别资源
- [CustomResourceDefinition](src/k8s/types.ts#L386) - API Extensions 资源

## 总结

使用通用架构添加新资源：

- ✅ 只需修改 2 个文件（Model + types.ts）
- ✅ 无需编写重复的 sync/informer/routes 代码
- ✅ 所有功能自动生成
- ✅ 类型安全，易于维护

**核心价值**: 从 ~150 行代码 + 4 个文件 → ~15 行配置 + 2 个文件
