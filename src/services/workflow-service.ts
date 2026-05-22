import { SupabaseService } from "./supabase-service";
import { Trip, MaintenanceRequest, Expense } from "@/types/roles";

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
      description: `Freight Revenue: Trip #${updatedTrip.tripNumber} (${updatedTrip.origin} -> ${updatedTrip.destination})`,
      amount: updatedTrip.totalAmount || updatedTrip.salesAmount || 0,
      tripId: updatedTrip.id,
      status: "pending"
    });

    // 3. Automatically create a Receivable Invoice
    await SupabaseService.createInvoice({
      invoice_number: `INV-${updatedTrip.tripNumber}`,
      customer_name: updatedTrip.client || "Walk-in Client",
      amount: updatedTrip.totalAmount || updatedTrip.salesAmount || 0,
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days net
      status: "pending",
      type: "receivable",
      linked_revenue: sale.id
    });

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
    await SupabaseService.createExpense({
      type: "fuel",
      amount: request.amount,
      description: `Fuel for Vehicle ${request.vehicleId} (Ref: ${request.id})`,
      vehicleId: request.vehicleId,
      driverId: request.driverId,
      category: "Direct Logistics Costs",
      status: "approved",
      approvedBy: approvedBy
    });

    return request;
  }

  /**
   * Completes a maintenance request and creates a maintenance expense.
   * Connects Maintenance -> Finance
   */
  static async completeMaintenance(requestId: string, actualCost: number) {
    // 1. Update maintenance request
    const request = await SupabaseService.updateMaintenanceRequest(requestId, {
      status: "completed",
      actual_cost: actualCost,
      completed_at: new Date().toISOString()
    } as any);

    // 2. Create financial expense
    await SupabaseService.createExpense({
      type: "maintenance",
      amount: actualCost,
      description: `Maintenance: ${request.description} (Vehicle: ${request.vehicleId})`,
      vehicleId: request.vehicleId,
      category: "Fleet Maintenance",
      status: "approved"
    });

    return request;
  }
}
