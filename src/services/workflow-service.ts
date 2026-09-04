import { SupabaseService } from "./supabase-service";
import { Trip, MaintenanceRequest, Expense, Allowance } from "@/types/roles";
import { createNotification, fetchAccountantUserIds } from "./notification-service";
import { supabase } from "@/lib/supabase";

export class WorkflowService {
  /**
   * Completes a trip and automatically handles financial invoicing.
   * Connects Logistics -> Finance
   */
  static async completeTrip(tripId: string, actualData: Partial<Trip>) {
    // 1. Update trip status
    const updatedTrip = await SupabaseService.updateTrip(tripId, {
      ...actualData,
      status: "delivered",
      endTime: new Date().toISOString()
    });

    // 2. Automatically create a Sale record in Finance
    const sale = await SupabaseService.createSale({
      date: new Date().toISOString(),
      clientName: updatedTrip.client || "Walk-in Client",
      description: `Freight Revenue: Trip #${updatedTrip.tripNumber || updatedTrip.id} (${updatedTrip.origin} -> ${updatedTrip.destination})`,
      amount: updatedTrip.totalAmount || updatedTrip.salesAmount || 0,
      tripId: updatedTrip.id,
      status: "pending"
    });

    // 3. Automatically create a Receivable Invoice
    await SupabaseService.createInvoice({
      invoice_number: `INV-${updatedTrip.tripNumber || updatedTrip.id}`,
      customer_name: updatedTrip.client || "Walk-in Client",
      amount: updatedTrip.totalAmount || updatedTrip.salesAmount || 0,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days net
      status: "pending",
      type: "receivable",
      linked_revenue: sale.id
    });

    // 4. Notify Finance Team
    const accountants = await fetchAccountantUserIds();
    await Promise.all(accountants.map(id => createNotification({
      userId: id,
      module: "finance",
      category: "delivery_update",
      title: "New Revenue Generated",
      message: `Trip #${updatedTrip.tripNumber || updatedTrip.id} completed. Invoice generated for ${updatedTrip.client}.`,
      type: "success",
      severity: "success"
    })));

    return updatedTrip;
  }

  /**
   * Approves a fuel request and creates a corresponding expense.
   * Connects Fleet -> Finance
   */
  static async approveFuelRequest(requestId: string, approvedBy: string) {
    // 1. Update request status
    const request = await SupabaseService.updateFuelRequest(requestId, {
      status: "approved",
      approved_by: approvedBy,
      approved_at: new Date().toISOString()
    });

    // 2. Create financial expense
    const expense = await SupabaseService.createExpense({
      type: "fuel",
      amount: request.amount,
      description: `Fuel for Vehicle ${request.vehicleId} (Ref: ${request.id})`,
      vehicleId: request.vehicleId,
      vehicle_id: request.vehicleId, // Ensure both variants are set
      driverId: request.driverId,
      driver_id: request.driverId, // Ensure both variants are set
      category: "Direct Logistics Costs",
      status: "approved",
      approvedBy: approvedBy
    });

    // 3. Create Payable Invoice (Bill)
    await SupabaseService.createInvoice({
      invoice_number: `FUEL-${request.id}`,
      customer_name: "Fuel Supplier",
      amount: request.amount,
      due_date: new Date().toISOString(),
      status: "pending",
      type: "payable",
      linked_expense: expense.id
    });

    // 4. Notify Driver
    await createNotification({
      userId: request.driverId,
      module: "operations",
      category: "fuel_approval",
      title: "Fuel Request Approved",
      message: `Your fuel request for ${request.amount} has been approved.`,
      type: "success",
      severity: "success"
    });

    return request;
  }

  /**
   * Completes a maintenance request and creates a maintenance expense.
   * Connects Maintenance -> Finance
   */
  static async completeMaintenance(requestId: string, actualCost: number) {
    // 1. Update the maintenance record. This has to be maintenance_records —
    // applyTransition() (src/lib/workflow/engine.ts, maintenanceMachine)
    // already flips this same row's status there before calling this
    // function. It previously called SupabaseService.updateMaintenanceRequest(),
    // which targets the *different*, legacy maintenance_requests table — a
    // .single() update against a row that doesn't exist there throws, so
    // every completion has been silently swallowed by runSideEffects()'s
    // "degrades to a warning" catch: the status change stood, but the cost
    // was never actually posted as an expense. Found while building the
    // Mechanic Service Queue's "Complete & release vehicle" action.
    const { data: request, error: updateError } = await supabase
      .from("maintenance_records")
      .update({
        status: "completed",
        actual_cost: actualCost,
        completed_date: new Date().toISOString().split("T")[0],
      })
      .eq("id", requestId)
      .select()
      .single();
    if (updateError) throw updateError;

    // 2. Release the vehicle back to service — the thing this action is
    // named for, and the one step that was never here at all before.
    if (request.vehicle_id) {
      await supabase.from("vehicles").update({ status: "available" }).eq("id", request.vehicle_id);
    }

    // 3. Post the real cost as an expense. createExpense() already creates
    // its own payable invoice internally (see its own body) — the explicit
    // createInvoice() call this function used to make right after it was a
    // second, duplicate bill for the same cost every time; removed rather
    // than kept as a second bug alongside the table-name one.
    const expense = await SupabaseService.createExpense({
      category: "Fleet Maintenance",
      amount: actualCost,
      description: `Maintenance: ${request.title ?? request.description ?? ""} (Vehicle: ${request.vehicle_id ?? "unknown"})`,
      vehicle_id: request.vehicle_id,
      status: "approved",
    } as any);

    return { ...request, linkedExpenseId: expense?.id };
  }

  /**
   * Processes payroll/allowance and syncs to Finance.
   * Connects HR -> Finance
   */
  static async processAllowance(allowanceId: string, approvedBy: string) {
    // 1. Update allowance status
    const allowance = await SupabaseService.updateAllowance(allowanceId, {
      status: "approved",
      updated_at: new Date().toISOString()
    });

    // 2. Create financial expense for payroll
    const expense = await SupabaseService.createExpense({
      type: "allowance",
      amount: allowance.amount,
      description: `Allowance: ${allowance.workerName} - ${allowance.reason}`,
      driverId: allowance.employee_id,
      category: "Staff Costs",
      status: "approved",
      approvedBy: approvedBy
    });

    // 3. Create Payable Invoice
    await SupabaseService.createInvoice({
      invoice_number: `PAY-${allowance.id}`,
      customer_name: allowance.workerName,
      amount: allowance.amount,
      due_date: new Date().toISOString(),
      status: "pending",
      type: "payable",
      linked_expense: expense.id
    });

    // 4. Notify Employee
    await createNotification({
      userId: allowance.employee_id,
      module: "hr",
      category: "general",
      title: "Allowance Approved",
      message: `Your allowance for ${allowance.amount} has been approved and sent for payment.`,
      type: "success",
      severity: "success"
    });

    return allowance;
  }
}
