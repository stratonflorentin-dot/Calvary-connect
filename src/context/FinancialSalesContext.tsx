"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface CalvaryExpense {
  id: string;
  amount: number;
  expense_date: string;
  category?: string;
  vehicle_id?: string;
  is_cross_border?: boolean;
  description?: string;
  vendor?: string;
  status?: string;
}

interface CalvaryRevenue {
  id: string;
  amount: number;
  revenue_date: string;
  description?: string;
  client?: string;
  sales_rep_id?: string;
  is_cross_border?: boolean;
  cargo_type?: string;
}

interface Invoice {
  id: string;
  amount: number;
  customer_name: string;
  due_date: string;
  status: string;
  sales_rep_id?: string;
  commission_amount?: number;
  commission_paid?: boolean;
}

interface TaxRecord {
  id: string;
  amount: number;
  due_date: string;
  tax_name: string;
  status: string;
  type: string;
}

interface SalesRep {
  id: string;
  name: string;
  commission_rate: number;
}

interface FinancialSalesContextProps {
  expenses: CalvaryExpense[];
  revenue: CalvaryRevenue[];
  invoices: Invoice[];
  taxes: TaxRecord[];
  vehicles: any[];
  trips: any[];
  salesReps: SalesRep[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const FinancialSalesContext = createContext<FinancialSalesContextProps | undefined>(undefined);

export const useFinancialSales = () => {
  const ctx = useContext(FinancialSalesContext);
  if (!ctx) throw new Error('FinancialSalesContext must be used within FinancialSalesProvider');
  return ctx;
};

export const FinancialSalesProvider = ({ children }: { children: ReactNode }) => {
  const [expenses, setExpenses] = useState<CalvaryExpense[]>([]);
  const [revenue, setRevenue] = useState<CalvaryRevenue[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [taxes, setTaxes] = useState<TaxRecord[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: expensesData }, { data: tripsData }, { data: invoicesData }, { data: taxesData }, { data: vehiclesData }, { data: repsData }] = await Promise.all([
        supabase.from('expenses').select('*'),
        supabase.from('trips').select('*'),
        supabase.from('invoices').select('*'),
        supabase.from('taxes').select('*'),
        supabase.from('vehicles').select('id, plate_number, make, model').eq('status', 'active'),
        supabase.from('user_profiles').select('id, name, commission_rate').eq('role', 'sales_rep'),
      ]);

      // Transform trips into revenue‑like objects (same logic as previous component)
      const processedRevenue: CalvaryRevenue[] = (tripsData || []).map((trip: any) => ({
        id: trip.id,
        amount: Number(trip.revenue) || Number(trip.price) || 0,
        revenue_date: trip.created_at,
        description: `${trip.origin} → ${trip.destination}`,
        client: trip.client || 'Direct Client',
        sales_rep_id: trip.sales_rep_id,
        is_cross_border: trip.is_cross_border || false,
        cargo_type: trip.cargo_type || 'GENERAL',
      })).filter((r: CalvaryRevenue) => r.amount > 0);

      setExpenses(expensesData || []);
      setRevenue(processedRevenue);
      setInvoices(invoicesData || []);
      setTaxes(taxesData || []);
      setVehicles(vehiclesData || []);
      setTrips(tripsData || []);
      setSalesReps(repsData || []);
    } catch (e) {
      console.error('Error loading financial/sales data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refresh = async () => {
    await loadData();
  };

  return (
    <FinancialSalesContext.Provider value={{ expenses, revenue, invoices, taxes, vehicles, trips, salesReps, loading, refresh }}>
      {children}
    </FinancialSalesContext.Provider>
  );
};
