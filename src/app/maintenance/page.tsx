'use client';

import { useMaintenance } from '@/hooks/data/use-maintenance';
import { useRole } from '@/hooks/use-role';
import { useCurrency } from '@/hooks/use-currency';
import { useLanguage } from '@/hooks/use-language';
import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Wrench,
    Plus,
    AlertTriangle,
    Clock,
    CheckCircle2,
    Pause,
    Trash2,
    Eye,
    Edit,
    Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MaintenancePage() {
    const { role, isAdmin } = useRole();
    const { format } = useCurrency();
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'requested' | 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'cancelled'>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'scheduled' | 'preventive' | 'repair' | 'breakdown' | 'inspection'>('all');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const { records, loading, stats } = useMaintenance({
        status: statusFilter === 'all' ? undefined : statusFilter,
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
        type: typeFilter === 'all' ? undefined : typeFilter,
        search: search || undefined,
    });

    const paginatedRecords = records.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );
    const totalPages = Math.ceil(records.length / pageSize);

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30';
            case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30';
            case 'medium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30';
            case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'requested': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30';
            case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30';
            case 'in_progress': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30';
            case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30';
            case 'postponed': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30';
            case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Access denied</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                        <Wrench className="w-8 h-8 text-primary" />
                        Maintenance
                    </h1>
                    <p className="text-muted-foreground mt-1">Fleet servicing, repairs and inspections</p>
                </div>
                <Link href="/maintenance/new">
                    <Button className="bg-red-600 hover:bg-red-700 text-white gap-2">
                        <Plus className="w-4 h-4" />
                        New Record
                    </Button>
                </Link>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
                {[
                    { label: 'Total', value: stats.total, color: 'bg-slate-100 dark:bg-slate-900' },
                    { label: 'Pending Review', value: stats.requested, color: 'bg-purple-100 dark:bg-purple-900/30', icon: AlertTriangle },
                    { label: 'Scheduled', value: stats.scheduled, color: 'bg-blue-100 dark:bg-blue-900/30', icon: Clock },
                    { label: 'In Progress', value: stats.in_progress, color: 'bg-amber-100 dark:bg-amber-900/30' },
                    { label: 'Completed', value: `${stats.completed} (${format(stats.totalCompletedCost)})`, color: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
                    { label: 'Postponed', value: stats.postponed, color: 'bg-orange-100 dark:bg-orange-900/30', icon: Pause },
                    { label: 'Overdue', value: stats.overdue, color: 'bg-gray-100 dark:bg-gray-900/30' },
                ].map((card) => (
                    <div
                        key={card.label}
                        className={cn(
                            'p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all',
                            card.color,
                            statusFilter === card.label.toLowerCase().replace(' ', '_') ? 'border-primary' : 'border-transparent'
                        )}
                    >
                        <div className="text-sm font-medium text-muted-foreground">{card.label}</div>
                        <div className="text-2xl font-bold mt-1">{card.value}</div>
                    </div>
                ))}
            </div>

            {/* Filter Bar */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <Input
                            placeholder="Search record #, title, technician..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="md:col-span-2"
                        />
                        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="requested">Requested</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="postponed">Postponed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setCurrentPage(1); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="preventive">Preventive</SelectItem>
                                <SelectItem value="repair">Repair</SelectItem>
                                <SelectItem value="breakdown">Breakdown</SelectItem>
                                <SelectItem value="inspection">Inspection</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={priorityFilter} onValueChange={(val) => { setPriorityFilter(val); setCurrentPage(1); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" className="w-full gap-2">
                            <Filter className="w-4 h-4" />
                            Filter
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            <Card>
                <CardContent className="pt-6">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading records...</div>
                    ) : paginatedRecords.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No maintenance records found</div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4 font-semibold">#</th>
                                            <th className="text-left py-3 px-4 font-semibold">Vehicle</th>
                                            <th className="text-left py-3 px-4 font-semibold">Title/Source</th>
                                            <th className="text-left py-3 px-4 font-semibold">Type</th>
                                            <th className="text-left py-3 px-4 font-semibold">Priority</th>
                                            <th className="text-left py-3 px-4 font-semibold">Scheduled</th>
                                            <th className="text-left py-3 px-4 font-semibold">Technician</th>
                                            <th className="text-right py-3 px-4 font-semibold">Cost</th>
                                            <th className="text-left py-3 px-4 font-semibold">Status</th>
                                            <th className="text-left py-3 px-4 font-semibold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedRecords.map((record) => (
                                            <tr
                                                key={record.id}
                                                className={cn(
                                                    'border-b hover:bg-muted/50 transition-colors',
                                                    record.status === 'requested' && 'bg-purple-50/30 dark:bg-purple-900/10'
                                                )}
                                            >
                                                <td className="py-3 px-4">
                                                    <div className="font-mono text-xs font-bold">{record.record_number}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {new Date(record.created_at).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {record.vehicles ? (
                                                        <Link href={`/vehicles/${record.vehicle_id}`} className="text-primary hover:underline">
                                                            <div className="font-mono text-xs font-bold">{record.vehicles.plate_number}</div>
                                                            <div className="text-xs text-muted-foreground">{record.vehicles.make} {record.vehicles.model}</div>
                                                        </Link>
                                                    ) : (
                                                        <span className="text-muted-foreground">N/A</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">{record.title}</td>
                                                <td className="py-3 px-4">
                                                    <Badge variant="outline" className="text-xs">{record.type}</Badge>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge className={cn('text-xs', getPriorityColor(record.priority))}>
                                                        {record.priority}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 text-xs">{record.scheduled_date ? new Date(record.scheduled_date).toLocaleDateString() : '-'}</td>
                                                <td className="py-3 px-4 text-xs">{record.technician || '-'}</td>
                                                <td className="py-3 px-4 text-right text-xs font-mono">
                                                    {record.actual_cost ? format(record.actual_cost) : (record.estimated_cost ? format(record.estimated_cost) : '-')}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge className={cn('text-xs', getStatusColor(record.status))}>
                                                        {record.status.replace('_', ' ')}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Link href={`/maintenance/${record.id}`}>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                            {record.status === 'requested' ? (
                                                                <Eye className="w-4 h-4 text-purple-600" />
                                                            ) : (
                                                                <Edit className="w-4 h-4 text-blue-600" />
                                                            )}
                                                        </Button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="mt-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Select value={pageSize.toString()} onValueChange={(val) => { setPageSize(parseInt(val)); setCurrentPage(1); }}>
                                        <SelectTrigger className="w-32">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10 per page</SelectItem>
                                            <SelectItem value="20">20 per page</SelectItem>
                                            <SelectItem value="25">25 per page</SelectItem>
                                            <SelectItem value="50">50 per page</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <span className="text-sm text-muted-foreground">
                                        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, records.length)} of {records.length}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(p => p - 1)}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(p => p + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
