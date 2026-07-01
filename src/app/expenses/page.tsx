"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useCurrency } from '@/hooks/use-currency';
import { AVAILABLE_CURRENCIES } from '@/components/ui/currency-badge';
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
import { Plus, Edit, Trash2, Receipt, Calendar, DollarSign, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChartOfAccountsService, COAAccount, EXPENSE_CATEGORY_COA_MAP } from '@/services/chart-of-accounts-service';

interface Expense {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    approvedBy?: string;
    clientReference?: string;
    employee_id?: string;
    coa_account_code?: string;
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
                const [expensesRes, vehiclesRes, accounts] = await Promise.all([
                    supabase.from('expenses').select('*, vehicle_id, vehicleId').order('created_at', { ascending: false }),
                    supabase.from('vehicles').select('*'),
                    ChartOfAccountsService.getAccounts()
                ]);
                
                setExpenses(expensesRes.data || []);
                setVehicles(vehiclesRes.data || []);
                setCoaAccounts(accounts);
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

        try {
            const formData = new FormData(e.currentTarget);
            const vehicleId = formData.get('vehicle_id') as string;
            const expenseCurrency = formData.get('currency') as string || 'TZS';
            const category = formData.get('category') as string;
            const customCoaCode = formData.get('coa_account_code') as string;
            
            // Get or map COA account code
            const coaAccountCode = customCoaCode || ChartOfAccountsService.mapExpenseToCOA(category);
            
            // Validate
            if (!ChartOfAccountsService.validateAccountCode(coaAccountCode, coaAccounts)) {
                toast({ title: 'Error', description: 'Invalid Chart of Accounts code', variant: 'destructive' });
                return;
            }
            
            const expenseData = {
                description: formData.get('description') as string,
                amount: parseFloat(formData.get('amount') as string),
                category: category,
                date: formData.get('date') as string,
                clientReference: formData.get('clientReference') as string,
                vendor: formData.get('vendor') as string,
                payment_method: formData.get('payment_method') as string,
                currency: expenseCurrency,
                coa_account_code: coaAccountCode,
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
                e.currentTarget.reset();
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
            const category = formData.get('category') as string;
            const customCoaCode = formData.get('coa_account_code') as string;
            
            // Get or map COA account code
            const coaAccountCode = customCoaCode || ChartOfAccountsService.mapExpenseToCOA(category);
            
            // Validate
            if (!ChartOfAccountsService.validateAccountCode(coaAccountCode, coaAccounts)) {
                toast({ title: 'Error', description: 'Invalid Chart of Accounts code', variant: 'destructive' });
                return;
            }
            
            const { data, error } = await supabase
                .from('expenses')
                .update({
                    description: formData.get('description') as string,
                    amount: parseFloat(formData.get('amount') as string),
                    category: category,
                    date: formData.get('date') as string,
                    clientReference: formData.get('clientReference') as string,
                    vendor: formData.get('vendor') as string,
                    payment_method: formData.get('payment_method') as string,
                    currency: formData.get('currency') as string,
                    coa_account_code: coaAccountCode,
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

    const handleStatusChange = async (expenseId: string, newStatus: 'approved' | 'rejected') => {
        try {
            const { error } = await supabase
                .from('expenses')
                .update({ 
                    status: newStatus,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', expenseId);

            if (error) {
                console.error('Error changing expense status:', error);
                toast({ title: 'Error', description: `Failed to ${newStatus} expense`, variant: 'destructive' });
            } else {
                setExpenses(prev => 
                    prev.map(e => e.id === expenseId ? { ...e, status: newStatus } : e)
                );
                toast({ title: 'Success', description: `Expense ${newStatus} successfully` });
            }
        } catch (error) {
            console.error('Error changing expense status:', error);
            toast({ title: 'Error', description: 'Failed to update expense status', variant: 'destructive' });
        }
    };

    const totalExpenses = expenses?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0;
    const pendingExpenses = expenses?.filter(e => e.status === 'pending').length || 0;

    if (!role) return null;

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar role={role} />
            <main className="flex-1 md:ml-60 p-4 md:p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-headline tracking-tighter">Expenses Management</h1>
                            <p className="text-muted-foreground">Track and manage company expenses</p>
                        </div>
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus className="size-4" />
                                    Add Expense
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
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
                            <Select name="category" defaultValue="other" required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fuel">Fuel</SelectItem>
                                    <SelectItem value="maintenance">Maintenance</SelectItem>
                                    <SelectItem value="parts">Parts</SelectItem>
                                    <SelectItem value="insurance">Insurance</SelectItem>
                                    <SelectItem value="salaries">Salaries</SelectItem>
                                    <SelectItem value="utilities">Utilities</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="coa_account_code">Chart of Accounts (Optional)</Label>
                            <Select name="coa_account_code" defaultValue="">
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
                            <Label htmlFor="vendor">Vendor (Optional)</Label>
                            <Input id="vendor" name="vendor" placeholder="Vendor name" />
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
                        <Label htmlFor="date">Date</Label>
                        <Input id="date" name="date" type="date" required />
                    </div>
                    <Button type="submit" className="w-full">Add Expense</Button>
                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                                <DollarSign className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{format(totalExpenses)}</div>
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
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                                <Calendar className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {format(expenses?.filter(e => new Date(e.date).getMonth() === new Date().getMonth()).reduce((sum, e) => sum + e.amount, 0) || 0)}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Expenses Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Expenses</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Emp ID</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Vehicle</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>COA</TableHead>
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
                                            <TableCell>{expense.clientReference || '-'}</TableCell>
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
                                                    {expense.coa_account_code || EXPENSE_CATEGORY_COA_MAP[expense.category] || 'Unmapped'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {new Intl.NumberFormat('en-US', {
                                                    style: 'currency',
                                                    currency: expense.currency || 'TZS',
                                                    maximumFractionDigits: 2,
                                                    minimumFractionDigits: 2
                                                }).format(expense.amount)}
                                            </TableCell>
                                            <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={cn(
                                                        expense.status === 'approved' && 'bg-green-500',
                                                        expense.status === 'rejected' && 'bg-red-500',
                                                        expense.status === 'pending' && 'bg-yellow-500'
                                                    )}
                                                >
                                                    {expense.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setEditingExpense(expense)}
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
                                                                        defaultValue={editingExpense?.clientReference}
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
                                                                        <Select name="category" defaultValue={editingExpense?.category} required>
                                                                            <SelectTrigger>
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="fuel">Fuel</SelectItem>
                                                                                <SelectItem value="maintenance">Maintenance</SelectItem>
                                                                                <SelectItem value="parts">Parts</SelectItem>
                                                                                <SelectItem value="insurance">Insurance</SelectItem>
                                                                                <SelectItem value="salaries">Salaries</SelectItem>
                                                                                <SelectItem value="utilities">Utilities</SelectItem>
                                                                                <SelectItem value="other">Other</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div>
                                                                        <Label htmlFor="edit-vendor">Vendor (Optional)</Label>
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
                                                    {(['CEO', 'ADMIN', 'ACCOUNTANT', 'HR'].includes(role || '')) && expense.status === 'pending' && (
                                                        <>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleStatusChange(expense.id, 'approved')}
                                                                className="text-green-600 hover:text-green-700"
                                                            >
                                                                Approve
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleStatusChange(expense.id, 'rejected')}
                                                                className="text-red-600 hover:text-red-700"
                                                            >
                                                                Reject
                                                            </Button>
                                                        </>
                                                    )}
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




