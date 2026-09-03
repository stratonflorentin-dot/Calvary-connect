"use client";

import Link from 'next/link';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useCurrency } from '@/hooks/use-currency';
import { formatCurrency } from '@/components/ui/currency-badge';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Plus, Edit, Receipt, DollarSign, Flame, AlertTriangle, Upload, Tags, Wallet, HandCoins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EXPENSE_CATEGORY_COA_MAP } from '@/services/chart-of-accounts-service';
import { TransitionButtons } from '@/components/workflow/transition-buttons';
import { hoursSince, isOverdue, resolveApprovalLevel, slaHours } from '@/lib/workflow/approvals';

interface BankAccountOption {
    id: string;
    account_name: string;
    bank_name: string;
    currency: string;
}


export default function ExpensesPage() {
    const { role } = useRole();
    const { format } = useCurrency();
    const { user } = useSupabase();
    const [expenses, setExpenses] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (role === 'DRIVER') {
            window.location.replace('/driver/expenses');
        }
        if (role === 'ACCOUNTANT' || role === 'HR') {
            window.location.replace('/accountant/expenses');
        }
    }, [role]);

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            if (role === 'DRIVER') return;

            try {
                setLoading(true);
                const [expensesRes, vehiclesRes, bankAccountsRes] = await Promise.all([
                    supabase.from('expenses').select('*, vehicle_id').order('created_at', { ascending: false }),
                    supabase.from('vehicles').select('*'),
                    supabase.from('bank_accounts').select('id, account_name, bank_name, currency').eq('is_active', true).order('account_name'),
                ]);

                setExpenses(expensesRes.data || []);
                setVehicles(vehiclesRes.data || []);
                setBankAccounts(bankAccountsRes.data || []);
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user, role]);


    // Never summed across currencies — a $20 expense and a TSh 2,000,000
    // expense added together is a meaningless number. Grouped per currency,
    // same "Mixed currencies" convention used elsewhere in Finance.
    const totalsByCurrency = (expenses ?? []).reduce<Record<string, number>>((acc, expense) => {
        const cur = (expense.currency || 'TZS').toUpperCase();
        acc[cur] = (acc[cur] || 0) + (Number(expense.amount) || 0);
        return acc;
    }, {});
    const expenseCurrencies = Object.keys(totalsByCurrency).sort();
    const pendingExpenses = expenses?.filter(e => e.status === 'pending').length || 0;
    const overdueExpenses = expenses?.filter(e => e.status === 'pending' && isOverdue('expense', e.created_at ?? e.createdAt ?? e.date)).length || 0;

    if (!role) return null;

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar role={role} />
            <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-headline tracking-tighter">Expenses Register</h1>
                            <p className="text-muted-foreground">Every logged expense. New and edited expenses are created on the Expense Transactions screen.</p>
                        </div>
                        <div className="flex items-center gap-2">
                        <Button variant="outline" className="gap-2" asChild>
                            <Link href="/expenses/categories">
                                <Tags className="size-4" />
                                Categories
                            </Link>
                        </Button>
                        <Button variant="outline" className="gap-2" asChild>
                            <Link href="/expenses/bulk">
                                <Upload className="size-4" />
                                Bulk Expenses
                            </Link>
                        </Button>
                        <Button className="gap-2" asChild>
                            <Link href="/finance/transactions/expenses">
                                <Plus className="size-4" />
                                New Expense
                            </Link>
                        </Button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                                <DollarSign className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {expenseCurrencies.length === 0 ? (
                                    <div className="text-2xl font-bold">{format(0)}</div>
                                ) : expenseCurrencies.length === 1 ? (
                                    <div className="text-2xl font-bold">{formatCurrency(totalsByCurrency[expenseCurrencies[0]], expenseCurrencies[0])}</div>
                                ) : (
                                    <div className="space-y-0.5">
                                        {expenseCurrencies.map((cur) => (
                                            <div key={cur} className="text-lg font-bold">{formatCurrency(totalsByCurrency[cur], cur)}</div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                                <Receipt className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{pendingExpenses}</div>
                            </CardContent>
                        </Card>
                        <Card className={cn(overdueExpenses > 0 && 'border-destructive/40 bg-destructive/5')}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className={cn("text-sm font-medium", overdueExpenses > 0 && 'text-destructive')}>Overdue SLA</CardTitle>
                                <AlertTriangle className={cn("size-4", overdueExpenses > 0 ? 'text-destructive' : 'text-muted-foreground')} />
                            </CardHeader>
                            <CardContent>
                                <div className={cn("text-2xl font-bold", overdueExpenses > 0 && 'text-destructive')}>{overdueExpenses}</div>
                                <p className="text-xs text-muted-foreground mt-1">{overdueExpenses > 0 ? 'items require attention' : 'all within SLA'}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Expenses Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Expenses</CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Emp ID</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Vehicle</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>COA</TableHead>
                                        <TableHead>Source</TableHead>
                                        <TableHead>Paid From</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {expenses?.map((expense) => (
                                        <TableRow key={expense.id}>
                                            <TableCell className="font-medium">{expense.description}</TableCell>
                                            <TableCell>
                                                {expense.employee_id ? (
                                                    <Badge variant="outline" className="border-primary/30 text-primary font-mono text-[10px]">
                                                        {expense.employee_id}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{expense.client_reference || '-'}</TableCell>
                                            <TableCell>
                                                {(() => {
                                                    const vId = expense.vehicle_id || expense.vehicleId;
                                                    const vehicle = vehicles.find(v => v.id === vId);
                                                    return vehicle ? (
                                                        <Badge variant="secondary" className="font-mono">
                                                            {vehicle.plate_number || vehicle.plateNumber}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">N/A</span>
                                                    );
                                                })()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {expense.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono">
                                                    {expense.account_code || EXPENSE_CATEGORY_COA_MAP[expense.category] || 'Unmapped'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {expense.petty_cash_transaction_id ? (
                                                    <Link href="/finance/petty-cash">
                                                        <Badge variant="outline" className="gap-1 border-primary/30 text-primary hover:bg-primary/10">
                                                            <Wallet className="size-3" /> Petty Cash
                                                        </Badge>
                                                    </Link>
                                                ) : expense.cash_request_id ? (
                                                    <Link href="/finance/cash-requests">
                                                        <Badge variant="outline" className="gap-1 border-info/30 text-info hover:bg-info/10">
                                                            <HandCoins className="size-3" /> Cash Request
                                                        </Badge>
                                                    </Link>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">Manual</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {expense.bank_account_id
                                                    ? bankAccounts.find((b) => b.id === expense.bank_account_id)?.account_name ?? '—'
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                {new Intl.NumberFormat('en-US', {
                                                    style: 'currency',
                                                    currency: expense.currency || 'TZS',
                                                    maximumFractionDigits: 2,
                                                    minimumFractionDigits: 2
                                                }).format(expense.amount)}
                                                {Number(expense.vat_amount) > 0 && (
                                                    <span className="block text-[10px] text-muted-foreground font-normal">
                                                        +VAT {new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(expense.vat_amount))}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <Badge
                                                        className={cn(
                                                            expense.status === 'approved' && 'bg-success',
                                                            expense.status === 'rejected' && 'bg-destructive',
                                                            expense.status === 'paid' && 'bg-info',
                                                            expense.status === 'pending' && 'bg-warning'
                                                        )}
                                                    >
                                                        {expense.status}
                                                    </Badge>
                                                    {expense.status === 'pending' && (() => {
                                                        const tier = resolveApprovalLevel('expense', Number(expense.amount) || 0);
                                                        const overdue = isOverdue('expense', expense.created_at ?? expense.createdAt ?? expense.date);
                                                        const age = hoursSince(expense.created_at ?? expense.createdAt ?? expense.date);
                                                        return (
                                                            <div className="flex flex-wrap gap-1">
                                                                {tier && (
                                                                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                                                                        {tier.label}
                                                                    </Badge>
                                                                )}
                                                                {overdue && (
                                                                    <Badge className="text-[9px] uppercase tracking-wider bg-destructive/10 text-destructive hover:bg-destructive/10 flex items-center gap-1">
                                                                        <Flame className="size-2.5" /> {(age - slaHours.expense).toFixed(0)}h late
                                                                    </Badge>
                                                                )}
                                                                {!overdue && age > slaHours.expense * 0.75 && (
                                                                    <Badge className="text-[9px] uppercase tracking-wider bg-warning/10 text-warning hover:bg-warning/10 flex items-center gap-1">
                                                                        <AlertTriangle className="size-2.5" /> Near SLA
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    {/* TransitionButtons renders whatever the expense workflow
                                                        actually allows for its current status — Approve/Reject
                                                        while pending, and critically "Mark Paid" once approved,
                                                        which the old hardcoded Approve/Reject-only buttons never
                                                        exposed. Without it an approved expense could never reach
                                                        "paid" from this page, so its bank account was never
                                                        debited no matter how "done" it looked. */}
                                                    <TransitionButtons
                                                        kind="expense"
                                                        entity={expense}
                                                        actorId={user?.id ?? 'system'}
                                                        actorRole={(role as any) ?? undefined}
                                                        size="sm"
                                                        onDone={(nextEntity) => setExpenses(prev => prev.map(e => e.id === nextEntity.id ? { ...e, ...nextEntity } : e))}
                                                        onError={(t, message) => {
                                                            // "More than one active TZS bank account exists — edit this
                                                            // expense to choose which one paid it" (lib/workflow/engine.ts)
                                                            // is fixed by editing the expense, which now only happens on
                                                            // /finance/transactions/expenses (this page is a read-only
                                                            // register) — send the user there instead of leaving them to
                                                            // find it themselves.
                                                            if (t.to === 'paid' && /bank account/i.test(message)) {
                                                                window.location.href = '/finance/transactions/expenses';
                                                            }
                                                        }}
                                                    />
                                                    <Button variant="outline" size="sm" asChild>
                                                        <Link href="/finance/transactions/expenses">
                                                            <Edit className="size-4" />
                                                        </Link>
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




