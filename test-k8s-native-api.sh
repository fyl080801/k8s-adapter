#!/bin/bash

# Test script for K8s Native API Path Patterns
# This script tests the updated API endpoints that follow Kubernetes native path conventions

BASE_URL="http://localhost:3000/api/v1"

echo "========================================"
echo "Testing K8s Native API Path Patterns"
echo "========================================"
echo ""

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to make request and display result
test_endpoint() {
  local description=$1
  local endpoint=$2
  local method=${3:-GET}

  echo -e "${BLUE}Testing: ${description}${NC}"
  echo -e "Method: ${method}"
  echo -e "URL: ${BASE_URL}${endpoint}"
  echo ""

  if [ "$method" = "GET" ]; then
    response=$(curl -s -X GET "${BASE_URL}${endpoint}" -H "Content-Type: application/json")
  else
    response=$(curl -s -X "$method" "${BASE_URL}${endpoint}")
  fi

  # Pretty print JSON if possible
  if echo "$response" | jq empty 2>/dev/null; then
    echo "$response" | jq '.'
  else
    echo "$response"
  fi

  echo ""
  echo "----------------------------------------"
  echo ""
}

# =============================================================================
# Health & Stats Endpoints
# =============================================================================

test_endpoint "Health Check" "/health"

test_endpoint "Cluster Info" "/cluster/info"

test_endpoint "Sync Status" "/sync/status"

# =============================================================================
# Database-Backed Queries (MongoDB)
# These follow K8s native path patterns
# =============================================================================

test_endpoint "List all pods (all namespaces)" "/pods?limit=5"

test_endpoint "List pods in specific namespace (K8s pattern)" "/namespaces/default/pods?limit=5"

test_endpoint "Get specific pod by namespace and name (K8s pattern)" "/namespaces/default/pods/my-pod"

test_endpoint "List all nodes (cluster-scoped resource)" "/nodes?limit=5"

test_endpoint "Get specific node by name (cluster-scoped)" "/nodes/my-node"

test_endpoint "List ConfigMaps in apps namespace (K8s pattern)" "/namespaces/apps/configmaps"

test_endpoint "Get specific ConfigMap (K8s pattern - your use case)" "/namespaces/apps/configmaps/firecrawl-config"

test_endpoint "List Deployments with pagination" "/namespaces/kube-system/deployments?page=1&limit=3"

test_endpoint "List all Deployments (query param filter)" "/deployments?namespace=kube-system&limit=3"

# =============================================================================
# Direct Kubernetes API Access (Real-Time)
# =============================================================================

test_endpoint "Get Pod logs (K8s pattern)" "/namespaces/default/pods/my-pod/logs?tailLines=50"

test_endpoint "Get Pod events (K8s pattern)" "/namespaces/default/pods/my-pod/events"

test_endpoint "Get raw ConfigMap manifest (K8s pattern)" "/namespaces/default/configmaps/my-config/yaml"

test_endpoint "Get raw Deployment manifest (K8s pattern)" "/namespaces/apps/deployments/my-deployment/yaml"

test_endpoint "Get raw Node manifest (cluster-scoped)" "/nodes/my-node/yaml"

test_endpoint "Get Deployment events (K8s pattern)" "/namespaces/default/deployments/my-deployment/events"

# =============================================================================
# Summary
# =============================================================================

echo "========================================"
echo -e "${GREEN}API Path Pattern Summary${NC}"
echo "========================================"
echo ""
echo "Database-Backed Queries (MongoDB):"
echo "  Namespaced resources:"
echo "    GET /api/v1/namespaces/:namespace/{resource}"
echo "    GET /api/v1/namespaces/:namespace/{resource}/:name"
echo ""
echo "  Cluster-scoped resources:"
echo "    GET /api/v1/{resource}"
echo "    GET /api/v1/{resource}/:name"
echo ""
echo "Direct Kubernetes API Access:"
echo "  Namespaced resources:"
echo "    GET /api/v1/namespaces/:namespace/{resource}/:name/yaml"
echo "    GET /api/v1/namespaces/:namespace/{resource}/:name/events"
echo "    POST /api/v1/namespaces/:namespace/{resource}"
echo "    PUT /api/v1/namespaces/:namespace/{resource}/:name"
echo "    DELETE /api/v1/namespaces/:namespace/{resource}/:name"
echo ""
echo "  Cluster-scoped resources:"
echo "    GET /api/v1/{resource}/:name/yaml"
echo "    POST /api/v1/{resource}"
echo "    PUT /api/v1/{resource}/:name"
echo "    DELETE /api/v1/{resource}/:name"
echo ""
echo "Pod-specific operations:"
echo "    GET /api/v1/namespaces/:namespace/pods/:name/logs"
echo "    GET /api/v1/namespaces/:namespace/pods/:name/events"
echo ""
echo "========================================"
echo -e "${GREEN}Test Complete!${NC}"
echo "========================================"
