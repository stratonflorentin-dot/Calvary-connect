import { NextResponse } from 'next/server';
import { InsuranceService } from '@/services/insurance-service';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const checkType = searchParams.get('type') || 'tira';

    if (checkType === 'tira') {
      const complianceReport = await InsuranceService.validateTIRACompliance();
      const compliant = complianceReport.filter(c => c.compliant).length;
      const nonCompliant = complianceReport.filter(c => !c.compliant).length;

      return NextResponse.json({
        check_type: 'tira',
        description: 'Tanzanian TIRA - Every truck must have minimum Third Party coverage',
        data: complianceReport,
        summary: {
          total_vehicles: complianceReport.length,
          compliant,
          non_compliant: nonCompliant,
          compliance_rate: `${((compliant / complianceReport.length) * 100).toFixed(1)}%`,
        },
      });
    } else if (checkType === 'cross_border') {
      const crossBorderReport = await InsuranceService.checkCrossBorderCoverage();
      const withYellowCard = crossBorderReport.filter(p => p.has_comesa_yellow_card).length;
      const needsYellowCard = crossBorderReport.filter(p => p.needs_yellow_card).length;

      return NextResponse.json({
        check_type: 'cross_border',
        description: 'Cross-border trucks require COMESA Yellow Card coverage',
        data: crossBorderReport,
        summary: {
          cross_border_vehicles: crossBorderReport.length,
          with_yellow_card: withYellowCard,
          needs_yellow_card: needsYellowCard,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid check type. Use "tira" or "cross_border"' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('GET /api/insurance/compliance error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
