"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useCurrency } from '@/hooks/use-currency';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, DollarSign, Truck, Fuel, Wrench } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

export default function MonthlyReportPage() {
    const { role, isAdmin } = useRole();
    const { format, currency } = useCurrency();
    const { user } = useSupabase();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [income, setIncome] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [trips, setTrips] = useState<any[]>([]);
    const [fuelRequests, setFuelRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const currentMonth = useMemo(() => new Date(selectedYear, selectedMonth - 1), [selectedMonth, selectedYear]);
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    useEffect(() => {
        const loadReportData = async () => {
            if (!user) return;
            
            try {
                setLoading(true);
                
                // Load real income data from completed trips
                const { data: tripIncome } = await supabase
                    .from('trips')
                    .select('revenue, price, created_at')
                    .gte('created_at', startOfMonth.toISOString())
                    .lte('created_at', endOfMonth.toISOString())
                    .eq('status', 'completed');
                
                // Load real expense data
                const { data: realExpenses } = await supabase
                    .from('expenses')
                    .select('*')
                    .gte('created_at', startOfMonth.toISOString())
                    .lte('created_at', endOfMonth.toISOString());
                
                // Load real trips data
                const { data: realTrips } = await supabase
                    .from('trips')
                    .select('revenue, price, created_at, status')
                    .gte('created_at', startOfMonth.toISOString())
                    .lte('created_at', endOfMonth.toISOString());
                
                // Load real fuel requests
                const { data: realFuelRequests } = await supabase
                    .from('fuel_requests')
                    .select('*')
                    .gte('created_at', startOfMonth.toISOString())
                    .lte('created_at', endOfMonth.toISOString());
                
                // Convert trip data to income format
                const incomeData = tripIncome?.map(trip => ({
                    id: trip.id,
                    amount: trip.revenue || trip.price || 0,
                    date: trip.created_at,
                    source: 'Trip Revenue'
                })) || [];
                
                setIncome(incomeData);
                setExpenses(realExpenses || []);
                setTrips(realTrips || []);
                setFuelRequests(realFuelRequests || []);
                
            } catch (error) {
                console.error('Error loading report data:', error);
                // Set empty arrays on error
                setIncome([]);
                setExpenses([]);
                setTrips([]);
                setFuelRequests([]);
            } finally {
                setLoading(false);
            }
        };

        loadReportData();
    }, [user, selectedMonth, selectedYear]);

    // Calculate totals from real data
    const totalIncome = income.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const totalTrips = trips.filter(trip => trip.status === 'completed').length;
    const totalFuel = fuelRequests.reduce((sum: number, req: any) => sum + (req.amount || 0), 0);
    const maintenanceCount = expenses.filter((expense: any) => expense.category === 'MAINTENANCE').length;
    const netProfit = totalIncome - totalExpenses;
    const monthlyData = [
        { name: 'Income', value: totalIncome },
        { name: 'Expenses', value: totalExpenses },
        { name: 'Net Profit', value: netProfit },
    ];

    const expenseCategories = useMemo(() => {
        const categories: { [key: string]: number } = {};
        expenses?.forEach(expense => {
            categories[expense.category] = (categories[expense.category] || 0) + expense.amount;
        });
        return Object.entries(categories).map(([name, value]) => ({ name, value }));
    }, [expenses]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

    if (!role) return null;

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar role={role} />
            <main className="flex-1 md:ml-60 p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-headline tracking-tighter">Financial Reporting</h1>
                            <p className="text-muted-foreground">
                                Financial Dashboard and Period Reports for {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                                <SelectTrigger className="w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                                            {new Date(0, i).toLocaleDateString('en-US', { month: 'long' })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                                <SelectTrigger className="w-24">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 5 }, (_, i) => (
                                        <SelectItem key={new Date().getFullYear() - i} value={(new Date().getFullYear() - i).toString()}>
                                            {new Date().getFullYear() - i}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                                <TrendingUp className="size-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{format(totalIncome)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                                <TrendingDown className="size-4 text-red-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">{format(totalExpenses)}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                                <DollarSign className={`size-4 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {format(netProfit)}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Trips Completed</CardTitle>
                                <Truck className="size-4 text-blue-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalTrips}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Financial Overview */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Financial Overview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={monthlyData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis tickFormatter={(value) => format(value)} />
                                        <Tooltip formatter={(value) => format(value as number)} />
                                        <Bar dataKey="value" fill="#8884d8" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Expense Categories */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Expense Breakdown</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={expenseCategories}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {expenseCategories.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => format(value as number)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Operational Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Fuel Costs</CardTitle>
                                <Fuel className="size-4 text-orange-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{format(totalFuel)}</div>
                                <p className="text-xs text-muted-foreground">
                                    {fuelRequests?.length || 0} fuel requests
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Maintenance Issues</CardTitle>
                                <Wrench className="size-4 text-yellow-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{maintenanceCount}</div>
                                <p className="text-xs text-muted-foreground">
                                    Reported this month
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Avg. Trip Revenue</CardTitle>
                                <TrendingUp className="size-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {totalTrips > 0 ? format(totalIncome / totalTrips) : format(0)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Per completed trip
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}




