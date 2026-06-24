"use client";

import { useRole } from '@/hooks/use-role';
import { Sidebar } from '@/components/navigation/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RateSheetManager } from '@/components/rate-sheet-manager';
import IconFallback from '@/components/icons/IconFallback.client';

export default function AdminSettingsPage() {
    const { role } = useRole();
    const effectiveRole = role || 'ADMIN';

    // Only allow admins and managers
    if (!['ADMIN', 'CEO'].includes(effectiveRole)) {
        return (
            <div className="flex min-h-screen bg-background">
                <Sidebar role={effectiveRole} />
                <main className="flex-1 md:ml-60 p-8">
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="flex items-center gap-3 p-6">
                            <IconFallback name="AlertCircle" className="size-6 text-red-600" />
                            <div>
                                <h3 className="font-semibold text-red-900">Access Denied</h3>
                                <p className="text-sm text-red-700">Only administrators can access this page.</p>
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar role={effectiveRole} />
            <main className="flex-1 md:ml-60 p-4 md:p-8 overflow-auto">
                <div className="max-w-7xl mx-auto space-y-8">
                    {/* Header */}
                    <div>
                        <h1 className="text-3xl font-headline tracking-tighter">Admin Settings</h1>
                        <p className="text-muted-foreground">Manage system configuration and pricing</p>
                    </div>

                    {/* Rate Sheet Management */}
                    <section>
                        <RateSheetManager />
                    </section>

                    {/* Additional Settings Sections */}
                    <Card>
                        <CardHeader>
                            <CardTitle>System Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">Database</p>
                                <p className="text-sm">Supabase PostgreSQL</p>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">Current Role</p>
                                <p className="text-sm capitalize">{effectiveRole}</p>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">Last Updated</p>
                                <p className="text-sm">{new Date().toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
