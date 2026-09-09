"use client";

import { useRole } from '@/hooks/use-role';
import { PageShell, PageHeader } from '@/components/shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RateSheetManager } from '@/components/rate-sheet-manager';
import IconFallback from '@/components/icons/IconFallback.client';
import { Settings } from 'lucide-react';

export default function AdminSettingsPage() {
    const { role } = useRole();
    const effectiveRole = role || 'ADMIN';

    // Only allow admins and managers
    if (!['ADMIN', 'CEO'].includes(effectiveRole)) {
        return (
            <PageShell>
                <div className="p-8">
                    <Card className="border-destructive/20 bg-destructive/10 shadow-lg">
                        <CardContent className="flex items-center gap-3 p-6">
                            <IconFallback name="AlertCircle" className="size-6 text-destructive" />
                            <div>
                                <h3 className="font-semibold text-destructive">Access Denied</h3>
                                <p className="text-sm text-destructive">Only administrators can access this page.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell>
            <div className="space-y-8">
                <PageHeader
                    eyebrow="System"
                    title="Admin Settings"
                    subtitle="Manage system configuration and pricing"
                    icon={Settings}
                />

                {/* Rate Sheet Management */}
                <section>
                    <RateSheetManager />
                </section>

                {/* Additional Settings Sections */}
                <Card className="border-border shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-foreground">System Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-sm font-semibold text-muted-foreground">Database</p>
                            <p className="text-sm text-foreground">Supabase PostgreSQL</p>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-muted-foreground">Current Role</p>
                            <p className="text-sm capitalize text-foreground">{effectiveRole}</p>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-muted-foreground">Last Updated</p>
                            <p className="text-sm text-foreground">{new Date().toLocaleString()}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageShell>
    );
}
