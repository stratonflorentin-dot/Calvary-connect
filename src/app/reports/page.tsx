"use client";

import { PageShell, PageHeader } from '@/components/shell';
import { useRole } from '@/hooks/use-role';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, TrendingUp, PieChart, BarChart3, Users, Scale, ArrowRight, BriefcaseBusiness, Route, WalletCards } from 'lucide-react';
import Link from 'next/link';
import ExecutiveSummary from './executive-summary';
import { ProfessionalFinancialReport } from '@/components/financial/professional-financial-report';

export default function ReportsPage() {
    const { role } = useRole();

    if (!role) return null;

    const showFinancialTab = ["CEO", "ADMIN", "ACCOUNTANT", "HR"].includes(role);

    return (
        <PageShell>
            <PageHeader
                eyebrow="Analytics"
                title="Reports & Analytics"
                subtitle="Financial reports and business analytics across the fleet"
                icon={BarChart3}
            />
            <div className="space-y-6">
                    <section className="border border-border bg-card rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-border">
                            <h2 className="text-sm font-black text-foreground">Enterprise reporting flow</h2>
                            <p className="text-xs text-muted-foreground mt-1">Follow commercial activity from quote to cash, then investigate performance at the right level.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
                            <Link href="/sales/dashboard" className="group p-5 hover:bg-muted/50 transition-colors">
                                <BriefcaseBusiness className="size-5 text-primary mb-3" />
                                <p className="text-sm font-bold">Sales pipeline</p>
                                <p className="text-xs text-muted-foreground mt-1">Leads, quotations, contracts and bookings.</p>
                                <span className="mt-3 text-xs font-bold text-primary inline-flex items-center gap-1">Open sales <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" /></span>
                            </Link>
                            <Link href="/operations/dashboard" className="group p-5 hover:bg-muted/50 transition-colors">
                                <Route className="size-5 text-info mb-3" />
                                <p className="text-sm font-bold">Operations control</p>
                                <p className="text-xs text-muted-foreground mt-1">Dispatch, trips, delivery evidence and fleet execution.</p>
                                <span className="mt-3 text-xs font-bold text-primary inline-flex items-center gap-1">Open operations <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" /></span>
                            </Link>
                            <Link href="/finance" className="group p-5 hover:bg-muted/50 transition-colors">
                                <WalletCards className="size-5 text-success mb-3" />
                                <p className="text-sm font-bold">Finance & collections</p>
                                <p className="text-xs text-muted-foreground mt-1">Invoices, collections, bank matching and statutory books.</p>
                                <span className="mt-3 text-xs font-bold text-primary inline-flex items-center gap-1">Open finance <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" /></span>
                            </Link>
                            <Link href="/finance/reports" className="group p-5 hover:bg-muted/50 transition-colors">
                                <BarChart3 className="size-5 text-warning mb-3" />
                                <p className="text-sm font-bold">Board & compliance</p>
                                <p className="text-xs text-muted-foreground mt-1">P&L, cash flow, tax, ageing and reconciliation.</p>
                                <span className="mt-3 text-xs font-bold text-primary inline-flex items-center gap-1">Open reports <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" /></span>
                            </Link>
                        </div>
                    </section>
                    {/* Tabs */}
                    <Tabs defaultValue="executive" className="w-full">
                        <TabsList className={`grid w-full ${showFinancialTab ? 'grid-cols-3 lg:w-[400px]' : 'grid-cols-2 lg:w-[300px]'} bg-card border-border shadow-lg`}>
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
                                            className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold transition-all shadow-md"
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
                                            className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold transition-all shadow-md"
                                        >
                                            Analyze Route Profits
                                        </Link>
                                    </CardContent>
                                </Card>

                                {/* Trip Cost Variance */}
                                <Card className="hover:shadow-xl transition-all border-border shadow-lg">
                                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                        <div className="bg-destructive/10 dark:bg-destructive/10 p-3 rounded-2xl">
                                            <Scale className="size-6 text-destructive" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-bold text-foreground">Trip Cost Variance</CardTitle>
                                            <p className="text-xs text-muted-foreground mt-0.5">Requested vs. approved vs. actually paid, per trip</p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 pt-2">
                                        <p className="text-sm text-muted-foreground">
                                            Flags trips where what was actually paid drifted from what was approved — catches cost overruns before they show up in the P&L.
                                        </p>
                                        <Link
                                            href="/admin/reports/fleet/trip-cost-variance"
                                            className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold transition-all shadow-md"
                                        >
                                            View Cost Variance
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
                                            className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold transition-all shadow-md"
                                        >
                                            Track Fuel Consumption
                                        </Link>
                                    </CardContent>
                                </Card>

                                {/* Vehicle Revenue */}
                                <Card className="hover:shadow-xl transition-all border-border shadow-lg">
                                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                        <div className="bg-accent/10 dark:bg-accent/10 p-3 rounded-2xl">
                                            <FileText className="size-6 text-accent-foreground" />
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
                                            className="inline-flex w-full items-center justify-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold transition-all shadow-md"
                                        >
                                            Audit Vehicle Revenues
                                        </Link>
                                    </CardContent>
                                </Card>

                            </div>
                        </TabsContent>

                    </Tabs>
            </div>
        </PageShell>
    );
}





