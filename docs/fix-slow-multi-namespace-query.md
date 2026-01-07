# 修复多命名空间查询慢的问题

## 问题描述

查询多个命名空间时非常慢（12+ 秒）：

```
[API] Query completed in 12310ms, found 10 items
```

## 原因

查询使用了 `sort({ createdAt: -1 })`，但缺少复合索引 `{ namespace: 1, createdAt: -1 }`，导致：

1. MongoDB 必须扫描所有文档
2. 在内存中排序
3. 性能极差

## 解决方案（3 步）

### 步骤 1: 启动 MongoDB

```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# 验证 MongoDB 运行中
ps aux | grep mongod
```

### 步骤 2: 创建复合索引

```bash
# 运行索引创建脚本
node scripts/create-compound-index.js
```

预期输出：

```
🔌 Connecting to MongoDB...
✅ Connected!

📊 Creating compound indexes for multi-namespace queries:
========================================================

➕ secrets: Creating index...
✅ secrets: Index created successfully
➕ pods: Creating index...
✅ pods: Index created successfully
...

🎉 Done! Indexes created.

📝 Expected performance improvement:
   Before: ~12,000ms (12 seconds)
   After:  ~50-100ms
   Gain:   ~120x faster!
```

### 步骤 3: 重启应用并测试

```bash
# 重启应用
pnpm dev

# 等待应用启动后，在另一个终端测试
curl "http://localhost:3000/api/v1/secrets?namespaces=apps,kube-system&limit=10"
```

预期结果：

```
[API] Query completed in 45ms, found 10 items  # 从 12310ms 降到 45ms!
[API] Count completed in 63ms, total: 32
```

## 手动创建索引（备选方案）

如果脚本运行失败，可以用 MongoDB Shell 手动创建：

```bash
# 连接到 MongoDB
mongosh

# 切换到数据库
use k8s-resources

# 为每个集合创建索引
db.secrets.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.pods.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.deployments.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.services.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.configmaps.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.daemonsets.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.statefulsets.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.ingresses.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.persistentvolumeclaims.createIndex({ namespace: 1, createdAt: -1 }, { background: true })
db.events.createIndex({ namespace: 1, createdAt: -1 }, { background: true })

# 验证索引已创建
db.secrets.getIndexes()
```

## 验证索引生效

在 MongoDB Shell 中检查查询计划：

```javascript
use k8s-resources

db.secrets.find({ namespace: { $in: ['apps', 'kube-system'] } })
  .sort({ createdAt: -1 })
  .limit(10)
  .explain('executionStats')
```

查找：

- `winningPlan.stage` 应该是 `IXSCAN`（索引扫描），而不是 `COLLSCAN`（全表扫描）
- `executionStats.totalDocsExamined` 应该接近 10（返回的文档数），而不是整个集合的大小

## 性能对比

| 指标     | 优化前   | 优化后    | 改善     |
| -------- | -------- | --------- | -------- |
| 查询时间 | 12,310ms | ~50-100ms | **120x** |
| 扫描类型 | 全表扫描 | 索引扫描  | ✓        |
| 内存排序 | 需要     | 不需要    | ✓        |
| 用户体验 | 超时     | 即时响应  | ✓        |

## 新模型自动包含索引

已更新 [k8s-schema-helper.ts](../packages/core/src/lib/k8s-schema-helper.ts)，所有新创建的模型都会自动包含此复合索引。

## 故障排除

### 问题：脚本提示 "Collection does not exist"

**解决**：先运行应用创建集合，再运行索引脚本

```bash
pnpm dev  # 在一个终端
# 等待启动完成
node scripts/create-compound-index.js  # 在另一个终端
```

### 问题：脚本提示 "connect ECONNREFUSED"

**解决**：启动 MongoDB 服务

```bash
brew services start mongodb-community  # macOS
sudo systemctl start mongod  # Linux
```

### 问题：索引创建后仍然慢

**解决**：重启应用，MongoDB 需要重新加载查询计划

```bash
# 停止应用 (Ctrl+C)
pnpm dev
```

## 技术细节

复合索引 `{ namespace: 1, createdAt: -1 }` 的工作原理：

1. **索引结构**：将文档按 namespace 分组，每组内按 createdAt 倒序排列
2. **查询优化**：
   - `namespace: { $in: [...] }` - 直接定位到相关 namespace
   - `sort({ createdAt: -1 })` - 索引已经有序，无需内存排序
   - `limit(10)` - 直接返回前 10 个，无需扫描全部

## 相关文档

- [MongoDB 复合索引](https://www.mongodb.com/docs/manual/indexes/#compound-indexes)
- [查询优化](https://www.mongodb.com/docs/manual/tutorial/optimize-query-performance-with-indexes-and-projections/)
- [explain() 方法](https://www.mongodb.com/docs/manual/reference/method/explain/)
