'use client';

import { useState, useEffect } from 'react';
import { useRole } from '@/hooks/use-role';
import { useToast } from '@/hooks/use-toast';
import { fetchContracts, getStatusColor } from '@/lib/contract-service';
import type { Contract, ContractStatus } from '@/types/contract';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, Edit, Download, MoreHorizontal } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';

export default function ContractsPage() {
    const { role } = useRole();
    const { toast } = useToast();
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');

    useEffect(() => {
        loadContracts();
    }, [statusFilter]);

    async function loadContracts() {
        try {
            setLoading(true);
            const data = await fetchContracts(
                statusFilter !== 'all'
                    ? { status: statusFilter as ContractStatus }
                    : undefined
            );
            setContracts(data || []);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load contracts',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }

    // FIX #7: Status badge colors and action visibility
    function renderActionButtons(contract: Contract) {
        const actions = [];

        // View always available
        actions.push(
            <Link key="view" href={`/admin/contracts/${contract.id}`}>
                <Button variant="ghost" size="sm">
                    <Eye className="w-4 h-4" />
                </Button>
            </Link>
        );

        // Edit only if draft
        if (contract.status === 'draft') {
            actions.push(
                <Link key="edit" href={`/admin/contracts/${contract.id}/edit`}>
                    <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                    </Button>
                </Link>
            );
        }

        // Download if PDF available
        if (contract.signed_pdf_url) {
            actions.push(
                <a key="download" href={contract.signed_pdf_url} download>
                    <Button variant="ghost" size="sm">
                        <Download className="w-4 h-4" />
                    </Button>
                </a>
            );
        }

        return actions;
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Contracts</h1>
                    <p className="text-gray-600 mt-1">Manage transportation contracts</p>
                </div>
                {role && ['CEO', 'ADMIN', 'SALESMAN'].includes(role) && (
                    <Link href="/admin/contracts/new">
                        <Button>New Contract</Button>
                    </Link>
                )}
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <div className="w-48">
                    <Select
                        value={statusFilter}
                        onValueChange={(value) =>
                            setStatusFilter(value as ContractStatus | 'all')
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="terminated">Terminated</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Contracts Table */}
            {loading ? (
                <div className="text-center py-8">Loading contracts...</div>
            ) : contracts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    No contracts found
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Contract #</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Effective</TableHead>
                                <TableHead>Expiry</TableHead>
                                <TableHead>Client Signed</TableHead>
                                <TableHead>Transporter Signed</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {contracts.map((contract) => {
                                const statusColor = getStatusColor(contract.status);
                                return (
                                    <TableRow key={contract.id}>
                                        <TableCell className="font-mono font-semibold">
                                            {contract.contract_number}
                                        </TableCell>
                                        <TableCell>
                                            {contract.client?.name || 'Unknown'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={`${statusColor.bg} ${statusColor.text}`}>
                                                {contract.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {new Date(contract.effective_date).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(contract.expiry_date).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            {contract.client_signed_at ? (
                                                <span className="text-green-600 font-semibold">✓ Signed</span>
                                            ) : (
                                                <span className="text-gray-400">Pending</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {contract.transporter_signed_at ? (
                                                <span className="text-green-600 font-semibold">✓ Signed</span>
                                            ) : (
                                                <span className="text-gray-400">Pending</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/admin/contracts/${contract.id}`}>
                                                            View Details
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {contract.status === 'draft' && (
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/admin/contracts/${contract.id}/edit`}>
                                                                Edit
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )}
                                                    {contract.signed_pdf_url && (
                                                        <DropdownMenuItem asChild>
                                                            <a href={contract.signed_pdf_url} download>
                                                                Download PDF
                                                            </a>
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
