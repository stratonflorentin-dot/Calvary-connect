import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrency } from '@/hooks/use-currency';
import { useFinancialSales } from '@/context/FinancialSalesContext';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

export const SummaryCards = () => {
  const { expenses, revenue, invoices, salesReps, loading } = useFinancialSales();
  const { format: formatCurrency } = useCurrency();

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const commissionsOwed = salesReps.reduce((sum, rep) => {
    // placeholder, actual owed calculated elsewhere
    return sum;
  }, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-none">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Total Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
            </div>
            <TrendingUp className="h-10 w-10 text-white/30" />
          </div>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white border-none">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Total Expenses</p>
              <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
            </div>
            <TrendingDown className="h-10 w-10 text-white/30" />
          </div>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-none">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Net Profit</p>
              <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-white' : 'text-red-200'}`}>{formatCurrency(netProfit)}</p>
            </div>
            <DollarSign className="h-10 w-10 text-white/30" />
          </div>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-none">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Commissions Owed</p>
              <p className="text-2xl font-bold">{formatCurrency(commissionsOwed)}</p>
            </div>
            <Wallet className="h-10 w-10 text-white/30" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
