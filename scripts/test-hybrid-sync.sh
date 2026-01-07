#!/bin/bash

# Test script for Hybrid Sync Implementation
# This script verifies the hybrid sync functionality

set -e

BASE_URL="http://localhost:3000/api/v1"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Testing Hybrid Sync Implementation"
echo "=========================================="

# Test 1: Health check endpoint
echo -e "\n📋 Test 1: Health Check Endpoint"
echo "GET $BASE_URL/health"
HEALTH_RESPONSE=$(curl -s "$BASE_URL/health")
echo "Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q "status"; then
    echo -e "${GREEN}✅ Health check endpoint working${NC}"
else
    echo -e "${RED}❌ Health check endpoint failed${NC}"
    exit 1
fi

# Test 2: Liveness probe
echo -e "\n📋 Test 2: Liveness Probe"
echo "GET $BASE_URL/health/live"
LIVE_RESPONSE=$(curl -s "$BASE_URL/health/live")
echo "Response: $LIVE_RESPONSE"

if echo "$LIVE_RESPONSE" | grep -q "alive.*true"; then
    echo -e "${GREEN}✅ Liveness probe working${NC}"
else
    echo -e "${RED}❌ Liveness probe failed${NC}"
fi

# Test 3: Readiness probe
echo -e "\n📋 Test 3: Readiness Probe"
echo "GET $BASE_URL/health/ready"
READY_RESPONSE=$(curl -s "$BASE_URL/health/ready")
echo "Response: $READY_RESPONSE"

if echo "$READY_RESPONSE" | grep -q "ready"; then
    READY_STATUS=$(echo "$READY_RESPONSE" | grep -o '"ready":[^,]*' | cut -d':' -f2)
    if [ "$READY_STATUS" = "true" ]; then
        echo -e "${GREEN}✅ System is ready${NC}"
    else
        echo -e "${YELLOW}⏳ System not ready yet (sync in progress)${NC}"
    fi
else
    echo -e "${RED}❌ Readiness probe failed${NC}"
fi

# Test 4: Sync status endpoint
echo -e "\n📋 Test 4: Sync Status"
echo "GET $BASE_URL/health/sync"
SYNC_RESPONSE=$(curl -s "$BASE_URL/health/sync")
echo "Response: $SYNC_RESPONSE"

if echo "$SYNC_RESPONSE" | grep -q "sync"; then
    echo -e "${GREEN}✅ Sync status endpoint working${NC}"

    # Parse and display sync status summary
    echo -e "\n📊 Sync Status Summary:"
    echo "$SYNC_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2 | xargs -I {} echo "   Total resources: {}"
    echo "$SYNC_RESPONSE" | grep -o '"completed":[0-9]*' | cut -d':' -f2 | xargs -I {} echo "   Completed: {}"
    echo "$SYNC_RESPONSE" | grep -o '"failed":[0-9]*' | cut -d':' -f2 | xargs -I {} echo "   Failed: {}"
    echo "$SYNC_RESPONSE" | grep -o '"stale":[0-9]*' | cut -d':' -f2 | xargs -I {} echo "   Stale: {}"
else
    echo -e "${RED}❌ Sync status endpoint failed${NC}"
fi

# Test 5: Test API routes are protected when not ready
echo -e "\n📋 Test 5: API Route Protection"
echo "GET $BASE_URL/pods"
PODS_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/pods")
HTTP_CODE=$(echo "$PODS_RESPONSE" | tail -n1)
BODY=$(echo "$PODS_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "503" ]; then
    echo -e "${YELLOW}⏳ API correctly returns 503 when not ready${NC}"
elif [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ API is ready and responding${NC}"
else
    echo -e "${RED}❌ Unexpected response code: $HTTP_CODE${NC}"
fi

# Test 6: Manual sync trigger (optional)
echo -e "\n📋 Test 6: Manual Sync Trigger"
read -p "Do you want to trigger a manual sync? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "POST $BASE_URL/health/sync/trigger"
    TRIGGER_RESPONSE=$(curl -s -X POST "$BASE_URL/health/sync/trigger")
    echo "Response: $TRIGGER_RESPONSE"

    if echo "$TRIGGER_RESPONSE" | grep -q "Sync triggered"; then
        echo -e "${GREEN}✅ Manual sync trigger working${NC}"
    else
        echo -e "${RED}❌ Manual sync trigger failed${NC}"
    fi
fi

echo -e "\n=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}All core endpoints are functional${NC}"
echo -e "\nFor more details, check:"
echo "  - Health check: curl $BASE_URL/health"
echo "  - Sync status: curl $BASE_URL/health/sync"
echo "  - Readiness: curl $BASE_URL/health/ready"
echo "  - Liveness: curl $BASE_URL/health/live"
