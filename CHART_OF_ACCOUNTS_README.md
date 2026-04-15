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

| Code | Name | Purpose |
|------|------|---------|
| 1001 | Petty Cash | Small operational cash |
| 1002 | Bank Account | Main bank transactions |
| 1003 | Mobile Money | M-Pesa, Tigo Pesa, Airtel |
| 1100 | Accounts Receivable | Client debts |
| 1101 | Transit Receivables | International freight owed |
| 1102 | Local Delivery Receivables | Local delivery debts |
| 1200 | Prepaid Expenses | Insurance, licenses |
| 1300 | Fuel Inventory | Stored fuel value |
| 1301 | Spare Parts Inventory | Parts stock value |
| 1500 | Vehicles | Fleet asset value |
| 1501 | Trailers | Trailer assets |
| 1600 | Accumulated Depreciation | Asset depreciation |

### 2. LIABILITIES (2000–2999)

| Code | Name | Purpose |
|------|------|---------|
| 2001 | Accounts Payable | Vendor debts |
| 2002 | Fuel Creditors | Fuel suppliers owed |
| 2003 | Driver Allowances Payable | Outstanding driver pay |
| 2004 | Salaries Payable | Staff wages owed |
| 2005 | Taxes Payable | VAT, PAYE, etc. |
| 2006 | Customs Duties Payable | Import duties owed |
| 2500 | Vehicle Loans | Vehicle financing |
| 2501 | Bank Loans | General loans |

### 3. EQUITY (3000–3999)

| Code | Name | Purpose |
|------|------|---------|
| 3001 | Owner Capital | Owner investments |
| 3002 | Retained Earnings | Accumulated profits |
| 3003 | Drawings | Owner withdrawals |

### 4. REVENUE (4000–4999)

| Code | Name | Purpose |
|------|------|---------|
| 4001 | Transit Freight Revenue | International freight income |
| 4002 | Local Delivery Revenue | Local delivery income |
| 4003 | Clearing & Forwarding Fees | Customs services income |
| 4004 | Warehousing Fees | Storage income |
| 4100 | Fuel Surcharge Income | Fuel price adjustments |
| 4101 | Demurrage Charges | Loading delay fees |
| 4102 | Late Delivery Penalties | Late fee income |

### 5. COST OF SALES (5000–5999)

| Code | Name | Purpose |
|------|------|---------|
| 5001 | Fuel Expense | Trip fuel costs |
| 5002 | Driver Wages (Trip) | Per-trip driver pay |
| 5003 | Turnboy Wages | Assistant wages |
| 5004 | Tolls & Road Charges | Highway fees |
| 5005 | Vehicle Maintenance (Trip) | Trip-related repairs |
| 5006 | Customs Clearing Costs | Transit customs fees |
| 5007 | Insurance per Trip | Trip insurance cost |

### 6. OPERATING EXPENSES (6000–6999)

| Code | Name | Purpose |
|------|------|---------|
| 6001 | Salaries (Office Staff) | Admin salaries |
| 6002 | Rent | Office/warehouse rent |
| 6003 | Utilities | Electricity, water |
| 6004 | Internet & Software | IT costs |
| 6100 | Vehicle Repairs | General maintenance |
| 6101 | Insurance (Annual) | Annual premiums |
| 6102 | Licensing & Permits | Road licenses |
| 6103 | Tracking System Costs | GPS/management systems |
| 6200 | Marketing & Advertising | Promotions |
| 6201 | Client Entertainment | Client meetings |

### 7. OTHER EXPENSES (7000–7999)

| Code | Name | Purpose |
|------|------|---------|
| 7001 | Bank Charges | Bank fees |
| 7002 | Interest Expense | Loan interest |
| 7003 | Fines & Penalties | Traffic fines |
| 7004 | Loss on Damaged Goods | Cargo claims |

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
    '4002',  -- Local Delivery Revenue
    '1102'   -- Local Delivery Receivables
);
```

### Record Client Payment
```sql
SELECT record_client_payment(
    'ABC Transport Ltd',
    15000.00,
    'BANK'
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
