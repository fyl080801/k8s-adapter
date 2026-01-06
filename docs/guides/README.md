# Development Guides

This directory contains step-by-step guides for common development tasks.

## 📖 Available Guides

### Adding New Resources

- **[ADD_NEW_RESOURCES.md](ADD_NEW_RESOURCES.md)** - 完整的添加新 K8s 资源类型指南（中文）

  本指南说明如何使用通用架构添加新的 Kubernetes 资源类型，包含完整示例：
  - 如何创建 Mongoose Model
  - 如何在 `types.ts` 中注册资源
  - 自动生成的功能（同步、监控、API）
  - 实际案例：PersistentVolume, CustomResourceDefinition

  **适用于：** 需要添加新 K8s 资源的开发者

### TypeScript Type System

- **[K8S_TYPES_MIGRATION.md](K8S_TYPES_MIGRATION.md)** - 使用官方 K8s TypeScript 类型定义

  本指南详细介绍如何使用 `@kubernetes/client-node` 包中的官方类型：
  - 为什么要使用官方类型
  - 如何导入和使用 K8s 类型
  - 类型安全的 schema 定义
  - 辅助工具函数的使用
  - 迁移现有代码的步骤

  **适用于：** 需要理解类型系统的开发者

## 🎯 Quick Start

### 添加新资源

1. 阅读 [ADD_NEW_RESOURCES.md](ADD_NEW_RESOURCES.md)
2. 创建 Mongoose Model
3. 在 `types.ts` 注册配置
4. 完成！自动获得同步、监控、API 功能

### 理解类型系统

1. 阅读 [K8S_TYPES_MIGRATION.md](K8S_TYPES_MIGRATION.md)
2. 查看 [src/lib/k8s-schema-helper.ts](../../src/lib/k8s-schema-helper.ts)
3. 参考现有 Model 的实现

## 💡 Best Practices

### 遵循官方 K8s 类型

```typescript
// ✅ 推荐：使用官方类型
import type { V1Pod } from '@kubernetes/client-node'

const pod = apiObj as V1Pod

// ❌ 避免：使用 any
const pod = apiObj as any
```

### 使用辅助函数

```typescript
// ✅ 推荐：使用类型安全的辅助函数
const name = getMetadataString(pod, 'name')
const namespace = getMetadataString(pod, 'namespace')

// ❌ 避免：手动访问可选属性
const name = pod.metadata?.name
```

### 完整的 Transformer 示例

```typescript
transformer: (pod: V1Pod) => ({
  namespace: pod.metadata?.namespace,
  name: pod.metadata?.name,
  uid: pod.metadata?.uid,
  phase: pod.status?.phase,
  podIP: pod.status?.podIP,
  // 使用辅助函数
  labels: getMetadataLabels(pod),
  annotations: getMetadataAnnotations(pod),
  // 保存原始对象
  raw: pod,
})
```

## 📚 Additional Resources

### Key Files

- **[../../src/k8s/types.ts](../../src/k8s/types.ts)** - 资源配置注册表
- **[../../src/lib/k8s-schema-helper.ts](../../src/lib/k8s-schema-helper.ts)** - 类型安全辅助函数
- **[../../src/k8s/generic-sync.ts](../../src/k8s/generic-sync.ts)** - 通用同步逻辑
- **[../../src/k8s/generic-informer.ts](../../src/k8s/generic-informer.ts)** - 通用监控处理
- **[../../src/api/generic-routes.ts](../../src/api/generic-routes.ts)** - 自动生成的 API 路由

### Related Documentation

- **[../PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)** - 项目架构说明
- **[../OPTIMIZATION.md](../OPTIMIZATION.md)** - 性能优化最佳实践
- **[../../CLAUDE.md](../../CLAUDE.md)** - AI 辅助开发指南

## 🤝 Contributing

添加新指南时，请遵循以下原则：

1. **清晰明确** - 使用简洁的语言和具体示例
2. **循序渐进** - 按步骤组织内容
3. **代码示例** - 提供完整可运行的代码
4. **中英双语** - 重要概念使用双语说明
5. **保持更新** - 与代码实现保持同步

---

**需要帮助？** 查看主文档 [../README.md](../README.md) 或项目根目录 [../../README.md](../../README.md)
