import { supabase } from '@/lib/supabase';

export interface COAAccount {
  id: string;
  code: string;
  name: string;
  category: 'ASSETS' | 'LIABILITIES' | 'EQUITY' | 'REVENUE' | 'COST_OF_SALES' | 'OPERATING_EXPENSES' | 'OTHER_EXPENSES';
  sub_category: string;
  type: 'debit' | 'credit';
  parent_code?: string;
  current_balance: number;
  is_active: boolean;
  description?: string;
  currency: 'TZS' | 'USD';
}

// Pre-configured account mappings
export const EXPENSE_CATEGORY_COA_MAP: Record<string, string> = {
  'fuel': '5101',
  'maintenance': '5104',
  'parts': '5105',
  'insurance': '5110',
  'salaries': '5102',
  'utilities': '6102',
  'other': '6501'
};

export const REVENUE_CATEGORY_COA_MAP: Record<string, string> = {
  'local_transport': '4101',
  'cross_border': '4102',
  'container': '4103',
  'warehousing': '4106',
  'other': '4204'
};

export class ChartOfAccountsService {
  // Get all active accounts
  static async getAccounts(): Promise<COAAccount[]> {
    const { data } = await supabase.from('accounts').select('*').eq('is_active', true).order('code');
    return data || [];
  }

  // Get account by code
  static async getAccountByCode(code: string): Promise<COAAccount | null> {
    const { data } = await supabase.from('accounts').select('*').eq('code', code).single();
    return data;
  }

  // Map expense category to COA account
  static mapExpenseToCOA(expenseCategory: string): string {
    return EXPENSE_CATEGORY_COA_MAP[expenseCategory] || EXPENSE_CATEGORY_COA_MAP['other'];
  }

  // Map revenue category to COA account
  static mapRevenueToCOA(revenueCategory: string): string {
    return REVENUE_CATEGORY_COA_MAP[revenueCategory] || REVENUE_CATEGORY_COA_MAP['other'];
  }

  // Validate that account code is valid
  static validateAccountCode(code: string, accounts: COAAccount[]): boolean {
    return accounts.some(a => a.code === code && a.is_active);
  }

  // Validate that category maps to a valid account
  static validateExpenseCategory(category: string, accounts: COAAccount[]): boolean {
    const coaCode = this.mapExpenseToCOA(category);
    return this.validateAccountCode(coaCode, accounts);
  }

  // Get account for an expense
  static async getAccountForExpense(expenseCategory: string): Promise<COAAccount | null> {
    const code = this.mapExpenseToCOA(expenseCategory);
    return await this.getAccountByCode(code);
  }

  // Generate reconciliation report
  static async generateReconciliationReport(
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalExpenses: number;
    totalInvoices: number;
    mappedExpenses: number;
    mappedInvoices: number;
    unmappedItems: any[];
    accountsSummary: any[];
  }> {
    const [
      { data: accounts },
      { data: expenses },
      { data: invoices }
    ] = await Promise.all([
      supabase.from('accounts').select('*'),
      startDate && endDate
        ? supabase.from('expenses').select('*').gte('date', startDate).lte('date', endDate)
        : supabase.from('expenses').select('*'),
      startDate && endDate
        ? supabase.from('invoices').select('*').gte('issue_date', startDate).lte('issue_date', endDate)
        : supabase.from('invoices').select('*')
    ]);

    const accountMap = new Map<string, any>();
    (accounts || []).forEach(acc => {
      accountMap.set(acc.code, acc);
    });

    const unmappedItems: any[] = [];
    const accountsSummary = (accounts || []).map(acc => ({
      ...acc,
      transactionCount: 0,
      totalAmount: 0
    }));

    // Check expenses
    (expenses || []).forEach(exp => {
      let coaCode = null;
      if (exp.coa_account_code) {
        coaCode = exp.coa_account_code;
      } else if (exp.category) {
        coaCode = this.mapExpenseToCOA(exp.category);
      }

      if (coaCode && accountMap.has(coaCode)) {
        const summaryIndex = accountsSummary.findIndex(a => a.code === coaCode);
        if (summaryIndex !== -1) {
          accountsSummary[summaryIndex].transactionCount++;
          accountsSummary[summaryIndex].totalAmount += (parseFloat(exp.amount) || 0);
        }
      } else {
        unmappedItems.push({ type: 'expense', id: exp.id, category: exp.category, amount: exp.amount, date: exp.date });
      }
    });

    // Check invoices
    (invoices || []).forEach(inv => {
      let coaCode = null;
      if (inv.coa_account_code) {
        coaCode = inv.coa_account_code;
      } else if (inv.type === 'receivable') {
        coaCode = '4101'; // Default to local transport revenue
      }

      if (coaCode && accountMap.has(coaCode)) {
        const summaryIndex = accountsSummary.findIndex(a => a.code === coaCode);
        if (summaryIndex !== -1) {
          accountsSummary[summaryIndex].transactionCount++;
          accountsSummary[summaryIndex].totalAmount += (parseFloat(inv.amount) || 0);
        }
      } else {
        unmappedItems.push({ type: 'invoice', id: inv.id, type: inv.type, amount: inv.amount, date: inv.issue_date });
      }
    });

    return {
      totalExpenses: expenses?.length || 0,
      totalInvoices: invoices?.length || 0,
      mappedExpenses: (expenses?.length || 0) - unmappedItems.filter(i => i.type === 'expense').length,
      mappedInvoices: (invoices?.length || 0) - unmappedItems.filter(i => i.type === 'invoice').length,
      unmappedItems,
      accountsSummary: accountsSummary.filter(a => a.transactionCount > 0)
    };
  }

  // Fix misclassified entries
  static async fixMisclassifiedEntries(): Promise<{ fixed: number, errors: string[] }> {
    const errors: string[] = [];
    let fixedCount = 0;
    const accounts = await this.getAccounts();

    // Fix expenses
    const { data: expenses } = await supabase.from('expenses').select('*');
    for (const exp of expenses || []) {
      const correctCode = this.mapExpenseToCOA(exp.category || 'other');
      if (exp.coa_account_code !== correctCode) {
        try {
          await supabase.from('expenses')
            .update({ coa_account_code: correctCode })
            .eq('id', exp.id);
          fixedCount++;
        } catch (e) {
          errors.push(`Failed to update expense ${exp.id}: ${e}`);
        }
      }
    }

    // Fix invoices
    const { data: invoices } = await supabase.from('invoices').select('*');
    for (const inv of invoices || []) {
      const correctCode = inv.type === 'receivable' ? '4101' : '2101';
      if (inv.coa_account_code !== correctCode) {
        try {
          await supabase.from('invoices')
            .update({ coa_account_code: correctCode })
            .eq('id', inv.id);
          fixedCount++;
        } catch (e) {
          errors.push(`Failed to update invoice ${inv.id}: ${e}`);
        }
      }
    }

    return { fixed: fixedCount, errors };
  }
}
