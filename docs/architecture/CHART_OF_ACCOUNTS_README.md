# Chart of Accounts (COA) - Logistics Operations

## Overview
This Chart of Accounts is designed specifically for logistics and fleet management operations. It enables comprehensive tracking of revenue, costs, and compliance for your transport business.

## Database Schema

### Core Tables

1. **accounts** - Chart of Accounts master
2. **journal_entries** - Double-entry bookkeeping headers
3. **journal_entry_lines** - Individual debit/credit lines
4. **trip_accounting** - Links trips to revenue and costs
5. **vehicle_expenses** - Tracks all vehicle-related expenses
6. **fuel_tracking** - Detailed fuel consumption records
7. **route_profitability** - Aggregated route performance
8. **client_balances** - Accounts receivable aging
9. **vendor_balances** - Accounts payable tracking

## Account Structure

### 1. ASSETS (1000–1999)

#### 1100 Current Assets
| Code | Name | Purpose |
|------|------|---------|
| 1101 | Cash on Hand | Petty cash in office |
| 1102 | Bank Account | Main operating bank account |
| 1103 | Mobile Money Account | M-Pesa, Tigo Pesa, Airtel Money |
| 1104 | Accounts Receivable | Client debts |
| 1105 | Prepaid Expenses | Insurance, licenses paid in advance |
| 1106 | Fuel Inventory | Stored fuel value |
| 1107 | Spare Parts Inventory | Parts stock value |
| 1108 | VAT Receivable | VAT to be claimed |

#### 1200 Fixed Assets
| Code | Name | Purpose |
|------|------|---------|
| 1201 | Trucks and Trailers | Fleet vehicle assets |
| 1202 | Motor Vehicles | Utility and staff vehicles |
| 1203 | Office Equipment | Furniture and machines |
| 1204 | Computers and IT Equipment | Laptops, servers |
| 1205 | Warehouse Equipment | Forklifts, racks |
| 1206 | Furniture and Fixtures | Office furniture |
| 1207 | GPS Tracking Devices | Installed tracking hardware |

#### 1300 Accumulated Depreciation
| Code | Name | Purpose |
|------|------|---------|
| 1301 | Accumulated Depreciation, Trucks | Contra-asset for trucks |
| 1302 | Accumulated Depreciation, Vehicles | Contra-asset for vehicles |
| 1303 | Accumulated Depreciation, Equipment | Contra-asset for equipment |

### 2. LIABILITIES (2000–2999)

#### 2100 Current Liabilities
| Code | Name | Purpose |
|------|------|---------|
| 2101 | Accounts Payable | Supplier debts |
| 2102 | Fuel Creditors | Fuel suppliers owed |
| 2103 | Driver Allowances Payable | Outstanding driver pay |
| 2104 | Salaries Payable | Staff wages owed |
| 2105 | Tax Payable | Income tax obligations |
| 2106 | VAT Payable | VAT to be paid |
| 2107 | NHIF Payable | Health insurance |
| 2108 | NSSF Payable | Social security |

#### 2200 Long Term Liabilities
| Code | Name | Purpose |
|------|------|---------|
| 2201 | Truck Loan | Financing for fleet |
| 2202 | Vehicle Financing | Financing for other vehicles |
| 2203 | Bank Loan | Long-term bank loans |
| 2204 | Lease Obligations | Finance leases |

### 3. EQUITY (3000–3999)

| Code | Name | Purpose |
|------|------|---------|
| 3101 | Owner Capital | Owner investments |
| 3102 | Retained Earnings | Accumulated profits |
| 3103 | Current Year Profit | Current period performance |
| 3104 | Drawings | Owner withdrawals |

### 4. REVENUE (4000–4999)

#### 4100 Core Revenue
| Code | Name | Purpose |
|------|------|---------|
| 4101 | Local Transport Revenue | Local delivery income |
| 4102 | Cross Border Transport Revenue | International freight income |
| 4103 | Container Transport Revenue | Container hauling income |
| 4104 | Loose Cargo Revenue | Non-containerized cargo |
| 4105 | Express Delivery Revenue | Urgent delivery income |
| 4106 | Warehousing Revenue | Storage income |
| 4107 | Loading and Offloading Revenue | Handling charges |
| 4108 | Customs Clearing Revenue | Documentation fees |

#### 4200 Other Income
| Code | Name | Purpose |
|------|------|---------|
| 4201 | Fuel Surcharge Income | Fuel price adjustments |
| 4202 | Commission Income | Brokerage fees |
| 4203 | Rental Income | Asset rental income |
| 4204 | Other Operating Income | Miscellaneous income |

### 5. COST OF SALES / DIRECT LOGISTICS COSTS (5000–5999)

| Code | Name | Purpose |
|------|------|---------|
| 5101 | Fuel Expense | Trip fuel costs |
| 5102 | Driver Salaries | Base driver pay |
| 5103 | Driver Allowances | Per-trip allowances |
| 5104 | Truck Repairs | Maintenance on trips |
| 5105 | Tire Expense | Replacement tires |
| 5106 | Lubricants and Oil | Engine oil, grease |
| 5107 | Border and Port Charges | Entry/exit fees |
| 5108 | Cargo Handling Expense | Loading/unloading costs |
| 5109 | Toll Fees | Highway fees |
| 5110 | Vehicle Insurance | Trip insurance |
| 5111 | GPS Tracking Costs | Subscription fees |
| 5112 | Trip Loading Expenses | Misc trip setup |
| 5113 | Freight Subcontractor Expense | 3rd party carrier payments |

### 6. OPERATING EXPENSES (6000–6999)

#### 6100 Facilities & Admin
| Code | Name | Purpose |
|------|------|---------|
| 6101 | Office Rent | Office/warehouse rent |
| 6102 | Electricity and Water | Utilities |
| 6103 | Internet Expense | Data costs |
| 6104 | Telephone Expense | Airtime and lines |
| 6105 | Office Supplies | Stationery, etc. |
| 6106 | Cleaning Expense | Office cleaning |
| 6107 | Security Expense | Guard services |

#### 6200 Personnel
| Code | Name | Purpose |
|------|------|---------|
| 6201 | Office Salaries | Admin staff pay |
| 6202 | Staff Welfare | Tea, lunch, etc. |
| 6203 | Staff Training | Capacity building |
| 6204 | Recruitment Expense | Hiring costs |

#### 6300 Marketing
| Code | Name | Purpose |
|------|------|---------|
| 6301 | Advertising Expense | Promotions |
| 6302 | Branding Expense | Logo, signs |
| 6303 | Website Expense | Hosting/design |
| 6304 | Social Media Marketing | Platform ads |

#### 6400 Professional Services
| Code | Name | Purpose |
|------|------|---------|
| 6401 | Legal Fees | Legal services |
| 6402 | Audit Fees | Financial audits |
| 6403 | Consultancy Fees | Expert advice |

#### 6500 Financial
| Code | Name | Purpose |
|------|------|---------|
| 6501 | Bank Charges | Transaction fees |
| 6502 | Loan Interest | Interest on debt |
| 6503 | Foreign Exchange Loss | Currency fluctuations |

### 7. TAXES AND COMPLIANCE (7000–7999)

| Code | Name | Purpose |
|------|------|---------|
| 7101 | Corporate Tax Expense | Income tax |
| 7102 | Withholding Tax | WHT obligations |
| 7103 | Business License Fees | Annual licenses |
| 7104 | Road License Fees | Vehicle licenses |
| 7105 | Regulatory Compliance Fees | LATRA, etc. |

## Setup Instructions

### 1. Run Schema Migration
```sql
\i create_chart_of_accounts.sql
```

### 2. Seed Chart of Accounts
```sql
\i seed_chart_of_accounts.sql
```

### 3. Create Functions
```sql
\i accounting_functions.sql
```

## Key Features

### Trip-Based Accounting
- Each trip auto-generates accounting entries
- Revenue debited to AR, credited to Revenue
- Costs debited to Cost of Sales, credited to Cash/Payable

### Driver Ledger Integration
- Driver allowances linked to trips
- Automatic expense allocation

### Client Balances (AR Aging)
- Tracks days 30, 60, 90, 90+
- Automatic balance updates on payments

### Fuel Consumption Tracking
- Per-vehicle fuel tracking
- Consumption per km calculation

### Route Profitability
- Aggregated revenue by route
- Cost breakdown per route
- Profit per trip average

## Usage Examples

### Record Trip Revenue
```sql
SELECT create_trip_revenue_entry(
    'trip-uuid-here',
    15000.00,
    'ABC Transport Ltd',
    '4101',  -- Local Transport Revenue
    '1104'   -- Accounts Receivable
);
```

### Record Client Payment
```sql
SELECT record_client_payment(
    'ABC Transport Ltd',
    15000.00,
    '1102' -- Bank Account
);
```

### Record Vehicle Expense
```sql
SELECT record_vehicle_expense(
    'vehicle-uuid-here',
    'FUEL',
    5000.00,
    'Total Kenya',
    'Fuel for Nairobi-Mombasa trip',
    'trip-uuid-here'
);
```

### View Trial Balance
```sql
SELECT * FROM trial_balance;
```

### View Profit & Loss
```sql
SELECT * FROM profit_loss_summary;
```

### Update Route Profitability
```sql
SELECT update_route_profitability('Nairobi', 'Mombasa');
```

## Integration with Trips

When creating a trip, accounting entries are automatically generated:
1. Revenue entry (DR: AR, CR: Revenue)
2. Cost entries when fuel/driver costs are recorded

## Reports Available

1. **Trial Balance** - All account balances
2. **Profit & Loss Summary** - Revenue vs Costs
3. **Client AR Aging** - Outstanding client balances
4. **Route Profitability** - Profit per route
5. **Vehicle Expense Report** - Costs per vehicle
6. **Fuel Consumption Report** - Efficiency tracking

## API Integration

The accounting system can be integrated into your Next.js app:

```typescript
// Create journal entry
await supabase.rpc('create_trip_revenue_entry', {
    p_trip_id: tripId,
    p_revenue_amount: amount,
    p_client_name: clientName
});

// Get trial balance
const { data } = await supabase
    .from('trial_balance')
    .select('*');
```
