"use client";

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, Download, FileText, CheckCircle, AlertCircle, 
  ArrowLeft, Search, RefreshCw, Landmark, ShieldCheck, XCircle, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from "framer-motion";

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
  suggestedAccount?: string;
  confidence?: number;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  current_balance: number;
}

interface ChartOfAccount {
  code: string;
  name: string;
  category: string;
}

export function BankStatementImport() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [coa, setCoa] = useState<ChartOfAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const [accountsRes, coaRes] = await Promise.all([
        supabase.from('bank_accounts').select('*').eq('is_active', true),
        supabase.from('chart_of_accounts').select('code, name, category').order('code')
      ]);
      setBankAccounts(accountsRes.data || []);
      setCoa(coaRes.data || [
        { code: '1002', name: 'Bank Account', category: 'Asset' },
        { code: '5001', name: 'Fuel Expense', category: 'Expense' },
        { code: '6100', name: 'Vehicle Repairs', category: 'Expense' },
        { code: '4002', name: 'Local Delivery Revenue', category: 'Revenue' },
        { code: '6200', name: 'Marketing', category: 'Expense' },
      ]);
      setIsLoading(false);
    };
    init();
  }, []);

  const suggestAccount = (description: string) => {
    const desc = description.toLowerCase();
    if (desc.includes('fuel') || desc.includes('petrol') || desc.includes('diesel')) return '5001';
    if (desc.includes('repair') || desc.includes('service') || desc.includes('maintenance')) return '6100';
    if (desc.includes('payment') || desc.includes('inv') || desc.includes('revenue')) return '4002';
    if (desc.includes('marketing') || desc.includes('ads') || desc.includes('facebook')) return '6200';
    return undefined;
  };

  const parseCSV = (content: string): ParsedTransaction[] => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const transactions: ParsedTransaction[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 3) continue;
      
      const description = values[1] || '';
      const suggested = suggestAccount(description);
      
      transactions.push({
        id: `tx-${Date.now()}-${i}`,
        date: values[0] || '',
        description,
        reference: values[2] || '',
        debit: parseFloat(values[3]) || undefined,
        credit: parseFloat(values[4]) || undefined,
        balance: parseFloat(values[5]) || undefined,
        matched: !!suggested,
        accountCode: suggested,
        confidence: suggested ? 0.85 : 0
      });
    }
    
    return transactions;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    
    setFile(uploadedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const transactions = parseCSV(content);
      setParsedTransactions(transactions);
      toast({ title: 'Statement Parsed', description: `Detected ${transactions.length} potential entries.` });
    };
    reader.readAsText(uploadedFile);
  };

  const handleImport = async () => {
    if (!selectedAccount || parsedTransactions.length === 0) return;

    setIsUploading(true);
    try {
      const account = bankAccounts.find(a => a.id === selectedAccount);
      if (!account) throw new Error('Bank account missing');

      const { error: txError } = await supabase.from('bank_statements').insert(
        parsedTransactions.map(tx => ({
          bank_account_id: selectedAccount,
          transaction_date: tx.date,
          description: tx.description,
          reference_number: tx.reference,
          debit_amount: tx.debit || null,
          credit_amount: tx.credit || null,
          balance: tx.balance || 0,
          transaction_type: tx.debit ? 'withdrawal' : 'deposit',
          account_code: tx.accountCode,
          reconciled: tx.matched,
          created_at: new Date().toISOString()
        }))
      );

      if (txError) throw txError;

      // Update balance logic (simplified)
      const lastTx = parsedTransactions[parsedTransactions.length - 1];
      if (lastTx.balance) {
        await supabase.from('bank_accounts').update({ 
          current_balance: lastTx.balance,
          updated_at: new Date().toISOString()
        }).eq('id', selectedAccount);
      }

      toast({ title: 'Import Complete', description: 'Bank statement has been successfully processed.' });
      setFile(null);
      setParsedTransactions([]);
      setShowReviewDialog(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      toast({ title: 'Import Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) return <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-600" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Bank Reconciliation</h1>
          <p className="text-slate-500 font-medium">Import digital statements and auto-match with accounting ledger</p>
        </div>
        <div className="flex gap-2">
            <Link href="/finance">
                <Button variant="outline" className="font-bold"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
            </Link>
            <Button variant="outline" className="font-bold border-dashed border-slate-300">
                <Download className="w-4 h-4 mr-2" /> Template
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 border-none shadow-sm bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-700">1. Setup Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Select Target Account</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="bg-white border-none h-12 shadow-sm">
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.bank_name} ({acc.account_number.slice(-4)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="p-4 bg-white rounded-xl shadow-sm border border-emerald-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Current Ledger Balance</p>
                <p className="text-2xl font-black text-emerald-600">
                    Tsh {bankAccounts.find(a => a.id === selectedAccount)?.current_balance.toLocaleString() || '0'}
                </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">2. Upload & Preview</CardTitle>
            </div>
            {parsedTransactions.length > 0 && (
                <Button onClick={() => setShowReviewDialog(true)} className="bg-emerald-600 hover:bg-emerald-700 font-black px-6">
                    <ShieldCheck className="w-4 h-4 mr-2" /> Process {parsedTransactions.length} Items
                </Button>
            )}
          </CardHeader>
          <CardContent>
            {!file ? (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center bg-slate-50/50 group hover:border-emerald-300 transition-colors">
                    <div className="size-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Drop bank statement here</h3>
                    <p className="text-sm text-slate-500 mb-6">Support CSV files exported from CRDB, NMB, or NBC</p>
                    <Input 
                        ref={fileInputRef}
                        type="file" 
                        className="hidden" 
                        accept=".csv"
                        onChange={handleFileUpload}
                    />
                    <Button onClick={() => fileInputRef.current?.click()} className="bg-slate-900 font-bold px-8">Browse Files</Button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><FileText /></div>
                            <div>
                                <p className="font-bold text-slate-800">{file.name}</p>
                                <p className="text-[10px] font-medium text-slate-400">{(file.size / 1024).toFixed(1)} KB • CSV Format</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => { setFile(null); setParsedTransactions([]); }}><XCircle className="w-5 h-5 text-red-400" /></Button>
                    </div>

                    <div className="rounded-xl border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="font-bold">Date</TableHead>
                                    <TableHead className="font-bold">Description</TableHead>
                                    <TableHead className="text-right font-bold">Flow</TableHead>
                                    <TableHead className="font-bold">Auto-Match</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {parsedTransactions.slice(0, 10).map((tx, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="text-xs font-bold text-slate-500">{tx.date}</TableCell>
                                        <TableCell className="font-medium text-slate-700 max-w-xs truncate">{tx.description}</TableCell>
                                        <TableCell className={cn("text-right font-black", tx.debit ? "text-red-500" : "text-emerald-600")}>
                                            {tx.debit ? `-${tx.debit.toLocaleString()}` : `+${tx.credit?.toLocaleString()}`}
                                        </TableCell>
                                        <TableCell>
                                            {tx.accountCode ? (
                                                <Badge className="bg-blue-100 text-blue-700 border-none font-bold text-[9px] uppercase">
                                                    {coa.find(c => c.code === tx.accountCode)?.name}
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-400 font-bold text-[9px] uppercase border-dashed">Manual Review</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-none shadow-2xl">
              <DialogHeader>
                  <DialogTitle className="text-2xl font-black">Final Ledger Mapping</DialogTitle>
                  <DialogDescription>Review and correct the automated ledger assignments before finalizing the import.</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 pt-4">
                  <Table>
                      <TableHeader className="bg-slate-50 sticky top-0 z-10">
                          <TableRow>
                              <TableHead className="font-bold">Transaction</TableHead>
                              <TableHead className="text-right font-bold">Amount</TableHead>
                              <TableHead className="font-bold">Ledger Account</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {parsedTransactions.map((tx, idx) => (
                              <TableRow key={idx}>
                                  <TableCell>
                                      <p className="font-bold text-slate-800 text-xs">{tx.description}</p>
                                      <p className="text-[10px] text-slate-400 font-medium">{tx.date} • Ref: {tx.reference}</p>
                                  </TableCell>
                                  <TableCell className={cn("text-right font-black", tx.debit ? "text-red-500" : "text-emerald-600")}>
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
                                          <SelectTrigger className="w-full bg-slate-50 border-none h-9 text-xs font-bold">
                                              <SelectValue placeholder="Select Account" />
                                          </SelectTrigger>
                                          <SelectContent>
                                              {coa.map(c => (
                                                  <SelectItem key={c.code} value={c.code} className="text-xs font-medium">
                                                      {c.code} - {c.name}
                                                  </SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>

                  <div className="sticky bottom-0 bg-white pt-4 border-t flex gap-3">
                      <Button variant="outline" onClick={() => setShowReviewDialog(false)} className="flex-1 font-bold">Back to Preview</Button>
                      <Button onClick={handleImport} disabled={isUploading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-black">
                          {isUploading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                          Finalize {parsedTransactions.length} Entries
                      </Button>
                  </div>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
