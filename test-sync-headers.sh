#!/bin/bash

# Test script to verify sync status headers are properly added
# Tests both old and new K8s native path patterns

BASE_URL="http://localhost:3000/api/v1"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "Testing Sync Status Headers"
echo "========================================"
echo ""

# Function to check headers
test_headers() {
  local description=$1
  local endpoint=$2

  echo -e "${BLUE}Testing: ${description}${NC}"
  echo -e "URL: ${BASE_URL}${endpoint}"
  echo ""

  # Get response headers
  headers=$(curl -s -I -X GET "${BASE_URL}${endpoint}")

  # Check for sync status headers
  x_sync_resource=$(echo "$headers" | grep -i "X-Sync-Resource" | cut -d' ' -f2 | tr -d '\r')
  x_sync_status=$(echo "$headers" | grep -i "X-Sync-Status" | cut -d' ' -f2 | tr -d '\r')
  x_sync_count=$(echo "$headers" | grep -i "X-Sync-Count" | cut -d' ' -f2 | tr -d '\r')

  if [ -n "$x_sync_resource" ]; then
    echo -e "${GREEN}✅ X-Sync-Resource: ${x_sync_resource}${NC}"
  else
    echo -e "${RED}❌ X-Sync-Resource header missing!${NC}"
  fi

  if [ -n "$x_sync_status" ]; then
    echo -e "${GREEN}✅ X-Sync-Status: ${x_sync_status}${NC}"
  else
    echo -e "${RED}❌ X-Sync-Status header missing!${NC}"
  fi

  if [ -n "$x_sync_count" ]; then
    echo -e "${GREEN}✅ X-Sync-Count: ${x_sync_count}${NC}"
  else
    echo -e "${YELLOW}⚠️  X-Sync-Count header not present (may be 0 or syncing)${NC}"
  fi

  echo ""
  echo "----------------------------------------"
  echo ""
}

# =============================================================================
# Test K8s Native Path Patterns (NEW)
# =============================================================================

echo -e "${YELLOW}=== K8s Native Path Patterns ===${NC}"
echo ""

test_headers \
  "List pods in namespace (K8s native)" \
  "/namespaces/default/pods"

test_headers \
  "List ConfigMaps in apps namespace (K8s native)" \
  "/namespaces/apps/configmaps"

test_headers \
  "Get specific pod by namespace and name (K8s native)" \
  "/namespaces/default/pods/my-pod"

test_headers \
  "Get specific ConfigMap (K8s native - your use case)" \
  "/namespaces/apps/configmaps/firecrawl-config"

test_headers \
  "List Deployments in kube-system (K8s native)" \
  "/namespaces/kube-system/deployments"

# =============================================================================
# Test Legacy Path Patterns
# =============================================================================

echo -e "${YELLOW}=== Legacy Path Patterns ===${NC}"
echo ""

test_headers \
  "List pods with query param" \
  "/pods?namespace=default"

test_headers \
  "List all ConfigMaps" \
  "/configmaps?namespace=apps"

# =============================================================================
# Test Cluster-Scoped Resources
# =============================================================================

echo -e "${YELLOW}=== Cluster-Scoped Resources ===${NC}"
echo ""

test_headers \
  "List all nodes" \
  "/nodes"

test_headers \
  "Get specific node" \
  "/nodes/node-1"

# =============================================================================
# Summary
# =============================================================================

echo "========================================"
echo -e "${BLUE}Expected Behavior${NC}"
echo "========================================"
echo ""
echo "All resource endpoints should have:"
echo "  - X-Sync-Resource: Resource name (e.g., 'Pod', 'ConfigMap')"
echo "  - X-Sync-Status: Sync status ('synced', 'syncing', 'error', 'unknown')"
echo "  - X-Sync-Count: Number of synced items (if available)"
echo ""
echo "Non-resource endpoints (like /health) should NOT have sync headers."
echo ""
echo "========================================"
