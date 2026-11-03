# Server Actions — Authorization Audit

_Audit of Next.js server actions (`'use server'` functions in `*/actions.ts`) that use the
service-role Supabase client (`getAdminClient()` / `supabaseAdmin`), which **bypasses RLS**. Because
RLS doesn't apply, each such action must authorize the caller itself._

## Threat model

Server actions aren't plain public endpoints — Next.js gates them with an encrypted action id and a
same-origin POST, so they're not trivially callable by an anonymous internet client. But:

1. **No role check = broken access control.** Any *logged-in* user (any role) can invoke an action
   whose id is in the client bundle. An action that mutates payroll or finance with no role gate lets,
   say, a DRIVER approve payroll.
2. **Service-role bypasses RLS**, so the database's own guard can't save it.
3. **Client-supplied actor ids are spoofable** (`approvedByUserId`, `actorId` passed as plain args),
   so the audit trail can be forged.

## Guarded (good) ✅

- **users/actions.ts** — `requireUserManager(accessToken, roles)` validates the token + role before
  every admin op (invite gated to CEO/ADMIN/HR, HR can't escalate; delete to CEO/ADMIN).
- **storage/actions.ts** — `uploadToBucketAction` checks the token; receipts list/delete use
  `requireManageRole`.
- **tracking/actions.ts** — `upsertDriverLocationAction` requires a token via `resolveAuthUser`.

## Unguarded (broken access control) ❌ — fix needed

These take **no `accessToken`** and do **no role check** before mutating via the service-role client:

- **sales/actions.ts** — `saveCustomerAction`, `deleteCustomerAction`, `saveTripAction`,
  `deleteTripAction`, `saveInvoiceAction`, `deleteInvoiceAction`, `saveExpenseAction`,
  `deleteExpenseAction`, `saveRateSheetAction`, … — create/delete customers, trips, invoices and
  expenses with no authorization.
- **allowances/actions.ts** — ✅ **FIXED.** All eight payroll actions now call
  `requireRole(accessToken, ['CEO','ADMIN','HR','ACCOUNTANT'])` (shared guard in
  [server-action-auth.ts](src/lib/server-action-auth.ts)) before any service-role operation;
  `approvePayrollRecordAction` records the **verified** session user as approver (the spoofable
  `approvedByUserId` arg is gone); the single caller (allowances page) passes the session token.
  Verify with a login that save/approve/mark-paid/reject/delete still work and that a non-payroll role
  is refused.
- **fleet/fuel-anomalies/actions.ts** — `lockFuelCardAction(fuelLogId, actorId, reason)` — `actorId`
  is a spoofable plain arg; no token.
- **admin/hr/driver-compliance/actions.ts** — `runDriverReminderScan()` — no auth (sends reminders;
  lower risk / likely cron).

## Fix pattern (scoped follow-up — needs login testing)

Mirror `users/actions.ts`. Add a shared guard (e.g. in a small `@/lib/server-action-auth`):

```ts
export async function requireRole(accessToken: string, allowed: string[]) {
  if (!accessToken) throw new Error('Sign in again.');
  const admin = getAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);
  if (error || !user) throw new Error('Session invalid.');
  const { data: p } = await admin.from('user_profiles').select('role,status').eq('id', user.id).maybeSingle();
  const role = String(p?.role ?? '').toUpperCase();
  if (p?.status === 'deleted' || !allowed.includes(role)) throw new Error('Not authorized.');
  return { admin, user, role };
}
```

Then, per action: add an `accessToken` first param, call `requireRole(accessToken, [...])` with the
roles that route-config already grants the page (sales → CEO/ADMIN/SALESMAN/ACCOUNTANT/OPERATOR;
payroll → CEO/ADMIN/HR/ACCOUNTANT), derive the actor id from the verified `user.id` (not a client arg),
and update **every caller** to pass `supabase.auth.getSession()`'s token.

**Why not done here:** this spans ~15 actions across sales + payroll plus all their callers, changes
core financial flows, and can't be verified without a login — exactly the kind of change to do
deliberately with per-page login testing, not blind. Recommended as the next focused security task,
highest-risk first (payroll approve/pay/delete).
