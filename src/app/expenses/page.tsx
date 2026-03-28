"use client";

import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useCurrency } from '@/hooks/use-currency';
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
import { Plus, Edit, Trash2, Receipt, Calendar, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Expense {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    approvedBy?: string;
}

export default function ExpensesPage() {
    const { role } = useRole();
    const { format, currency } = useCurrency();
    const { user } = useSupabase();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadExpenses = async () => {
            if (!user) return;
            
            try {
                setLoading(true);
                // Load real data from Supabase
                const { data: expensesData } = await supabase
                    .from('expenses')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                setExpenses(expensesData || []);
            } catch (error) {
                console.error('Error loading expenses data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadExpenses();
    }, [user]);

    const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        try {
            const formData = new FormData(e.currentTarget);
            const expenseData = {
                description: formData.get('description') as string,
                amount: parseFloat(formData.get('amount') as string),
                category: formData.get('category') as string,
                date: formData.get('date') as string,
                driver_id: user.id,
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
            } else {
                console.log('Expense added successfully:', data);
                // Refresh expenses list
                const { data: updatedExpenses } = await supabase
                    .from('expenses')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                setExpenses(updatedExpenses || []);
                setIsAddDialogOpen(false);
                e.currentTarget.reset();
            }
        } catch (error) {
            console.error('Error adding expense:', error);
        }
    };

    const handleUpdateExpense = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingExpense) return;
        
        try {
            const formData = new FormData(e.currentTarget);
            const { data, error } = await supabase
                .from('expenses')
                .update({
                    description: formData.get('description') as string,
                    amount: parseFloat(formData.get('amount') as string),
                    category: formData.get('category') as string,
                    date: formData.get('date') as string,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', editingExpense.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating expense:', error);
            } else {
                setExpenses(prev => prev.map(e => e.id === editingExpense.id ? data : e));
                setEditingExpense(null);
            }
        } catch (error) {
            console.error('Error updating expense:', error);
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
            } else {
                setExpenses(prev => 
                    prev.map(e => e.id === expenseId ? { ...e, status: newStatus } : e)
                );
            }
        } catch (error) {
            console.error('Error changing expense status:', error);
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
                                        <Textarea id="description" name="description" required />
                                    </div>
                                    <div>
                                        <Label htmlFor="amount">Amount ({currency})</Label>
                                        <Input id="amount" name="amount" type="number" step="0.01" required />
                                    </div>
                                    <div>
                                        <Label htmlFor="category">Category</Label>
                                        <Select name="category" required>
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
                                        <TableHead>Category</TableHead>
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
                                                <Badge variant="outline" className="capitalize">
                                                    {expense.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{format(expense.amount)}</TableCell>
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
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label htmlFor="edit-amount">Amount ({currency})</Label>
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
                                                    {role === 'CEO' && expense.status === 'pending' && (
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
