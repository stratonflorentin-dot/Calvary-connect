"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useCurrency } from '@/hooks/use-currency';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';

import { FileText, Plus, Download, Calendar, TrendingUp } from 'lucide-react';

interface Report {
    id: string;
    title: string;
    type: string;
    content: string;
    period: string;
    createdAt: string;
    updatedAt: string;
}

export default function ReportsPage() {
    const { role, isAdmin } = useRole();
    const { format, currency } = useCurrency();

    const { user } = useSupabase();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [reports, setReports] = useState<Report[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch reports from Supabase
    useEffect(() => {
        const fetchReports = async () => {
            setIsLoading(true);
            
            try {
                // Real Supabase data fetching
                const { data, error } = await supabase
                    .from('reports')
                    .select('*')
                    .order('updated_at', { ascending: false });
                if (error) {
                    console.error('Error fetching reports:', error?.message || error);
                    // Handle case where table doesn't exist
                    if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
                        console.log('Reports table does not exist yet - showing empty state');
                    }
                    setReports([]);
                } else {
                    setReports(data as Report[]);
                }
            } catch (error) {
                console.error('Error fetching reports:', error);
                setReports([]);
            }
            setIsLoading(false);
        };
        fetchReports();
    }, []);

    const handleAddReport = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const reportData = {
            title: formData.get('title') as string,
            type: formData.get('type') as string,
            content: formData.get('content') as string,
            period: formData.get('period') as string,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: user?.id
        };

        try {
            // Real Supabase insertion
            const { error } = await supabase.from('reports').insert([reportData]);
            if (!error) {
                // Success: refresh reports
                const { data } = await supabase
                    .from('reports')
                    .select('*')
                    .order('updated_at', { ascending: false });
                setReports(data as Report[]);
                setIsAddDialogOpen(false);
                e.currentTarget.reset();
            } else {
                console.error('Error adding report:', error);
                // Handle case where table doesn't exist
                if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
                    alert('Reports table needs to be created first. Please run the reports-system-setup.sql script.');
                }
            }
        } catch (error) {
            console.error('Error adding report:', error);
        }
    };

    const handleDownloadReport = (report: Report) => {
        const blob = new Blob([report.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.title}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (!role) return null;

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar role={role} />
            <main className="flex-1 md:ml-60 p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-headline tracking-tighter">Reports</h1>
                            <p className="text-muted-foreground">Generate and manage business reports</p>
                        </div>
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus className="size-4" />
                                    Create Report
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Create New Report</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleAddReport} className="space-y-4">
                                    <div>
                                        <Label htmlFor="title">Report Title</Label>
                                        <Input id="title" name="title" required />
                                    </div>
                                    <div>
                                        <Label htmlFor="type">Report Type</Label>
                                        <Select name="type" required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="financial">Financial Report</SelectItem>
                                                <SelectItem value="operational">Operational Report</SelectItem>
                                                <SelectItem value="fleet">Fleet Report</SelectItem>
                                                <SelectItem value="maintenance">Maintenance Report</SelectItem>
                                                <SelectItem value="custom">Custom Report</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor="period">Period</Label>
                                        <Input id="period" name="period" placeholder="e.g., Q1 2024, January 2024" required />
                                    </div>
                                    <div>
                                        <Label htmlFor="content">Report Content</Label>
                                        <Textarea
                                            id="content"
                                            name="content"
                                            rows={10}
                                            placeholder="Enter report details, findings, and conclusions..."
                                            required
                                        />
                                    </div>
                                    <Button type="submit" className="w-full">Create Report</Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
                                <FileText className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{isLoading ? '...' : reports?.length || 0}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Financial Reports</CardTitle>
                                <TrendingUp className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {isLoading ? '...' : reports?.filter(r => r.type === 'financial').length || 0}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Operational Reports</CardTitle>
                                <FileText className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {isLoading ? '...' : reports?.filter(r => r.type === 'operational').length || 0}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                                <Calendar className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {isLoading ? '...' : reports?.filter(r => new Date(r.createdAt).getMonth() === new Date().getMonth()).length || 0}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Reports Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>All Reports</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Period</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5}>Loading...</TableCell>
                                        </TableRow>
                                    ) : reports?.map((report) => (
                                        <TableRow key={report.id}>
                                            <TableCell className="font-medium">{report.title}</TableCell>
                                            <TableCell>
                                                <span className="capitalize">{report.type}</span>
                                            </TableCell>
                                            <TableCell>{report.period}</TableCell>
                                            <TableCell>{new Date(report.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button variant="outline" size="sm">
                                                                <FileText className="size-4" />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                                            <DialogHeader>
                                                                <DialogTitle>{report.title}</DialogTitle>
                                                                <p className="text-sm text-muted-foreground">
                                                                    {report.type} • {report.period}
                                                                </p>
                                                            </DialogHeader>
                                                            <div className="whitespace-pre-wrap text-sm">
                                                                {report.content}
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDownloadReport(report)}
                                                    >
                                                        <Download className="size-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}




