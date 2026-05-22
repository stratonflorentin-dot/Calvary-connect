# 🏢 Unified Financial Activity System - Role Mapping & Workflows

This document outlines the end-to-end financial architecture of the Calvary Connect Fleet Management System, mapping organizational roles to their specific financial responsibilities and documenting the automated data flows that eliminate silos.

---

## 🎯 **Organizational Role Mapping**

### 🔹 **CEO & C-Suite Executives**
*   **Financial Responsibility**: Strategic oversight, annual budgeting, major investment approvals, and high-level performance monitoring.
*   **Data Access**: Full visibility into all financial modules, consolidated P&L, and audit trails.
*   **Key Workflows**: Final approval for critical expenses (> KES 1M), strategic reporting.

### 💰 **ACCOUNTANT (Financial Manager)**
*   **Financial Responsibility**: Maintaining the general ledger, accounts payable/receivable, tax compliance, and bank reconciliation.
*   **Data Access**: Chart of Accounts, Journal Entries, Invoices, Bank Statements, Tax Reports.
*   **Key Workflows**: Approving all expense submissions, generating invoices from logistics data, payroll disbursement.

### 🔵 **OPERATOR (Operations Manager)**
*   **Financial Responsibility**: Managing trip-related revenue and direct logistics costs (fuel, tolls, border fees).
*   **Data Access**: Trips, Fuel Requests, Toll/Border Expenses, Driver Allowances.
*   **Key Workflows**: Approving fuel requests (syncs to Finance), completing trips (triggers revenue/invoicing).

### 👔 **HR (Human Resources)**
*   **Financial Responsibility**: Payroll management, staff bonuses, and benefit-related expenses.
*   **Data Access**: Employee Profiles, Attendance, Allowance Records, Payroll Reports.
*   **Key Workflows**: Approving monthly allowances and payroll (syncs to Finance as staff costs).

### 🔧 **MECHANIC**
*   **Financial Responsibility**: Maintenance cost reporting and spare parts procurement requests.
*   **Data Access**: Maintenance Requests, Parts Inventory, Service Logs.
*   **Key Workflows**: Completing maintenance requests (triggers financial expense and workshop bill).

### 🚛 **DRIVER**
*   **Financial Responsibility**: Field-level cost reporting (fuel, roadside repairs) and delivery confirmation.
*   **Data Access**: Personal Assigned Trips, Fuel Log, Personal Expenses.
*   **Key Workflows**: Submitting fuel/expense requests, uploading Proof of Delivery (POD) to initiate invoicing.

---

## 🔄 **Automated Financial Data Flows**

The system establishes seamless connections between modules to ensure a single source of truth:

1.  **Logistics ➡ Finance**:
    *   *Trigger*: Trip status set to `delivered` by Operator or Driver.
    *   *Action*: System automatically creates a **Sale** record and a **Receivable Invoice** in the Finance ledger.
    *   *Role Handoff*: Operator ➡ Accountant (Notification sent for invoice review).

2.  **Fleet ➡ Finance**:
    *   *Trigger*: Fuel request approved by Operator.
    *   *Action*: System automatically creates a **Financial Expense** (Category: Fuel) and a **Payable Bill** for the supplier.
    *   *Role Handoff*: Operator ➡ Accountant (Notification sent for payment processing).

3.  **Maintenance ➡ Finance**:
    *   *Trigger*: Maintenance request marked as `completed` by Mechanic.
    *   *Action*: System records the actual cost as a **Maintenance Expense** and creates a **Payable Invoice** for the workshop/vendor.
    *   *Role Handoff*: Mechanic ➡ Accountant (Automatic entry in the ledger).

4.  **HR ➡ Finance**:
    *   *Trigger*: Driver allowance approved by HR/Admin.
    *   *Action*: System creates a **Staff Cost Expense** and a **Payable Record** for payroll processing.
    *   *Role Handoff*: HR ➡ Accountant (Payroll synchronization).

---

## 🔐 **Centralized Data Repository & RBAC**

All financial activities are stored in a unified Supabase repository with **Row Level Security (RLS)**:

*   **Single Source of Truth**: The `journal_entries` and `invoices` tables serve as the master records for all department-initiated activities.
*   **Unified Audit Trail**: Every interaction with financial data (Create, Update, Delete) is logged via the `AuditService`, capturing the user, action, and data diff.
*   **Visibility Controls**:
    *   *Accountants/CEO*: View all transactions.
    *   *Department Heads*: View only their relevant cost centers (e.g., Operator sees Fuel/Trips).
    *   *Staff*: View only their own submissions.

---

## 📊 **Unified Reporting & Tracking**

Authorized users can trace the full lifecycle of any financial activity:
*   **Trip #123** ➡ **Sale #SAL-456** ➡ **Invoice #INV-789** ➡ **Journal Entry #JE-012**.
*   All links are maintained via foreign keys (`trip_id`, `linked_revenue`, `linked_expense`) enabling 100% traceability for audit compliance.
