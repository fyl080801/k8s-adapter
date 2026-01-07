#!/bin/bash
cd /Users/fengyuanliang2/Source/test/k8s-test/packages/core

# Start dev server in background
pnpm dev > /tmp/k8s-test.log 2>&1 &
DEV_PID=$!

echo "Started dev server with PID: $DEV_PID"
echo "Waiting 20 seconds for startup..."
sleep 20

# Check if process is still running
if ps -p $DEV_PID > /dev/null; then
  echo "✅ Server is still running"

  # Check logs
  echo ""
  echo "=== Last 50 lines of log ==="
  tail -50 /tmp/k8s-test.log

  # Try health endpoint
  echo ""
  echo "=== Testing health endpoint ==="
  curl -s http://localhost:3000/api/v1/health | jq . || echo "Health check failed"

  # Test API
  echo ""
  echo "=== Testing pods endpoint ==="
  curl -s http://localhost:3000/api/v1/pods?limit=5 | jq .data[0].name || echo "API test failed"
else
  echo "❌ Server died"
  echo ""
  echo "=== Full log ==="
  cat /tmp/k8s-test.log
fi

# Cleanup
kill $DEV_PID 2>/dev/null || true
