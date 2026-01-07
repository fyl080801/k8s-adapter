#!/bin/bash

# Test script for resource-specific sync status headers
# This script verifies that resource requests return correct sync status headers

BASE_URL="http://localhost:3000"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing Resource-Specific Sync Status Headers${NC}"
echo "========================================="
echo ""

# Test 1: Pods endpoint
echo -e "${BLUE}1. Testing /api/v1/pods${NC}"
echo "GET /api/v1/pods"
echo ""
response=$(curl -i -s "$BASE_URL/api/v1/pods" 2>&1)
headers=$(echo "$response" | head -20)
body=$(echo "$response" | tail -n +$(echo "$response" | grep -n "^{" | cut -d: -f1 | head -1))

echo "Response Headers:"
echo "$headers" | grep -i "x-sync" || echo -e "${RED}No X-Sync headers found!${NC}"
echo ""

# Test 2: Pods with namespace querystring
echo -e "${BLUE}2. Testing /api/v1/pods?namespace=default${NC}"
echo "GET /api/v1/pods?namespace=default"
echo ""
response=$(curl -i -s "$BASE_URL/api/v1/pods?namespace=default" 2>&1)
headers=$(echo "$response" | head -20)

echo "Response Headers:"
echo "$headers" | grep -i "x-sync" || echo -e "${RED}No X-Sync headers found!${NC}"
echo ""

# Test 3: Namespace path pattern
echo -e "${BLUE}3. Testing /api/v1/namespace/default/pods${NC}"
echo "GET /api/v1/namespace/default/pods"
echo ""
response=$(curl -i -s "$BASE_URL/api/v1/namespace/default/pods" 2>&1)
headers=$(echo "$response" | head -20)

echo "Response Headers:"
echo "$headers" | grep -i "x-sync" || echo -e "${RED}No X-Sync headers found!${NC}"
echo ""

# Test 4: Deployments endpoint
echo -e "${BLUE}4. Testing /api/v1/deployments${NC}"
echo "GET /api/v1/deployments"
echo ""
response=$(curl -i -s "$BASE_URL/api/v1/deployments" 2>&1)
headers=$(echo "$response" | head -20)

echo "Response Headers:"
echo "$headers" | grep -i "x-sync" || echo -e "${RED}No X-Sync headers found!${NC}"
echo ""

# Test 5: Nodes endpoint (cluster-scoped)
echo -e "${BLUE}5. Testing /api/v1/nodes${NC}"
echo "GET /api/v1/nodes"
echo ""
response=$(curl -i -s "$BASE_URL/api/v1/nodes" 2>&1)
headers=$(echo "$response" | head -20)

echo "Response Headers:"
echo "$headers" | grep -i "x-sync" || echo -e "${RED}No X-Sync headers found!${NC}"
echo ""

# Test 6: Health endpoint (should NOT have resource-specific headers)
echo -e "${BLUE}6. Testing /api/v1/health${NC}"
echo "GET /api/v1/health"
echo ""
response=$(curl -i -s "$BASE_URL/api/v1/health" 2>&1)
headers=$(echo "$response" | head -20)

echo "Response Headers:"
echo "$headers" | grep -i "x-sync-resource" && echo -e "${RED}ERROR: Health endpoint should not have X-Sync-Resource header!${NC}" || echo -e "${GREEN}✅ Correctly no X-Sync-Resource header on health endpoint${NC}"
echo ""

# Test 7: Sync status endpoint
echo -e "${BLUE}7. Testing /api/v1/sync/status${NC}"
echo "GET /api/v1/sync/status"
echo ""
curl -s "$BASE_URL/api/v1/sync/status" | jq '.' 2>/dev/null || curl -s "$BASE_URL/api/v1/sync/status"
echo ""

echo "========================================="
echo -e "${GREEN}Header testing complete!${NC}"
echo ""
echo "Check the server logs for debug output from:"
echo "  - [ResourceIdentifier] middleware"
echo "  - [SyncStatus] middleware"
