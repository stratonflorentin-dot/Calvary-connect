"use client";

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Download, FileText, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  reference?: string;
  debit?: number;
  credit?: number;
  balance?: number;
  matched: boolean;
  accountCode?: string;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
}

export function BankStatementImport() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showReconcileDialog, setShowReconcileDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load bank accounts on mount
  const loadBankAccounts = async () => {
    const { data } = await supabase.from('bank_accounts').select('*').eq('is_active', true);
    setBankAccounts(data || []);
  };

  // Parse CSV file
  const parseCSV = (content: string): ParsedTransaction[] => {
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const transactions: ParsedTransaction[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 3) continue;
      
      const tx: ParsedTransaction = {
        id: `temp-${i}`,
        date: values[0] || '',
        description: values[1] || '',
        reference: values[2] || '',
        debit: parseFloat(values[3]) || undefined,
        credit: parseFloat(values[4]) || undefined,
        balance: parseFloat(values[5]) || undefined,
        matched: false
      };
      
      transactions.push(tx);
    }
    
    return transactions;
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    
    setFile(uploadedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const transactions = parseCSV(content);
      setParsedTransactions(transactions);
      toast({ title: 'File Parsed', description: `${transactions.length} transactions found` });
    };
    reader.readAsText(uploadedFile);
  };

  // Import transactions to database
  const handleImport = async () => {
    if (!selectedAccount || parsedTransactions.length === 0) {
      toast({ title: 'Error', description: 'Please select a bank account and upload a file', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const bankAccount = bankAccounts.find(a => a.id === selectedAccount);
      if (!bankAccount) throw new Error('Bank account not found');

      let currentBalance = 0;

      for (const tx of parsedTransactions) {
        const amount = tx.debit || -(tx.credit || 0);
        currentBalance += amount;

        const { error } = await supabase.from('bank_statements').insert({
          bank_account_id: selectedAccount,
          transaction_date: tx.date,
          description: tx.description,
          reference_number: tx.reference,
          debit_amount: tx.debit || null,
          credit_amount: tx.credit || null,
          balance: tx.balance || currentBalance,
          transaction_type: tx.debit ? 'withdrawal' : 'deposit',
          reconciled: false,
          created_at: new Date().toISOString()
        });

        if (error) throw error;
      }

      // Update bank account balance
      await supabase.from('bank_accounts').update({
        current_balance: currentBalance,
        updated_at: new Date().toISOString()
      }).eq('id', selectedAccount);

      toast({ title: 'Success', description: `${parsedTransactions.length} transactions imported` });
      
      // Reset form
      setFile(null);
      setParsedTransactions([]);
      setShowReconcileDialog(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  // Download template
  const downloadTemplate = () => {
    const template = 'Date,Description,Reference,Debit,Credit,Balance\n' +
                     '2024-01-15,Opening Balance,OPEN,0,0,1000000\n' +
                     '2024-01-16,Client Payment,INV001,0,500000,1500000\n' +
                     '2024-01-17,Fuel Purchase,FUEL001,200000,0,1300000\n' +
                     '2024-01-18,Maintenance,MAINT001,150000,0,1150000\n';
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bank_statement_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Link href="/finance">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Finance
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold">Bank Statement Import</h1>
            <p className="text-muted-foreground">Import and reconcile bank transactions</p>
          </div>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Download Template
          </Button>
        </div>

        {/* Upload Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Import Bank Statement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Select Bank Account</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.bank_name} - {acc.account_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Upload CSV File</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            {parsedTransactions.length > 0 && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">Preview ({parsedTransactions.length} transactions)</h3>
                  <Button onClick={() => setShowReconcileDialog(true)}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Review & Import
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedTransactions.slice(0, 5).map((tx, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{tx.date}</TableCell>
                        <TableCell>{tx.description}</TableCell>
                        <TableCell>{tx.reference}</TableCell>
                        <TableCell className="text-right text-red-600">
                          {tx.debit ? `Tsh ${tx.debit.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {tx.credit ? `Tsh ${tx.credit.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {tx.balance ? `Tsh ${tx.balance.toLocaleString()}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {parsedTransactions.length > 5 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          ... and {parsedTransactions.length - 5} more transactions
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Import</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Download the CSV template using the button above</li>
              <li>Fill in your bank statement data following the format:
                <ul className="list-disc list-inside ml-6 mt-1 text-sm">
                  <li><strong>Date:</strong> YYYY-MM-DD format</li>
                  <li><strong>Description:</strong> Transaction description</li>
                  <li><strong>Reference:</strong> Invoice number, check number, etc.</li>
                  <li><strong>Debit:</strong> Amount withdrawn (leave blank for deposits)</li>
                  <li><strong>Credit:</strong> Amount deposited (leave blank for withdrawals)</li>
                  <li><strong>Balance:</strong> Running balance (optional)</li>
                </ul>
              </li>
              <li>Select your bank account from the dropdown</li>
              <li>Upload the CSV file</li>
              <li>Review the preview and click "Review & Import"</li>
              <li>Reconcile transactions with your Chart of Accounts</li>
            </ol>
          </CardContent>
        </Card>

        {/* Reconcile Dialog */}
        <Dialog open={showReconcileDialog} onOpenChange={setShowReconcileDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Transactions</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Account</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedTransactions.map((tx, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{tx.date}</TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell className={`text-right ${tx.debit ? 'text-red-600' : 'text-green-600'}`}>
                        {tx.debit ? `-${tx.debit.toLocaleString()}` : `+${tx.credit?.toLocaleString()}`}
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={tx.accountCode} 
                          onValueChange={(code) => {
                            const updated = [...parsedTransactions];
                            updated[idx].accountCode = code;
                            updated[idx].matched = true;
                            setParsedTransactions(updated);
                          }}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1002">1002 - Bank Account</SelectItem>
                            <SelectItem value="5001">5001 - Fuel Expense</SelectItem>
                            <SelectItem value="6100">6100 - Vehicle Repairs</SelectItem>
                            <SelectItem value="4002">4002 - Local Delivery Revenue</SelectItem>
                            <SelectItem value="6200">6200 - Marketing</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button 
                onClick={handleImport} 
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? 'Importing...' : `Import ${parsedTransactions.length} Transactions`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
