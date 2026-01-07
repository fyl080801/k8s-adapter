#!/bin/bash

# Test MongoDB query performance for multiple namespaces

echo "Testing MongoDB Query Performance"
echo "=================================="
echo ""

# Test 1: Single namespace
echo "Test 1: Query single namespace"
echo "GET http://localhost:3000/api/v1/pods?namespaces=default&limit=10"
time curl -s "http://localhost:3000/api/v1/pods?namespaces=default&limit=10" | jq '.debug, .data | length'
echo ""
echo ""

# Test 2: Two namespaces
echo "Test 2: Query two namespaces"
echo "GET http://localhost:3000/api/v1/pods?namespaces=default,kube-system&limit=10"
time curl -s "http://localhost:3000/api/v1/pods?namespaces=default,kube-system&limit=10" | jq '.debug, .data | length'
echo ""
echo ""

# Test 3: Three namespaces
echo "Test 3: Query three namespaces"
echo "GET http://localhost:3000/api/v1/pods?namespaces=default,kube-system,monitoring&limit=10"
time curl -s "http://localhost:3000/api/v1/pods?namespaces=default,kube-system,monitoring&limit=10" | jq '.debug, .data | length'
echo ""
echo ""

# Test 4: Without namespace filter (all namespaces)
echo "Test 4: Query all namespaces"
echo "GET http://localhost:3000/api/v1/pods?limit=10"
time curl -s "http://localhost:3000/api/v1/pods?limit=10" | jq '.debug, .data | length'
echo ""
echo ""

echo "=================================="
echo "Tests completed. Check console logs for detailed timing information."
