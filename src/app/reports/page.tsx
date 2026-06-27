"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, TrendingUp, PieChart, BarChart3, Users } from 'lucide-react';
import Link from 'next/link';
import ExecutiveSummary from './executive-summary';
import { ProfessionalFinancialReport } from '@/components/financial/professional-financial-report';

export default function ReportsPage() {
    const { role } = useRole();

    if (!role) return null;

    const showFinancialTab = ["CEO", "ADMIN", "ACCOUNTANT", "HR"].includes(role);

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
                        <TabsList className={`grid w-full ${showFinancialTab ? 'grid-cols-4 lg:w-[400px]' : 'grid-cols-3 lg:w-[300px]'} bg-card border-border shadow-lg`}>
                            <TabsTrigger value="executive" className="gap-2">
                                <BarChart3 className="size-4" />
                                <span className="hidden sm:inline">Executive</span>
                            </TabsTrigger>
                            {showFinancialTab && (
                                <TabsTrigger value="financial" className="gap-2">
                                    <TrendingUp className="size-4" />
                                    <span className="hidden sm:inline">Financial</span>
                                </TabsTrigger>
                            )}
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

                        {showFinancialTab && (
                            <TabsContent value="financial" className="mt-6 space-y-6">
                                <ProfessionalFinancialReport />
                            </TabsContent>
                        )}

                        <TabsContent value="operational" className="mt-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                
                                {/* Driver Performance */}
                                <Card className="hover:shadow-xl transition-all border-border shadow-lg">
                                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                        <div className="bg-info/10 dark:bg-info/10 p-3 rounded-2xl">
                                            <Users className="size-6 text-info" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold text-foreground">Driver Performance</CardTitle>
                                            <p className="text-xs text-muted-foreground mt-0.5">Trips count, distance, fuel & rating analytics</p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-2">
                                        <p className="text-sm text-muted-foreground">
                                            Evaluate individual driver efficiency, completed trips, average safety ratings, fuel usage, and delivery performance.
                                        </p>
                                        <Link 
                                            href="/admin/reports/fleet/driver-performance"
                                            className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-background rounded-xl text-sm font-bold transition-all shadow-md"
                                        >
                                            View Performance Dashboard
                                        </Link>
                                    </CardContent>
                                </Card>

                                {/* Route Profitability */}
                                <Card className="hover:shadow-xl transition-all border-border shadow-lg">
                                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                        <div className="bg-success/10 dark:bg-success/10 p-3 rounded-2xl">
                                            <TrendingUp className="size-6 text-success" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold text-foreground">Route Profitability</CardTitle>
                                            <p className="text-xs text-muted-foreground mt-0.5">Route revenue, border, toll & margin audit</p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-2">
                                        <p className="text-sm text-muted-foreground">
                                            Analyze specific shipping lanes to understand gross profit margins, borders/tolls costs, and identify the most profitable routes.
                                        </p>
                                        <Link 
                                            href="/admin/reports/fleet/route-profitability"
                                            className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-background rounded-xl text-sm font-bold transition-all shadow-md"
                                        >
                                            Analyze Route Profits
                                        </Link>
                                    </CardContent>
                                </Card>

                                {/* Fuel Consumption */}
                                <Card className="hover:shadow-xl transition-all border-border shadow-lg">
                                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                        <div className="bg-warning/10 dark:bg-warning/10 p-3 rounded-2xl">
                                            <PieChart className="size-6 text-warning" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold text-foreground">Fuel Consumption</CardTitle>
                                            <p className="text-xs text-muted-foreground mt-0.5">Liters dispensed, fuel costs & L/100km metrics</p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-2">
                                        <p className="text-sm text-muted-foreground">
                                            Audit fuel logs per vehicle, sum total fuel dispensed and costs, and calculate exact L/100km fuel consumption ratios.
                                        </p>
                                        <Link 
                                            href="/admin/reports/fleet/fuel"
                                            className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-background rounded-xl text-sm font-bold transition-all shadow-md"
                                        >
                                            Track Fuel Consumption
                                        </Link>
                                    </CardContent>
                                </Card>

                                {/* Vehicle Revenue */}
                                <Card className="hover:shadow-xl transition-all border-border shadow-lg">
                                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                        <div className="bg-accent/10 dark:bg-accent/10 p-3 rounded-2xl">
                                            <FileText className="size-6 text-accent" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold text-foreground">Vehicle Revenue</CardTitle>
                                            <p className="text-xs text-muted-foreground mt-0.5">Operational profits, trip costs & margins per truck</p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-2">
                                        <p className="text-sm text-muted-foreground">
                                            Examine vehicle-level gross earnings, direct fuel/toll expenses, net profit, and general financial performance logs.
                                        </p>
                                        <Link 
                                            href="/admin/reports/fleet/revenue-by-vehicle"
                                            className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-background rounded-xl text-sm font-bold transition-all shadow-md"
                                        >
                                            Audit Vehicle Revenues
                                        </Link>
                                    </CardContent>
                                </Card>

                            </div>
                        </TabsContent>

                        <TabsContent value="custom" className="mt-8 space-y-6">
                            <Card className="border-border shadow-lg">
                                <CardHeader>
                                    <CardTitle className="text-foreground">Custom Reports</CardTitle>
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





