"use client";

import Link from 'next/link';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useCurrency } from '@/hooks/use-currency';
import { AVAILABLE_CURRENCIES, formatCurrency } from '@/components/ui/currency-badge';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Receipt, DollarSign, BookOpen, Flame, AlertTriangle, Upload, Tags, Wallet, HandCoins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChartOfAccountsService, COAAccount, EXPENSE_CATEGORY_COA_MAP } from '@/services/chart-of-accounts-service';
import { TransitionButtons } from '@/components/workflow/transition-buttons';
import { hoursSince, isOverdue, resolveApprovalLevel, slaHours } from '@/lib/workflow/approvals';

interface Expense {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
    status: 'pending' | 'approved' | 'rejected' | 'paid';
    createdAt: string;
    approvedBy?: string;
    client_reference?: string;
    employee_id?: string;
    account_code?: string;
    currency?: string;
    vendor?: string;
    vehicle_id?: string | null;
    payment_method?: string;
    bank_account_id?: string | null;
    category_id?: string | null;
    supplier_id?: string | null;
    vat_amount?: number | null;
    is_zero_rated?: boolean;
    petty_cash_transaction_id?: string | null;
    cash_request_id?: string | null;
}

interface BankAccountOption {
    id: string;
    account_name: string;
    bank_name: string;
    currency: string;
}

interface ExpenseCategoryOption {
    id: string;
    name: string;
    default_account_code: string | null;
}

interface SupplierOption {
    id: string;
    company_name: string;
}

export default function ExpensesPage() {
    const { role, isAdmin } = useRole();
    const { format, currency } = useCurrency();
    const { user } = useSupabase();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [coaAccounts, setCoaAccounts] = useState<COAAccount[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
    const [categories, setCategories] = useState<ExpenseCategoryOption[]>([]);
    const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
    const [addZeroRated, setAddZeroRated] = useState(false);
    const [addCategoryId, setAddCategoryId] = useState('');
    const [addAccountCode, setAddAccountCode] = useState('');
    const [editZeroRated, setEditZeroRated] = useState(false);
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
                // Load expenses, vehicles, and COA in parallel
                const [expensesRes, vehiclesRes, accounts, bankAccountsRes, categoriesRes, suppliersRes] = await Promise.all([
                    supabase.from('expenses').select('*, vehicle_id').order('created_at', { ascending: false }),
                    supabase.from('vehicles').select('*'),
                    ChartOfAccountsService.getAccounts(),
                    supabase.from('bank_accounts').select('id, account_name, bank_name, currency').eq('is_active', true).order('account_name'),
                    supabase.from('expense_categories').select('id, name, default_account_code').eq('status', 'active').order('name'),
                    supabase.from('suppliers').select('id, company_name').eq('status', 'active').order('company_name'),
                ]);

                setExpenses(expensesRes.data || []);
                setVehicles(vehiclesRes.data || []);
                setCoaAccounts(accounts);
                setBankAccounts(bankAccountsRes.data || []);
                setCategories(categoriesRes.data || []);
                setSuppliers(suppliersRes.data || []);
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user, role]);

    const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!user) return;

        // Captured synchronously, before any `await` below — React nulls out
        // pooled SyntheticEvent fields (including currentTarget) once the
        // handler's synchronous portion returns, so reading e.currentTarget
        // after an await throws "Cannot read properties of null".
        const form = e.currentTarget;

        try {
            const formData = new FormData(form);
            const vehicleId = formData.get('vehicle_id') as string;
            const expenseCurrency = formData.get('currency') as string || 'TZS';
            const selectedCategory = categories.find((c) => c.id === addCategoryId);
            const category = selectedCategory?.name || (formData.get('category') as string) || 'other';
            const customCoaCode = addAccountCode || (formData.get('coa_account_code') as string);

            // Get or map COA account code
            const coaAccountCode = customCoaCode || ChartOfAccountsService.mapExpenseToCOA(category);

            // Validate
            if (!ChartOfAccountsService.validateAccountCode(coaAccountCode, coaAccounts)) {
                toast({ title: 'Error', description: 'Invalid Chart of Accounts code', variant: 'destructive' });
                return;
            }

            const supplierId = formData.get('supplier_id') as string;
            const vatAmount = addZeroRated ? 0 : parseFloat(formData.get('vat_amount') as string) || 0;

            const expenseData = {
                description: formData.get('description') as string,
                amount: parseFloat(formData.get('amount') as string),
                category: category,
                category_id: addCategoryId || null,
                supplier_id: supplierId && supplierId !== 'none' ? supplierId : null,
                is_zero_rated: addZeroRated,
                vat_amount: vatAmount,
                date: formData.get('date') as string,
                client_reference: formData.get('clientReference') as string,
                vendor: formData.get('vendor') as string,
                payment_method: formData.get('payment_method') as string,
                currency: expenseCurrency,
                account_code: coaAccountCode,
                bank_account_id: (formData.get('bank_account_id') as string) || null,
                driver_id: user.id,
                vehicle_id: vehicleId === 'none' ? null : vehicleId,
                status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            const { data, error } = await supabase
                .from('expenses')
                .insert([expenseData])
                .select()
                .single();

            if (error) {
                console.error('Error adding expense:', error);
                toast({ title: 'Error', description: `Failed to add expense: ${error.message}`, variant: 'destructive' });
            } else {
                console.log('Expense added successfully:', data);
                toast({ title: 'Success', description: 'Expense added successfully with COA mapping' });
                // Refresh expenses list
                const { data: updatedExpenses } = await supabase
                    .from('expenses')
                    .select('*, vehicle_id')
                    .order('created_at', { ascending: false });

                setExpenses(updatedExpenses || []);
                setIsAddDialogOpen(false);
                setAddCategoryId('');
                setAddAccountCode('');
                setAddZeroRated(false);
                form.reset();
            }
        } catch (error) {
            console.error('Error adding expense:', error);
            toast({ title: 'Error', description: 'Failed to add expense', variant: 'destructive' });
        }
    };

    const handleUpdateExpense = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingExpense) return;

        try {
            const formData = new FormData(e.currentTarget);
            const vehicleId = formData.get('vehicle_id') as string;
            const categoryIdField = formData.get('category_id') as string;
            const selectedCategory = categories.find((c) => c.id === categoryIdField);
            const category = selectedCategory?.name || (formData.get('category') as string) || 'other';
            const customCoaCode = formData.get('coa_account_code') as string;

            // Get or map COA account code
            const coaAccountCode = customCoaCode || ChartOfAccountsService.mapExpenseToCOA(category);

            // Validate
            if (!ChartOfAccountsService.validateAccountCode(coaAccountCode, coaAccounts)) {
                toast({ title: 'Error', description: 'Invalid Chart of Accounts code', variant: 'destructive' });
                return;
            }

            const supplierId = formData.get('supplier_id') as string;
            const vatAmount = editZeroRated ? 0 : parseFloat(formData.get('vat_amount') as string) || 0;

            const { data, error } = await supabase
                .from('expenses')
                .update({
                    description: formData.get('description') as string,
                    amount: parseFloat(formData.get('amount') as string),
                    category: category,
                    category_id: categoryIdField || null,
                    supplier_id: supplierId && supplierId !== 'none' ? supplierId : null,
                    is_zero_rated: editZeroRated,
                    vat_amount: vatAmount,
                    date: formData.get('date') as string,
                    client_reference: formData.get('clientReference') as string,
                    vendor: formData.get('vendor') as string,
                    payment_method: formData.get('payment_method') as string,
                    currency: formData.get('currency') as string,
                    account_code: coaAccountCode,
                    bank_account_id: (formData.get('bank_account_id') as string) || null,
                    vehicle_id: vehicleId === 'none' ? null : vehicleId,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', editingExpense.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating expense:', error);
                toast({ title: 'Error', description: 'Failed to update expense', variant: 'destructive' });
            } else {
                setExpenses(prev => prev.map(e => e.id === editingExpense.id ? data : e));
                setEditingExpense(null);
                toast({ title: 'Success', description: 'Expense updated successfully with COA mapping' });
            }
        } catch (error) {
            console.error('Error updating expense:', error);
            toast({ title: 'Error', description: 'Failed to update expense', variant: 'destructive' });
        }
    };

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
                            <h1 className="text-2xl md:text-3xl font-headline tracking-tighter">Expenses Management</h1>
                            <p className="text-muted-foreground">Track and manage company expenses</p>
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
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus className="size-4" />
                                    Add Expense
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Add New Expense</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleAddExpense} className="space-y-4">
                                    <div>
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea id="description" name="description" required placeholder="Describe the expense" />
                                    </div>
                                    <div>
                                        <Label htmlFor="clientReference">Client / Trip Reference (Optional)</Label>
                                        <Input id="clientReference" name="clientReference" placeholder="e.g. TRP-123 or ABC Corp" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="amount">Amount</Label>
                                            <Input id="amount" name="amount" type="number" step="0.01" required />
                                        </div>
                                        <div>
                                            <Label htmlFor="currency">Currency</Label>
                                            <Select name="currency" defaultValue={currency}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select currency" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {AVAILABLE_CURRENCIES.map((cur) => (
                                                        <SelectItem key={cur.code} value={cur.code}>
                                                            {cur.code} - {cur.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="category">Category</Label>
                                            <Select
                                                value={addCategoryId}
                                                onValueChange={(v) => {
                                                    setAddCategoryId(v);
                                                    const def = categories.find((c) => c.id === v)?.default_account_code;
                                                    if (def) setAddAccountCode(def);
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.map((c) => (
                                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                    ))}
                                                    {categories.length === 0 && (
                                                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                                            No categories yet — <Link href="/expenses/categories" className="text-primary hover:underline">create one</Link>
                                                        </div>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="coa_account_code">Chart of Accounts (Optional)</Label>
                                            <Select name="coa_account_code" value={addAccountCode} onValueChange={setAddAccountCode}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Auto-mapped" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {coaAccounts.map((account) => (
                                                        <SelectItem key={account.code} value={account.code}>
                                                            {account.code} - {account.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="vendor">Vendor (free text, optional)</Label>
                                            <Input id="vendor" name="vendor" placeholder="Vendor name" />
                                        </div>
                                        <div>
                                            <Label htmlFor="supplier_id">Registered Supplier (Optional)</Label>
                                            <Select name="supplier_id" defaultValue="none">
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select supplier" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">No supplier</SelectItem>
                                                    {suppliers.map((s) => (
                                                        <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                        <div className="flex items-center gap-2 pb-2">
                                            <input
                                                type="checkbox"
                                                id="add-zero-rated"
                                                checked={addZeroRated}
                                                onChange={(e) => setAddZeroRated(e.target.checked)}
                                                className="size-4"
                                            />
                                            <Label htmlFor="add-zero-rated" className="cursor-pointer">Zero-rated (no VAT)</Label>
                                        </div>
                                        <div>
                                            <Label htmlFor="vat_amount">VAT Amount</Label>
                                            <Input id="vat_amount" name="vat_amount" type="number" step="0.01" defaultValue="0" disabled={addZeroRated} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="vehicle_id">Vehicle (Optional)</Label>
                                            <Select name="vehicle_id" defaultValue="none">
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select vehicle" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">No vehicle</SelectItem>
                                                    {vehicles.map((v) => (
                                                        <SelectItem key={v.id} value={v.id}>
                                                            {v.plate_number || v.plateNumber}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="payment_method">Payment Method (Optional)</Label>
                                            <Select name="payment_method" defaultValue="cash">
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select payment method" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="cash">Cash</SelectItem>
                                                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                                                    <SelectItem value="credit_card">Credit Card</SelectItem>
                                                    <SelectItem value="cheque">Cheque</SelectItem>
                                                    <SelectItem value="other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div>
                                        <Label htmlFor="bank_account_id">Paid From Account (Optional)</Label>
                                        <Select name="bank_account_id">
                                            <SelectTrigger>
                                                <SelectValue placeholder="Which account paid this?" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {bankAccounts.map((b) => (
                                                    <SelectItem key={b.id} value={b.id}>
                                                        {b.bank_name} · {b.account_name} ({b.currency})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground mt-1">Match this to the expense's currency above — the account you pick here is what actually gets debited once this is marked paid.</p>
                                    </div>
                                    <div>
                                        <Label htmlFor="date">Date</Label>
                                        <Input id="date" name="date" type="date" required />
                                    </div>
                                    <Button type="submit" className="w-full">Add Expense</Button>
                                </form>
                            </DialogContent>
                        </Dialog>
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
                                                    />
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => { setEditingExpense(expense); setEditZeroRated(!!expense.is_zero_rated); }}
                                                            >
                                                                <Edit className="size-4" />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Edit Expense</DialogTitle>
                                                            </DialogHeader>
                                                            <form onSubmit={handleUpdateExpense} className="space-y-4">
                                                                <div>
                                                                    <Label htmlFor="edit-description">Description</Label>
                                                                    <Textarea
                                                                        id="edit-description"
                                                                        name="description"
                                                                        defaultValue={editingExpense?.description}
                                                                        required
                                                                        placeholder="Describe the expense"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label htmlFor="edit-clientReference">Client / Trip Reference (Optional)</Label>
                                                                    <Input
                                                                        id="edit-clientReference"
                                                                        name="clientReference"
                                                                        defaultValue={editingExpense?.client_reference}
                                                                        placeholder="e.g. TRP-123 or ABC Corp"
                                                                    />
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div>
                                                                        <Label htmlFor="edit-amount">Amount</Label>
                                                                        <Input
                                                                            id="edit-amount"
                                                                            name="amount"
                                                                            type="number"
                                                                            step="0.01"
                                                                            defaultValue={editingExpense?.amount}
                                                                            required
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <Label htmlFor="edit-currency">Currency</Label>
                                                                        <Select name="currency" defaultValue={editingExpense?.currency || currency}>
                                                                            <SelectTrigger>
                                                                                <SelectValue placeholder="Select currency" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {AVAILABLE_CURRENCIES.map((cur) => (
                                                                                    <SelectItem key={cur.code} value={cur.code}>
                                                                                        {cur.code} - {cur.name}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div>
                                                                        <Label htmlFor="edit-category">Category</Label>
                                                                        <Select name="category_id" defaultValue={editingExpense?.category_id ?? ''}>
                                                                            <SelectTrigger>
                                                                                <SelectValue placeholder="Select category" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {categories.map((c) => (
                                                                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div>
                                                                        <Label htmlFor="edit-vendor">Vendor (free text, optional)</Label>
                                                                        <Input
                                                                            id="edit-vendor"
                                                                            name="vendor"
                                                                            defaultValue={editingExpense?.vendor}
                                                                            placeholder="Vendor name"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div>
                                                                        <Label htmlFor="edit-supplier_id">Registered Supplier (Optional)</Label>
                                                                        <Select name="supplier_id" defaultValue={editingExpense?.supplier_id ?? 'none'}>
                                                                            <SelectTrigger>
                                                                                <SelectValue placeholder="Select supplier" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="none">No supplier</SelectItem>
                                                                                {suppliers.map((s) => (
                                                                                    <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2 items-end">
                                                                        <div className="flex items-center gap-2 pb-2">
                                                                            <input
                                                                                type="checkbox"
                                                                                id="edit-zero-rated"
                                                                                checked={editZeroRated}
                                                                                onChange={(e) => setEditZeroRated(e.target.checked)}
                                                                                className="size-4"
                                                                            />
                                                                            <Label htmlFor="edit-zero-rated" className="cursor-pointer text-xs">Zero-rated</Label>
                                                                        </div>
                                                                        <div>
                                                                            <Label htmlFor="edit-vat_amount" className="text-xs">VAT Amount</Label>
                                                                            <Input id="edit-vat_amount" name="vat_amount" type="number" step="0.01" defaultValue={editingExpense?.vat_amount ?? 0} disabled={editZeroRated} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div>
                                                                        <Label htmlFor="edit-vehicle_id">Vehicle (Optional)</Label>
                                                                        <Select name="vehicle_id" defaultValue={editingExpense?.vehicle_id || 'none'}>
                                                                            <SelectTrigger>
                                                                                <SelectValue placeholder="Select vehicle" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="none">No vehicle</SelectItem>
                                                                                {vehicles.map((v) => (
                                                                                    <SelectItem key={v.id} value={v.id}>
                                                                                        {v.plate_number || v.plateNumber}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div>
                                                                        <Label htmlFor="edit-payment_method">Payment Method (Optional)</Label>
                                                                        <Select name="payment_method" defaultValue={editingExpense?.payment_method || 'cash'}>
                                                                            <SelectTrigger>
                                                                                <SelectValue placeholder="Select payment method" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="cash">Cash</SelectItem>
                                                                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                                                                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                                                                                <SelectItem value="credit_card">Credit Card</SelectItem>
                                                                                <SelectItem value="cheque">Cheque</SelectItem>
                                                                                <SelectItem value="other">Other</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <Label htmlFor="edit-bank_account_id">Paid From Account (Optional)</Label>
                                                                    <Select name="bank_account_id" defaultValue={editingExpense?.bank_account_id ?? undefined}>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Which account paid this?" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {bankAccounts.map((b) => (
                                                                                <SelectItem key={b.id} value={b.id}>
                                                                                    {b.bank_name} · {b.account_name} ({b.currency})
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div>
                                                                    <Label htmlFor="edit-date">Date</Label>
                                                                    <Input
                                                                        id="edit-date"
                                                                        name="date"
                                                                        type="date"
                                                                        defaultValue={editingExpense?.date}
                                                                        required
                                                                    />
                                                                </div>
                                                                <Button type="submit" className="w-full">Update Expense</Button>
                                                            </form>
                                                        </DialogContent>
                                                    </Dialog>
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




