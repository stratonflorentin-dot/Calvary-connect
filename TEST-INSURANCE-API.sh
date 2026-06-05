#!/bin/bash
# Truck Insurance Management - API Testing Guide
# Use these commands to test all endpoints after setup

# ============================================
# Configuration
# ============================================

BASE_URL="http://localhost:3000"
VEHICLE_ID="your-vehicle-uuid-here"  # Replace with actual vehicle UUID
INSURANCE_ID="your-insurance-id-here" # Replace with actual insurance ID

# ============================================
# 1. GET ALL INSURANCE POLICIES
# ============================================

echo "=== 1. GET ALL INSURANCE POLICIES ==="
curl -X GET "${BASE_URL}/api/insurance" \
  -H "Content-Type: application/json"

# With filters:
curl -X GET "${BASE_URL}/api/insurance?status=active&insurer=Jubilee" \
  -H "Content-Type: application/json"

# ============================================
# 2. CREATE NEW INSURANCE POLICY
# ============================================

echo -e "\n=== 2. CREATE NEW INSURANCE POLICY ==="
curl -X POST "${BASE_URL}/api/insurance" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "'${VEHICLE_ID}'",
    "insurer_name": "Jubilee Insurance",
    "policy_type": "third_party",
    "tira_reference_number": "TZ/2024/123456",
    "start_date": "2024-01-01",
    "expiry_date": "2025-01-01",
    "annual_premium": 500000,
    "route_coverage_area": "East Africa",
    "is_cross_border": false,
    "notes": "Standard third party coverage"
  }'

# ============================================
# 3. GET SPECIFIC INSURANCE POLICY
# ============================================

echo -e "\n=== 3. GET SPECIFIC INSURANCE POLICY ==="
curl -X GET "${BASE_URL}/api/insurance/${INSURANCE_ID}" \
  -H "Content-Type: application/json"

# ============================================
# 4. UPDATE INSURANCE POLICY
# ============================================

echo -e "\n=== 4. UPDATE INSURANCE POLICY ==="
curl -X PUT "${BASE_URL}/api/insurance/${INSURANCE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "annual_premium": 550000,
    "route_coverage_area": "East Africa & Kenya",
    "notes": "Updated coverage area"
  }'

# ============================================
# 5. DELETE INSURANCE POLICY
# ============================================

echo -e "\n=== 5. DELETE INSURANCE POLICY ==="
# WARNING: This deletes the record!
# curl -X DELETE "${BASE_URL}/api/insurance/${INSURANCE_ID}" \
#   -H "Content-Type: application/json"

# ============================================
# 6. GET EXPIRING POLICIES
# ============================================

echo -e "\n=== 6. GET EXPIRING POLICIES (within 30 days) ==="
curl -X GET "${BASE_URL}/api/insurance/expiring?days=30" \
  -H "Content-Type: application/json"

# Or for 60 days:
curl -X GET "${BASE_URL}/api/insurance/expiring?days=60" \
  -H "Content-Type: application/json"

# ============================================
# 7. CHECK TIRA COMPLIANCE
# ============================================

echo -e "\n=== 7. CHECK TIRA COMPLIANCE ==="
curl -X GET "${BASE_URL}/api/insurance/compliance?type=tira" \
  -H "Content-Type: application/json"

# ============================================
# 8. CHECK CROSS-BORDER COVERAGE
# ============================================

echo -e "\n=== 8. CHECK CROSS-BORDER YELLOW CARD COVERAGE ==="
curl -X GET "${BASE_URL}/api/insurance/compliance?type=cross_border" \
  -H "Content-Type: application/json"

# ============================================
# 9. GET INSURANCE SUMMARY (Dashboard)
# ============================================

echo -e "\n=== 9. GET INSURANCE SUMMARY (Dashboard) ==="
curl -X GET "${BASE_URL}/api/insurance/summary" \
  -H "Content-Type: application/json"

# ============================================
# 10. BULK IMPORT CSV DATA
# ============================================

echo -e "\n=== 10. BULK IMPORT CSV DATA ==="
curl -X POST "${BASE_URL}/api/insurance/bulk-import" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "vehicle_id": "'${VEHICLE_ID}'",
        "insurer_name": "Alliance Insurance",
        "policy_type": "third_party",
        "tira_reference_number": "TZ/2024/001",
        "start_date": "2024-01-01",
        "expiry_date": "2025-01-01",
        "annual_premium": 450000,
        "route_coverage_area": "East Africa"
      },
      {
        "vehicle_id": "'${VEHICLE_ID}'",
        "insurer_name": "NIC Tanzania",
        "policy_type": "third_party_cargo",
        "tira_reference_number": "TZ/2024/002",
        "start_date": "2024-02-01",
        "expiry_date": "2025-02-01",
        "annual_premium": 650000,
        "route_coverage_area": "Regional"
      }
    ],
    "format": "json"
  }'

# ============================================
# EXAMPLE RESPONSES
# ============================================

echo -e "\n\n=== EXAMPLE: CREATE RESPONSE ==="
cat << 'EOF'
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "vehicle_id": "660e8400-e29b-41d4-a716-446655440001",
    "insurer_name": "Jubilee Insurance",
    "policy_type": "third_party",
    "tira_reference_number": "TZ/2024/123456",
    "start_date": "2024-01-01",
    "expiry_date": "2025-01-01",
    "annual_premium": 500000,
    "status": "active",
    "is_cross_border": false,
    "created_at": "2024-06-05T10:30:00.000Z",
    "updated_at": "2024-06-05T10:30:00.000Z"
  }
}
EOF

echo -e "\n\n=== EXAMPLE: SUMMARY RESPONSE ==="
cat << 'EOF'
{
  "data": {
    "total_vehicles": 128,
    "total_active_policies": 125,
    "expiring_within_30_days": 5,
    "expired_policies": 0,
    "mandatory_tira_compliance": {
      "compliant": 125,
      "non_compliant": 3
    },
    "cross_border_coverage": {
      "with_yellow_card": 12,
      "without_yellow_card": 2
    },
    "total_annual_premium": 64000000
  }
}
EOF

echo -e "\n\n=== EXAMPLE: COMPLIANCE RESPONSE ==="
cat << 'EOF'
{
  "check_type": "tira",
  "description": "Tanzanian TIRA - Every truck must have minimum Third Party coverage",
  "data": [
    {
      "vehicle_id": "uuid-001",
      "plate_number": "ABC-123",
      "compliant": true,
      "active_policy": {
        "id": "policy-uuid",
        "insurer_name": "Jubilee Insurance",
        "policy_type": "third_party",
        "expiry_date": "2025-01-01"
      }
    },
    {
      "vehicle_id": "uuid-002",
      "plate_number": "XYZ-789",
      "compliant": false,
      "active_policy": null
    }
  ],
  "summary": {
    "total_vehicles": 128,
    "compliant": 125,
    "non_compliant": 3,
    "compliance_rate": "97.7%"
  }
}
EOF

# ============================================
# TROUBLESHOOTING TIPS
# ============================================

echo -e "\n\n=== TROUBLESHOOTING TIPS ==="
cat << 'EOF'

1. AUTHENTICATION ERROR (401)
   - Ensure you're logged in (Supabase session active)
   - Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

2. NOT FOUND ERROR (404)
   - Check that the table 'truck_insurance' exists in database
   - Verify database migration was executed

3. PERMISSION ERROR (403)
   - Check that user has HR or ADMIN role
   - Verify RLS policies are configured correctly

4. VALIDATION ERROR (400)
   - Check date formats (must be YYYY-MM-DD)
   - Verify policy_type is one of: third_party, third_party_cargo, comprehensive, cross_border
   - Ensure annual_premium is numeric

5. DUPLICATE KEY ERROR (409)
   - TIRA reference number already exists
   - Use unique reference numbers for each policy

6. VEHICLE NOT FOUND
   - Verify vehicle_id exists in vehicles table
   - Use SELECT id, plate_number FROM vehicles; to list available vehicles

EOF

# ============================================
# BASH SCRIPT HELPER FUNCTIONS
# ============================================

# Function to save response to file
save_response() {
  local endpoint=$1
  local filename=$2
  curl -s "${BASE_URL}${endpoint}" > "${filename}"
  echo "Response saved to ${filename}"
}

# Function to test all endpoints
test_all_endpoints() {
  echo "Testing all endpoints..."
  
  # Test 1: Summary
  echo -n "1. Summary... "
  if curl -s "${BASE_URL}/api/insurance/summary" | grep -q "total_vehicles"; then
    echo "✓ OK"
  else
    echo "✗ FAILED"
  fi
  
  # Test 2: Expiring
  echo -n "2. Expiring Policies... "
  if curl -s "${BASE_URL}/api/insurance/expiring" | grep -q "data"; then
    echo "✓ OK"
  else
    echo "✗ FAILED"
  fi
  
  # Test 3: Compliance
  echo -n "3. Compliance Check... "
  if curl -s "${BASE_URL}/api/insurance/compliance?type=tira" | grep -q "check_type"; then
    echo "✓ OK"
  else
    echo "✗ FAILED"
  fi
  
  # Test 4: List All
  echo -n "4. List All Policies... "
  if curl -s "${BASE_URL}/api/insurance" | grep -q "data"; then
    echo "✓ OK"
  else
    echo "✗ FAILED"
  fi
}

# Uncomment to run all tests:
# test_all_endpoints

echo -e "\n\n✅ API Testing guide ready! Modify VEHICLE_ID and INSURANCE_ID variables to test with real data."
