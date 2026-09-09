"use client";

import { PageShell } from '@/components/shell';
import { useRole } from '@/hooks/use-role';
import { ProfessionalFinancialReport } from '@/components/financial/professional-financial-report';

export default function MonthlyReportPage() {
    const { role } = useRole();
    if (!role) return null;

    return (
        <PageShell>
            <ProfessionalFinancialReport />
        </PageShell>
    );
}
