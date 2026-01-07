#!/bin/bash

# Test script for sync status features

echo "========================================="
echo "Testing Sync Status Features"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000/api/v1"

echo -e "${BLUE}1. Testing Health Check Endpoint${NC}"
echo "GET /health"
curl -s "$BASE_URL/health" | jq '.' 2>/dev/null || curl -s "$BASE_URL/health"
echo -e "\n"

echo -e "${BLUE}2. Testing Sync Status Endpoint${NC}"
echo "GET /sync/status"
curl -s "$BASE_URL/sync/status" | jq '.' 2>/dev/null || curl -s "$BASE_URL/sync/status"
echo -e "\n"

echo -e "${BLUE}3. Checking Response Headers${NC}"
echo "GET /pods (checking X-Sync-Status headers)"
response_headers=$(curl -s -I "$BASE_URL/pods")
echo "$response_headers" | grep -i "X-Sync" || echo "No sync headers found"
echo -e "\n"

echo -e "${BLUE}4. Testing During Sync (if sync is in progress)${NC}"
echo "The following headers should appear during sync:"
echo "  - X-Sync-Status: in_progress"
echo "  - X-Sync-Step: cleanup|sync|informer"
echo "  - X-Sync-Progress: 0/11 (for example)"
echo -e "\n"

echo -e "${BLUE}5. Testing After Sync Complete${NC}"
echo "The following headers should appear after sync:"
echo "  - X-Sync-Status: completed"
echo "  - X-Sync-Duration: XXXms"
echo -e "\n"

echo -e "${GREEN}========================================="
echo "Test Complete!"
echo "=========================================${NC}"
echo ""
echo "Usage Tips:"
echo "- Start the app with: npm run dev"
echo "- Check sync status immediately after startup"
echo "- Monitor headers during sync: watch -n 2 'curl -s -I http://localhost:3000/api/v1/pods | grep X-Sync'"
echo "- Use the /api/v1/sync/status endpoint in your app UI"
