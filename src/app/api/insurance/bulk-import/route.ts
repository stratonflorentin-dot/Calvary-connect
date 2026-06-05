import { NextResponse } from 'next/server';
import { InsuranceService } from '@/services/insurance-service';
import { TruckInsurance } from '@/types/roles';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { records, format } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: 'Records array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate record structure
    const validRecords = records.map((record: any) => ({
      vehicle_id: record.vehicle_id || record.vehicleId,
      insurer_name: record.insurer_name || record.insurerName,
      policy_type: record.policy_type || record.policyType,
      tira_reference_number: record.tira_reference_number || record.tiraReferenceNumber,
      start_date: record.start_date || record.startDate,
      expiry_date: record.expiry_date || record.expiryDate,
      annual_premium: parseFloat(record.annual_premium || record.annualPremium),
      assigned_driver_id: record.assigned_driver_id || record.assignedDriverId,
      route_coverage_area: record.route_coverage_area || record.routeCoverageArea,
      is_cross_border: record.is_cross_border || record.isCrossBorder || false,
      has_comesa_yellow_card: record.has_comesa_yellow_card || record.hasComesaYellowCard || false,
      notes: record.notes,
    } as Partial<TruckInsurance>));

    const result = await InsuranceService.bulkImportInsurance(validRecords);

    return NextResponse.json({
      message: 'Bulk import completed',
      ...result,
    });
  } catch (error: any) {
    console.error('POST /api/insurance/bulk-import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
