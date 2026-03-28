"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FleetService } from '@/services/fleet-service';
import { Expense, FleetVehicle } from '@/types/roles';
import { 
  DollarSign, Fuel, Wrench, Car, Plus, Clock, CheckCircle, XCircle,
  Receipt, TrendingUp, AlertTriangle
} from 'lucide-react';

export function ExpenseManagement() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [newExpense, setNewExpense] = useState({
    type: 'fuel' as const,
    amount: '',
    description: '',
    vehicleId: '',
    driverId: '',
    tripId: '',
    category: '',
    receiptUrl: ''
  });

  useEffect(() => {
    loadData();
  }, [filter, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [expensesData, vehiclesData] = await Promise.all([
        FleetService.getExpenses(
          statusFilter === 'all' ? undefined : statusFilter,
          filter === 'all' ? undefined : filter
        ),
        FleetService.getVehicles()
      ]);
      setExpenses(expensesData);
      setVehicles(vehiclesData);
    } catch (error) {
      console.error('Error loading expense data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await FleetService.createExpense({
        ...newExpense,
        amount: parseFloat(newExpense.amount),
        status: 'pending'
      });
      setShowAddExpense(false);
      setNewExpense({
        type: 'fuel',
        amount: '',
        description: '',
        vehicleId: '',
        driverId: '',
        tripId: '',
        category: '',
        receiptUrl: ''
      });
      loadData();
    } catch (error) {
      console.error('Error creating expense:', error);
    }
  };

  const approveExpense = async (expenseId: string) => {
    try {
      await FleetService.updateExpense(expenseId, { 
        status: 'approved',
        approvedBy: 'current-user-id' // Replace with actual user ID
      });
      loadData();
    } catch (error) {
      console.error('Error approving expense:', error);
    }
  };

  const rejectExpense = async (expenseId: string) => {
    try {
      await FleetService.updateExpense(expenseId, { 
        status: 'rejected',
        approvedBy: 'current-user-id' // Replace with actual user ID
      });
      loadData();
    } catch (error) {
      console.error('Error rejecting expense:', error);
    }
  };

  const getExpenseIcon = (type: string) => {
    switch (type) {
      case 'fuel': return <Fuel className="size-4" />;
      case 'maintenance': return <Wrench className="size-4" />;
      case 'repair': return <Wrench className="size-4" />;
      case 'insurance': return <Car className="size-4" />;
      case 'registration': return <Receipt className="size-4" />;
      default: return <DollarSign className="size-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="size-4" />;
      case 'approved': return <CheckCircle className="size-4" />;
      case 'rejected': return <XCircle className="size-4" />;
      default: return <Clock className="size-4" />;
    }
  };

  const expenseStats = {
    total: expenses.reduce((sum, exp) => sum + exp.amount, 0),
    pending: expenses.filter(exp => exp.status === 'pending').reduce((sum, exp) => sum + exp.amount, 0),
    approved: expenses.filter(exp => exp.status === 'approved').reduce((sum, exp) => sum + exp.amount, 0),
    fuel: expenses.filter(exp => exp.type === 'fuel').reduce((sum, exp) => sum + exp.amount, 0),
    maintenance: expenses.filter(exp => exp.type === 'maintenance' || exp.type === 'repair').reduce((sum, exp) => sum + exp.amount, 0),
    pendingCount: expenses.filter(exp => exp.status === 'pending').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading expense data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Expense Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold">${expenseStats.total.toFixed(2)}</p>
              </div>
              <DollarSign className="size-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">${expenseStats.pending.toFixed(2)}</p>
              </div>
              <Clock className="size-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fuel Costs</p>
                <p className="text-2xl font-bold text-blue-600">${expenseStats.fuel.toFixed(2)}</p>
              </div>
              <Fuel className="size-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Maintenance</p>
                <p className="text-2xl font-bold text-purple-600">${expenseStats.maintenance.toFixed(2)}</p>
              </div>
              <Wrench className="size-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals Alert */}
      {expenseStats.pendingCount > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">
                  {expenseStats.pendingCount} expense{expenseStats.pendingCount > 1 ? 's' : ''} pending approval
                </p>
                <p className="text-sm text-yellow-600">
                  Total amount: ${expenseStats.pending.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="fuel">Fuel</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="repair">Repair</SelectItem>
              <SelectItem value="insurance">Insurance</SelectItem>
              <SelectItem value="registration">Registration</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitExpense} className="space-y-4">
              <div>
                <Label htmlFor="type">Expense Type</Label>
                <Select value={newExpense.type} onValueChange={(value: any) => setNewExpense({ ...newExpense, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fuel">Fuel</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="registration">Registration</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="vehicleId">Vehicle</Label>
                <Select value={newExpense.vehicleId} onValueChange={(value) => setNewExpense({ ...newExpense, vehicleId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.plateNumber} - {vehicle.make} {vehicle.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  placeholder="Describe the expense..."
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddExpense(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Expense</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Expense List */}
      <div className="space-y-4">
        {expenses.map((expense) => (
          <Card key={expense.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-50 rounded-lg">
                    {getExpenseIcon(expense.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium capitalize">{expense.type}</h4>
                      <Badge className={getStatusColor(expense.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(expense.status)}
                          {expense.status}
                        </span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{expense.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Vehicle: {vehicles.find(v => v.id === expense.vehicleId)?.plateNumber || 'N/A'}</span>
                      <span>Created: {expense.created_at?.toDate?.()?.toLocaleDateString() || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">${expense.amount.toFixed(2)}</p>
                  {expense.status === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={() => approveExpense(expense.id)}>
                        <CheckCircle className="size-3 mr-1" />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => rejectExpense(expense.id)}>
                        <XCircle className="size-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {expenses.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Receipt className="size-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No expenses found</h3>
            <p className="text-muted-foreground mb-4">
              {filter === 'all' && statusFilter === 'all' 
                ? 'No expenses have been recorded yet.' 
                : 'No expenses match the current filters.'
              }
            </p>
            <Button onClick={() => setShowAddExpense(true)}>
              <Plus className="size-4 mr-2" />
              Add First Expense
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
