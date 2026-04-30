"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { ProfessionalFinancialReport } from '@/components/financial/professional-financial-report';

export default function MonthlyReportPage() {
    const { role } = useRole();
    if (!role) return null;

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar role={role} />
            <main className="flex-1 md:ml-60 p-4 md:p-8">
                <ProfessionalFinancialReport />
            </main>
        </div>
    );
}
