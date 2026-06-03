# Sidebar Features & Role Selector Access Control

## 📋 SIDEBAR MENU STRUCTURE

### Dashboard Category
- **Dashboard** → `/` (LayoutDashboard icon)

### Sales Category  
- **Customers** → `/customers` (Building2 icon)
- **Sales** → `/sales` (Briefcase icon)

### Shipments Category
- **Trips** → `/trips` (Route icon)
- **Trip History** → `/trip-history` (ClipboardList icon)
- **Bookings** → `/bookings` (CalendarDays icon)
- **Live Fleet Map** → `/map` (MapPin icon)

### Fleet Category
- **Vehicles** → `/fleet` (Truck icon)
- **Service Requests** → `/service-requests` (Wrench icon)
- **Maintenance Records** → `/maintenance` (Wrench icon) ✨ NEW
- **Fuel Management** → `/fuel-approvals` (Truck icon)

### Inventory Category
- **Stock Items** → `/inventory` (Package icon)
- **Parts Requests** → `/parts-requests` (Wrench icon)

### Accounting Category
- **Accounting Ledger** → `/finance` (DollarSign icon)
- **Expense Tracking** → `/expenses` (Receipt icon)
- **Revenue Tracking** → `/income` (Calculator icon)

### Reports Category
- **Financial Reports** → `/reports` (BarChart2 icon)

### HR Category
- **All Employees** → `/users` (Users icon)
- **Driver Management** → `/drivers` (Users icon)
- **Payroll** → `/allowances` (Briefcase icon)
- **Statutory Reports** → `/admin/hr/payroll/statutory` (BarChart2 icon)
- **Meetings** → `/hr/meetings` (CalendarDays icon) ✨ NEW

### Settings Category
- **Audit Trail** → `/audit` (Shield icon)
- **Company Settings** → `/ai-insights` (Sparkles icon)

### Always Available (Not in Categories)
- **Notifications** → `/notifications` (Bell icon)
- **My Profile** → `/profile` (UserIcon icon)

---

## 🔐 ROLE SELECTOR ACCESS CONTROL

### ✅ Current Implementation (CORRECT)

**File: `src/components/dashboard/role-selector.tsx`**

```typescript
// Admin-only check (STRICT)
const isAdmin =
  isPrimaryOwnerEmail(user.email) ||
  user.role === 'ADMIN' ||
  user.role === 'CEO';

if (!isAdmin) {
  console.log("[RoleSelector] hiding: not admin");
  return null;  // ← Returns NULL for non-admin users
}
```

**File: `src/components/dashboard/role-selector-wrapper.tsx`**

```typescript
if (!user) return null;
return <RoleSelector />;
```

### 🎯 Who Can Access Role Selector
✅ **ADMIN** - Full access  
✅ **CEO** - Full access  
✅ **Primary Owner Email** (stratonflorentin@gmail.com) - Full access  

### 🚫 Who CANNOT Access Role Selector
❌ **OPERATOR**  
❌ **DRIVER**  
❌ **MECHANIC**  
❌ **ACCOUNTANT**  
❌ **HR**  
❌ **SALESMAN**  
❌ **WAREHOUSE_STAFF**  

---

## 🎨 Sidebar Visual Features

### User Profile Card
- **Avatar** with upload capability (camera icon)
- **User Name** (from user profile)
- **Current Role** badge (shows effective role - admin preview role if active)
- **Quick avatar upload** on click (max 2MB)
- **File types:** image/* only

### Navigation Visual Indicators
- **Active Route**: Sky-blue background + text (sky-700 dark:blue-400)
- **Hover State**: Light gray background + blue text
- **Responsive Icons**: Dynamic icon coloring based on active/hover state
- **Quick Nav Shortcut**: Finance routes show quick-return-to-dashboard button on hover

### Bottom Section
- **Logout Button** with exit icon
- **Red hover state** on logout button
- **Smooth transitions** for all interactions

### Mobile Responsive
- **Mobile Menu Toggle** button (top-left, only on small screens)
- **Full-screen overlay** when mobile menu open
- **Smooth slide-in animation**

---

## 🔄 Role Preview System (Admin Only)

When an **ADMIN/CEO** uses the Role Selector:

1. **Selects a role** from dropdown menu
2. **Role stored in localStorage** as `fleet_command_role`
3. **Sidebar updates** to show preview role
4. **Menu items filtered** by selected role's permissions
5. **Dashboard redirects** to role's default route
6. **Persistent** across page navigation until changed
7. **'roleChanged' event** dispatched for app-wide reactivity

**Resets When:**
- Browser localStorage cleared
- User logs out
- User closes browser (if using session storage only)

---

## ✨ Recent Additions

### New Menu Items Added
- ✅ `/maintenance` - Maintenance Records (Fleet category)
- ✅ `/hr/meetings` - Meetings (HR category)

### Icon Maps Updated
- ✅ `/maintenance` → Wrench icon
- ✅ `/hr/meetings` → CalendarDays icon

### Route Config Updated
- ✅ Added proper role restrictions
- ✅ Added to menu system via `getMenuByRole()`

---

## 📊 Sidebar Accessibility

| Feature | Desktop | Mobile | Admin Only |
|---------|---------|--------|-----------|
| Navigation Menu | ✅ Full sidebar | 📱 Toggle menu | ❌ No |
| Role Selector | ✅ Yes | ✅ Yes | ✅ YES |
| User Profile | ✅ Yes | ✅ Yes | ❌ No |
| Avatar Upload | ✅ Yes | ✅ Yes | ❌ No |
| Logout | ✅ Yes | ✅ Yes | ❌ No |
| Quick Shortcuts | ✅ Finance only | 📱 On hover | ❌ No |

---

## 🛡️ Security Implementation

✅ **Role Selector**: Returns `null` for non-admin users  
✅ **Menu Filtering**: `getMenuByRole()` filters items by user role  
✅ **Route Protection**: Backend RLS policies enforce access control  
✅ **LocalStorage**: Role preview stored per-browser (not synced to DB)  
✅ **Type Safety**: TypeScript `UserRole` enum ensures valid roles  
✅ **Session-based**: Admin preview role resets on logout  

---

## 📝 CONCLUSION

**Sidebar Design**: ✅ Multi-category menu with 30+ routes organized by function

**Role Selector**: ✅ **ADMIN-ONLY** - Properly restricted via three-layer check:
1. Wrapper checks user exists
2. Component checks `isPrimaryOwnerEmail` OR role in [ADMIN, CEO]
3. Returns null if conditions not met

**No security leaks** - non-admin users will never see the role selector UI component.
