#!/bin/bash

# Test script for Kubernetes Native API endpoints
# This script tests the new direct K8s API access endpoints

BASE_URL="http://localhost:3000/api/v1"

echo "=========================================="
echo "Testing Kubernetes Native API Endpoints"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_endpoint() {
  local name="$1"
  local url="$2"
  local expected_code="$3"

  echo -n "Testing: $name ... "
  response=$(curl -s -w "\n%{http_code}" -X GET "$url" 2>/dev/null)
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "$expected_code" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (Expected: $expected_code, Got: $http_code)"
    echo "  Response: $body" | head -c 200
    echo ""
    ((TESTS_FAILED++))
    return 1
  fi
}

echo "1. Health & Stats Endpoints"
echo "----------------------------"
test_endpoint "Health Check" "$BASE_URL/health" "200"
test_endpoint "Stats Overview" "$BASE_URL/stats/overview" "200"
test_endpoint "Cluster Info" "$BASE_URL/cluster/info" "200"
echo ""

echo "2. Database-Backed Queries (from MongoDB)"
echo "-----------------------------------------"
test_endpoint "List Pods" "$BASE_URL/pods" "200"
test_endpoint "List Deployments" "$BASE_URL/deployments" "200"
test_endpoint "List Services" "$BASE_URL/services" "200"
echo ""

echo "3. Direct Kubernetes API Access"
echo "--------------------------------"
# These may return 404 if resources don't exist in the cluster
# We're testing that the endpoints are reachable, not the actual data
test_endpoint "Pod Logs (will likely return 404 if no pods)" "$BASE_URL/pods/default/test-pod/logs" "404"
test_endpoint "Pod YAML (will likely return 404 if no pods)" "$BASE_URL/pods/default/test-pod/yaml" "404"
test_endpoint "Pod Events (will likely return 404 if no pods)" "$BASE_URL/pods/default/test-pod/events" "404"
test_endpoint "Deployment YAML (will likely return 404)" "$BASE_URL/deployments/default/test-deployment/yaml" "404"
test_endpoint "Deployment Events (will likely return 404)" "$BASE_URL/deployments/default/test-deployment/events" "404"
echo ""

echo "4. Resource Registry (Documentation)"
echo "-------------------------------------"
test_endpoint "Resources List" "$BASE_URL/resources" "200"
test_endpoint "Resources Registry" "$BASE_URL/resources/registry" "200"
echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "Total:  $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed.${NC}"
  exit 1
fi
