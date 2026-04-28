"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, TrendingUp, PieChart, BarChart3 } from 'lucide-react';
import ExecutiveSummary from './executive-summary';

export default function ReportsPage() {
    const { role } = useRole();

    if (!role) return null;

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar role={role} />
            <main className="flex-1 md:ml-60 p-4 md:p-8 overflow-auto">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-headline tracking-tighter">Reports & Analytics</h1>
                            <p className="text-muted-foreground">View financial reports and business analytics</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <Tabs defaultValue="executive" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
                            <TabsTrigger value="executive" className="gap-2">
                                <BarChart3 className="size-4" />
                                <span className="hidden sm:inline">Executive</span>
                            </TabsTrigger>
                            <TabsTrigger value="financial" className="gap-2">
                                <TrendingUp className="size-4" />
                                <span className="hidden sm:inline">Financial</span>
                            </TabsTrigger>
                            <TabsTrigger value="operational" className="gap-2">
                                <PieChart className="size-4" />
                                <span className="hidden sm:inline">Operational</span>
                            </TabsTrigger>
                            <TabsTrigger value="custom" className="gap-2">
                                <FileText className="size-4" />
                                <span className="hidden sm:inline">Custom</span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="executive" className="mt-6">
                            <ExecutiveSummary />
                        </TabsContent>

                        <TabsContent value="financial" className="mt-6 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Financial Reports</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">Detailed financial reports coming soon...</p>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="operational" className="mt-6 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Operational Reports</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">Fleet and operational metrics coming soon...</p>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="custom" className="mt-6 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Custom Reports</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">Create and manage custom reports...</p>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
        </div>
    );
}




