#!/bin/bash

# 验证 monorepo 结构

echo "🔍 验证 Monorepo 结构..."
echo ""

# 检查必需的目录
echo "📁 检查目录结构..."
dirs=("packages/schema" "packages/core" "packages/schema/src" "packages/core/src")
for dir in "${dirs[@]}"; do
  if [ -d "$dir" ]; then
    echo "  ✅ $dir"
  else
    echo "  ❌ $dir (缺失)"
    exit 1
  fi
done

echo ""
echo "📄 检查关键文件..."

# 检查 schema 包
files=(
  "packages/schema/src/schema.ts"
  "packages/schema/src/index.ts"
  "packages/schema/package.json"
  "packages/schema/tsconfig.json"
  "packages/schema/README.md"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (缺失)"
    exit 1
  fi
done

# 检查 core 包
files=(
  "packages/core/keystone.ts"
  "packages/core/auth.ts"
  "packages/core/package.json"
  "packages/core/tsconfig.json"
  "packages/core/README.md"
  "packages/core/schema.prisma"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (缺失)"
    exit 1
  fi
done

echo ""
echo "📦 检查 workspace 配置..."
if grep -q '"workspaces"' package.json; then
  echo "  ✅ package.json 包含 workspaces 配置"
else
  echo "  ❌ package.json 缺少 workspaces 配置"
  exit 1
fi

echo ""
echo "🔗 检查依赖关系..."
if grep -q '@k8s-adapter/schema' packages/core/package.json; then
  echo "  ✅ core 包依赖 schema 包"
else
  echo "  ❌ core 包缺少对 schema 包的依赖"
  exit 1
fi

echo ""
echo "✨ Monorepo 结构验证完成！"
echo ""
echo "下一步："
echo "  1. 运行 'npm install' 安装依赖"
echo "  2. 运行 'npm run dev' 启动开发服务器"
