# 🚀 快速开始指南

## 项目已成功转换为 Monorepo 结构

### 📁 当前结构

```
k8s-adapter/
├── packages/
│   ├── schema/          # 数据模型定义 (Keystone Lists)
│   └── core/            # 主应用服务 (K8s Informer + API)
├── scripts/             # 工具脚本
├── .env                 # 环境配置
└── package.json         # Workspace 配置
```

### ✅ 验证步骤

1. **验证结构**

   ```bash
   npm run verify
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

### 📝 常用命令

| 命令             | 说明               |
| ---------------- | ------------------ |
| `npm run verify` | 验证 monorepo 结构 |
| `npm install`    | 安装所有包的依赖   |
| `npm run dev`    | 启动开发服务器     |
| `npm run build`  | 构建生产版本       |
| `npm start`      | 启动生产服务器     |
| `npm run lint`   | 代码检查           |
| `npm run format` | 代码格式化         |

### 🎯 核心特性

- **📦 Monorepo 结构**: Schema 和 Core 分离
- **🔗 Workspace 依赖**: Core 自动引用 Schema
- **⚡ Hot Reload**: 开发模式支持热更新
- **🔧 类型安全**: 完整的 TypeScript 支持

### 📖 详细文档

- [STRUCTURE.md](STRUCTURE.md) - 项目结构详解
- [MIGRATION.md](MIGRATION.md) - 迁移指南
- [README.md](README.md) - 完整文档

### 🐛 遇到问题？

1. **依赖安装失败**

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **类型错误**

   ```bash
   npm run build --workspace=packages/schema
   ```

3. **端口被占用**
   - 修改 `.env` 中的端口配置
   - 或停止占用 3000 端口的进程

---

**验证通过后，运行 `npm run dev` 即可开始开发！**
