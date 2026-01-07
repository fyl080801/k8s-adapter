# 项目结构

## Monorepo 布局

```
k8s-adapter/
├── packages/
│   ├── schema/              # Keystone 数据模型定义
│   │   ├── src/
│   │   │   ├── schema.ts    # List 定义 (User, Post, Tag, SyncState)
│   │   │   └── index.ts     # 导出点
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── core/                # 核心应用服务
│       ├── src/
│       │   ├── api/         # RESTful API 路由
│       │   ├── k8s/         # Kubernetes Informer 集成
│       │   ├── lib/         # 工具库 (MongoDB, K8s client)
│       │   ├── middleware/  # Express 中间件
│       │   └── models/      # Mongoose 模型
│       ├── scripts/         # 测试脚本
│       ├── keystone.ts      # 入口文件
│       ├── auth.ts          # 认证配置
│       ├── schema.prisma    # Prisma schema
│       └── package.json
│
├── .env                     # 环境变量
├── .gitignore
├── package.json             # 根 workspace 配置
├── tsconfig.json            # TypeScript 配置
├── README.md                # 项目说明
├── MIGRATION.md             # 迁移指南
└── STRUCTURE.md             # 本文件
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 启动生产服务器

```bash
npm start
```

## 可用脚本

所有脚本都在根目录执行，会自动委托给对应的包：

| 脚本                  | 说明                  |
| --------------------- | --------------------- |
| `npm run dev`         | 启动开发服务器 (core) |
| `npm run build`       | 构建生产版本 (core)   |
| `npm start`           | 启动生产服务器 (core) |
| `npm run db:generate` | 生成 Prisma 客户端    |
| `npm run test:api`    | 测试 API 端点         |
| `npm run lint`        | 代码检查              |
| `npm run format`      | 代码格式化            |
| `npm run clean`       | 清理所有包            |

## 包说明

### @k8s-adapter/schema

- **作用**: 定义 Keystone CMS 的数据结构
- **内容**: User, Post, Tag, SyncState 等 List 定义
- **依赖**: 仅依赖 @keystone-6/core
- **可独立使用**: 是，可作为纯数据模型包导入

### @k8s-adapter/core

- **作用**: 主应用程序，提供 K8s Informer 和 API 服务
- **内容**: 业务逻辑、API 路由、K8s 集成
- **依赖**: @k8s-adapter/schema, @keystone-6/core, @kubernetes/client-node 等
- **入口**: keystone.ts

## 工作流程

1. 修改 schema: 编辑 `packages/schema/src/schema.ts`
2. 修改业务逻辑: 编辑 `packages/core/src/` 下的文件
3. 启动服务: 在根目录执行 `npm run dev`
4. 访问 Admin UI: http://localhost:3000
5. 访问 API: http://localhost:3000/api/v1

## 相关文档

- [README.md](README.md) - 项目概述和快速开始
- [MIGRATION.md](MIGRATION.md) - 从单包迁移到 monorepo 的指南
- [CLAUDE.md](CLAUDE.md) - Claude Code 开发指南
- [packages/schema/README.md](packages/schema/README.md) - Schema 包详细说明
- [packages/core/README.md](packages/core/README.md) - Core 包详细说明
