import { supabase } from "@/lib/supabase";

export type NotificationCategory =
  | "trip_assigned"
  | "fuel_approval"
  | "expense_approval"
  | "maintenance_update"
  | "delivery_update"
  | "accounting_revenue"
  | "accounting_expense"
  | "sales_payment"
  | "payment_dispute"
  | "lead_created"
  | "lead_converted"
  | "quotation_approved"
  | "quotation_sent"
  | "booking_created"
  | "trip_started"
  | "pod_uploaded"
  | "pod_verified"
  | "invoice_generated"
  | "general";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id?: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  module: string;
  entity_type?: string;
  entity_id?: string;
  read: boolean;
  read_at?: string;
  action_url?: string;
  created_at?: string;
}

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  module: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
}) {
  const payload: Notification = {
    user_id: params.userId,
    title: params.title,
    message: params.message,
    type: params.type,
    module: params.module,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action_url: params.actionUrl,
    read: false,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("notifications").insert([payload]);
  if (error) console.warn("[createNotification]", error.message);
}

// ERP Workflow Notifications

// Lead Notifications
export async function notifySalesTeamNewLead(
  leadId: string,
  companyName: string,
  salesmanIds: string[],
) {
  await Promise.all(
    salesmanIds.map((id) =>
      createNotification({
        userId: id,
        title: "New Lead Created",
        message: `New lead from ${companyName} has been added to the pipeline.`,
        type: "info",
        module: "sales",
        entityType: "lead",
        entityId: leadId,
        actionUrl: `/sales/leads`,
      }),
    ),
  );
}

export async function notifySalesTeamLeadConverted(
  leadId: string,
  companyName: string,
  customerId: string,
  salesmanIds: string[],
) {
  await Promise.all(
    salesmanIds.map((id) =>
      createNotification({
        userId: id,
        title: "Lead Converted to Customer",
        message: `${companyName} has been converted to a customer.`,
        type: "success",
        module: "sales",
        entityType: "customer",
        entityId: customerId,
        actionUrl: `/sales?tab=customers`,
      }),
    ),
  );
}

// Quotation Notifications
export async function notifySalesTeamQuotationApproved(
  quotationId: string,
  quotationNumber: string,
  companyName: string,
  salesmanIds: string[],
) {
  await Promise.all(
    salesmanIds.map((id) =>
      createNotification({
        userId: id,
        title: "Quotation Approved",
        message: `Quotation ${quotationNumber} for ${companyName} has been approved.`,
        type: "success",
        module: "sales",
        entityType: "quotation",
        entityId: quotationId,
        actionUrl: `/sales?tab=quotations`,
      }),
    ),
  );
}

export async function notifySalesTeamQuotationSent(
  quotationId: string,
  quotationNumber: string,
  companyName: string,
  salesmanIds: string[],
) {
  await Promise.all(
    salesmanIds.map((id) =>
      createNotification({
        userId: id,
        title: "Quotation Sent to Customer",
        message: `Quotation ${quotationNumber} has been sent to ${companyName}.`,
        type: "info",
        module: "sales",
        entityType: "quotation",
        entityId: quotationId,
        actionUrl: `/sales?tab=quotations`,
      }),
    ),
  );
}

// Booking Notifications
export async function notifyOperationsTeamNewBooking(
  bookingId: string,
  bookingNumber: string,
  companyName: string,
  operatorIds: string[],
) {
  await Promise.all(
    operatorIds.map((id) =>
      createNotification({
        userId: id,
        title: "New Booking Created",
        message: `Booking ${bookingNumber} for ${companyName} requires trip assignment.`,
        type: "info",
        module: "operations",
        entityType: "booking",
        entityId: bookingId,
        actionUrl: `/bookings`,
      }),
    ),
  );
}

// Trip Notifications
export async function notifyDriverTripAssigned(
  tripId: string,
  tripNumber: string,
  origin: string,
  destination: string,
  driverId: string,
) {
  await createNotification({
    userId: driverId,
    title: "Trip Assigned",
    message: `Trip ${tripNumber} from ${origin} to ${destination} has been assigned to you.`,
    type: "info",
    module: "operations",
    entityType: "trip",
    entityId: tripId,
    actionUrl: `/trips`,
  });
}

export async function notifyOperationsTeamTripStarted(
  tripId: string,
  tripNumber: string,
  operatorIds: string[],
) {
  await Promise.all(
    operatorIds.map((id) =>
      createNotification({
        userId: id,
        title: "Trip Started",
        message: `Trip ${tripNumber} has started and is now in transit.`,
        type: "info",
        module: "operations",
        entityType: "trip",
        entityId: tripId,
        actionUrl: `/trips`,
      }),
    ),
  );
}

// POD Notifications
export async function notifyOperationsTeamPODUploaded(
  podId: string,
  podNumber: string,
  tripNumber: string,
  operatorIds: string[],
) {
  await Promise.all(
    operatorIds.map((id) =>
      createNotification({
        userId: id,
        title: "POD Uploaded",
        message: `POD ${podNumber} for trip ${tripNumber} has been uploaded and requires verification.`,
        type: "warning",
        module: "operations",
        entityType: "pod",
        entityId: podId,
        actionUrl: `/operations/pod`,
      }),
    ),
  );
}

export async function notifyFinanceTeamPODVerified(
  podId: string,
  podNumber: string,
  invoiceNumber: string,
  accountantIds: string[],
) {
  await Promise.all(
    accountantIds.map((id) =>
      createNotification({
        userId: id,
        title: "POD Verified - Invoice Generated",
        message: `POD ${podNumber} verified. Invoice ${invoiceNumber} has been auto-generated.`,
        type: "success",
        module: "finance",
        entityType: "invoice",
        entityId: podId,
        actionUrl: `/finance/invoicing/customer-invoices`,
      }),
    ),
  );
}

// Invoice Notifications
export async function notifyFinanceTeamInvoiceGenerated(
  invoiceId: string,
  invoiceNumber: string,
  customerName: string,
  amount: number,
  accountantIds: string[],
) {
  await Promise.all(
    accountantIds.map((id) =>
      createNotification({
        userId: id,
        title: "Invoice Auto-Generated",
        message: `Invoice ${invoiceNumber} for ${customerName} (${amount} TZS) has been generated from POD.`,
        type: "success",
        module: "finance",
        entityType: "invoice",
        entityId: invoiceId,
        actionUrl: `/finance/invoicing/customer-invoices`,
      }),
    ),
  );
}

// User ID Fetching Functions
export async function fetchAccountantUserIds(): Promise<string[]> {
  const { data } = await supabase
    .from("user_profiles")
    .select("id, role")
    .in("role", ["ACCOUNTANT", "CEO", "ADMIN", "HR"]);
  return (data || []).map((u) => u.id);
}

export async function fetchSalesmanUserIds(): Promise<string[]> {
  const { data } = await supabase
    .from("user_profiles")
    .select("id, role")
    .in("role", ["SALESMAN", "CEO", "ADMIN"]);
  return (data || []).map((u) => u.id);
}

export async function fetchOperatorUserIds(): Promise<string[]> {
  const { data } = await supabase
    .from("user_profiles")
    .select("id, role")
    .in("role", ["OPERATOR", "CEO", "ADMIN"]);
  return (data || []).map((u) => u.id);
}

export async function fetchDriverUserIds(): Promise<string[]> {
  const { data } = await supabase
    .from("user_profiles")
    .select("id, role")
    .eq("role", "DRIVER");
  return (data || []).map((u) => u.id);
}

// Legacy notification functions (kept for backward compatibility)
export async function notifyAccountantsExpenseSubmitted(
  driverName: string,
  amount: number,
  accountantIds: string[],
) {
  await Promise.all(
    accountantIds.map((id) =>
      createNotification({
        userId: id,
        title: "Expense pending review",
        message: `${driverName} submitted an expense of ${amount} for approval.`,
        type: "warning",
        module: "finance",
        entityType: "expense",
      }),
    ),
  );
}

export async function notifyAccountantsTripRevenue(
  tripId: string,
  origin: string,
  destination: string,
  amount: number,
  accountantIds: string[],
) {
  await Promise.all(
    accountantIds.map((id) =>
      createNotification({
        userId: id,
        title: "New Trip Revenue Recorded",
        message: `Trip ${origin} → ${destination} generated ${amount} TZS in revenue. Journal entry created.`,
        type: "success",
        module: "finance",
        entityType: "journal_entry",
        entityId: tripId,
      }),
    ),
  );
}

export async function notifySalesTeamPaymentStatus(
  tripId: string,
  clientName: string,
  status: "paid" | "pending" | "overdue",
  amount: number,
  salesmanIds: string[],
) {
  await Promise.all(
    salesmanIds.map((id) =>
      createNotification({
        userId: id,
        title: `Payment ${status.toUpperCase()}`,
        message: `Client ${clientName} payment of ${amount} TZS is now ${status}.`,
        type: status === "paid" ? "success" : status === "overdue" ? "error" : "warning",
        module: "finance",
        entityType: "payment",
        entityId: tripId,
      }),
    ),
  );
}

export async function notifyPaymentDispute(
  tripId: string,
  clientName: string,
  amount: number,
  reason: string,
  accountantIds: string[],
  salesmanIds: string[],
) {
  const allIds = [...new Set([...accountantIds, ...salesmanIds])];
  
  await Promise.all(
    allIds.map((id) =>
      createNotification({
        userId: id,
        title: "Payment Dispute Raised",
        message: `Client ${clientName} disputes payment of ${amount} TZS. Reason: ${reason}`,
        type: "error",
        module: "finance",
        entityType: "payment",
        entityId: tripId,
      }),
    ),
  );
}

export async function notifyAccountantsNewExpense(
  expenseType: string,
  amount: number,
  submittedBy: string,
  accountantIds: string[],
) {
  await Promise.all(
    accountantIds.map((id) =>
      createNotification({
        userId: id,
        title: "New Expense Submitted",
        message: `${submittedBy} submitted ${expenseType} expense of ${amount} TZS for review.`,
        type: "warning",
        module: "finance",
        entityType: "expense",
      }),
    ),
  );
}
