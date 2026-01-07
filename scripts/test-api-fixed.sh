#!/bin/bash

# Test API endpoints after fixing duplicate key error

echo "🧪 Testing API endpoints..."
echo ""

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
for i in {1..30}; do
  if curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
    echo "✅ Server is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ Server failed to start"
    exit 1
  fi
  sleep 1
done

echo ""
echo "📊 Testing deployments endpoint..."
curl -s http://localhost:3000/api/v1/deployments | jq '{
  total: .pagination.total,
  pages: .pagination.pages,
  first_item: .data[0].name
}'

echo ""
echo "📊 Testing pods endpoint..."
curl -s http://localhost:3000/api/v1/pods | jq '{
  total: .pagination.total,
  first_pod: .data[0].name
}'

echo ""
echo "📊 Testing namespace filter..."
curl -s "http://localhost:3000/api/v1/deployments?namespace=apps" | jq '{
  total: .pagination.total,
  items: [.data[0].name, .data[1].name, .data[2].name]
}'

echo ""
echo "✅ All tests completed"
