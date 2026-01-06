#!/bin/bash

# Test script for Generic K8s API
# Tests all automatically generated endpoints

echo "=========================================="
echo "Testing Generic K8s Resource API"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_field=$3

    echo -n "Testing $name... "

    response=$(curl -s "$url")
    if [ $? -eq 0 ]; then
        if echo "$response" | grep -q "$expected_field"; then
            echo -e "${GREEN}✓ PASSED${NC}"
            ((TESTS_PASSED++))
            return 0
        else
            echo -e "${RED}✗ FAILED${NC} (Response: $response)"
            ((TESTS_FAILED++))
            return 1
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (Connection error)"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "1. Health Check Endpoint"
test_endpoint "Health" "$BASE_URL/health" "ok"

echo ""
echo "2. Resource Registry"
test_endpoint "Resources" "$BASE_URL/resources" "generic route generator"

echo ""
echo "3. Core v1 Resources"
test_endpoint "Pods" "$BASE_URL/pods" "data"
test_endpoint "Services" "$BASE_URL/services" "data"
test_endpoint "Nodes" "$BASE_URL/nodes" "data"
test_endpoint "ConfigMaps" "$BASE_URL/configmaps" "data"
test_endpoint "Secrets" "$BASE_URL/secrets" "data"
test_endpoint "Events" "$BASE_URL/events" "data"
test_endpoint "PVCs" "$BASE_URL/persistentvolumeclaims" "data"

echo ""
echo "4. Apps/v1 Resources"
test_endpoint "Deployments" "$BASE_URL/deployments" "data"
test_endpoint "StatefulSets" "$BASE_URL/statefulsets" "data"
test_endpoint "DaemonSets" "$BASE_URL/daemonsets" "data"

echo ""
echo "5. Networking.k8s.io/v1 Resources"
test_endpoint "Ingresses" "$BASE_URL/ingresses" "data"

echo ""
echo "6. Statistics Endpoint"
test_endpoint "Stats Overview" "$BASE_URL/stats/overview" "pods"

echo ""
echo "=========================================="
echo "Test Results"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "Total: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ✗${NC}"
    exit 1
fi
