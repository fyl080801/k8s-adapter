#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000/api/v1"

echo -e "${BLUE}Testing K8s Informer API${NC}\n"

# Test health endpoint
echo -e "${GREEN}1. Health Check${NC}"
curl -s "$BASE_URL/health" | jq '.'
echo -e "\n"

# Test pods list
echo -e "${GREEN}2. List Pods (page 1, limit 5)${NC}"
curl -s "$BASE_URL/pods?page=1&limit=5" | jq '.'
echo -e "\n"

# Test deployments list
echo -e "${GREEN}3. List Deployments${NC}"
curl -s "$BASE_URL/deployments?page=1&limit=5" | jq '.'
echo -e "\n"

# Test services list
echo -e "${GREEN}4. List Services${NC}"
curl -s "$BASE_URL/services?page=1&limit=5" | jq '.'
echo -e "\n"

# Test nodes list
echo -e "${GREEN}5. List Nodes${NC}"
curl -s "$BASE_URL/nodes" | jq '.'
echo -e "\n"

# Test statistics
echo -e "${GREEN}6. Overview Statistics${NC}"
curl -s "$BASE_URL/stats/overview" | jq '.'
echo -e "\n"

echo -e "${BLUE}All tests completed!${NC}"
