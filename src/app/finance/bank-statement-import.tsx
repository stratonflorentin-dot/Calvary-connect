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
  ArrowLeft, Search, RefreshCw, Landmark, ShieldCheck, XCircle, Loader2,
  Check, AlertTriangle, Link as LinkIcon, ExternalLink
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
  matchId?: string; // ID of matched internal record
  matchType?: 'invoice' | 'expense' | 'sale';
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

interface InternalRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'invoice' | 'expense' | 'sale';
  customer_name?: string;
  invoice_number?: string;
}

export function BankStatementImport() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [coa, setCoa] = useState<ChartOfAccount[]>([]);
  const [internalRecords, setInternalRecords] = useState<InternalRecord[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reconciliationMode, setReconciliationMode] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const [accountsRes, coaRes, invoicesRes, expensesRes, salesRes] = await Promise.all([
          supabase.from('bank_accounts').select('*').eq('is_active', true),
          supabase.from('accounts').select('code, name, category').order('code'),
          supabase.from('invoices').select('*').eq('status', 'pending'),
          supabase.from('expenses').select('*').eq('status', 'pending'),
          supabase.from('sales').select('*').eq('status', 'pending'),
        ]);
        
        setBankAccounts(accountsRes.data || []);
        setCoa(coaRes.data || []);

        // Combine internal records for reconciliation
        const combined: InternalRecord[] = [
          ...(invoicesRes.data || []).map(i => ({
            id: i.id,
            date: i.due_date,
            description: `Invoice ${i.invoice_number} - ${i.customer_name}`,
            amount: i.amount,
            type: 'invoice' as const,
            customer_name: i.customer_name,
            invoice_number: i.invoice_number
          })),
          ...(expensesRes.data || []).map(e => ({
            id: e.id,
            date: e.date,
            description: e.description,
            amount: e.amount,
            type: 'expense' as const
          })),
          ...(salesRes.data || []).map(s => ({
            id: s.id,
            date: s.date,
            description: s.description,
            amount: s.total_amount || s.amount,
            type: 'sale' as const
          }))
        ];
        setInternalRecords(combined);
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const findBestMatch = (tx: ParsedTransaction) => {
    const amount = tx.debit || tx.credit || 0;
    // Exact amount match within 7 days of transaction date
    const txDate = new Date(tx.date);
    
    return internalRecords.find(record => {
      const recordDate = new Date(record.date);
      const daysDiff = Math.abs(txDate.getTime() - recordDate.getTime()) / (1000 * 3600 * 24);
      return Math.abs(record.amount - amount) < 0.01 && daysDiff <= 7;
    });
  };

  const suggestAccount = (description: string) => {
    const desc = description.toLowerCase();
    
    // Direct Costs (5000s)
    if (desc.includes('fuel') || desc.includes('petrol') || desc.includes('diesel')) return '5101';
    if (desc.includes('repair') || desc.includes('service') || desc.includes('maintenance')) return '5104';
    if (desc.includes('salary') || desc.includes('pay') || desc.includes('allowance')) return '5102';
    if (desc.includes('toll') || desc.includes('tanroads')) return '5109';
    if (desc.includes('tire') || desc.includes('tyre')) return '5105';
    if (desc.includes('border') || desc.includes('tra') || desc.includes('customs')) return '5107';
    
    // Revenue (4000s)
    if (desc.includes('payment') || desc.includes('inv') || desc.includes('revenue') || desc.includes('freight')) return '4101';
    
    // Operating Expenses (6000s)
    if (desc.includes('rent')) return '6101';
    if (desc.includes('electric') || desc.includes('water') || desc.includes('luku')) return '6102';
    if (desc.includes('internet') || desc.includes('data') || desc.includes('software')) return '6103';
    if (desc.includes('fee') || desc.includes('charge') || desc.includes('commission')) return '6501';
    if (desc.includes('tax') || desc.includes('wht')) return '7102';
    
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
      const tx: ParsedTransaction = {
        id: `tx-${Date.now()}-${i}`,
        date: values[0] || '',
        description,
        reference: values[2] || '',
        debit: parseFloat(values[3]) || undefined,
        credit: parseFloat(values[4]) || undefined,
        balance: parseFloat(values[5]) || undefined,
        matched: false,
        accountCode: suggested,
      };

      const match = findBestMatch(tx);
      if (match) {
        tx.matched = true;
        tx.matchId = match.id;
        tx.matchType = match.type;
      }
      
      transactions.push(tx);
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

      // Update internal records status if matched
      const matchPromises = parsedTransactions
        .filter(tx => tx.matched && tx.matchId)
        .map(tx => {
          if (tx.matchType === 'invoice') {
            return supabase.from('invoices').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', tx.matchId);
          } else if (tx.matchType === 'expense') {
            return supabase.from('expenses').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', tx.matchId);
          } else if (tx.matchType === 'sale') {
            return supabase.from('sales').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', tx.matchId);
          }
          return Promise.resolve();
        });
      
      await Promise.all(matchPromises);

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
                                            <div className="flex flex-col gap-1">
                                                {tx.matchId ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[9px] uppercase">
                                                            <Check className="w-2.5 h-2.5 mr-1" /> Linked to {tx.matchType}
                                                        </Badge>
                                                        <ExternalLink className="w-3 h-3 text-slate-400" />
                                                    </div>
                                                ) : tx.accountCode ? (
                                                    <Badge className="bg-blue-100 text-blue-700 border-none font-bold text-[9px] uppercase">
                                                        {coa.find(c => c.code === tx.accountCode)?.name}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-slate-400 font-bold text-[9px] uppercase border-dashed">Manual Review</Badge>
                                                )}
                                            </div>
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
                                      <div className="space-y-1">
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
                                          
                                          {tx.matchId ? (
                                              <div className="flex items-center gap-2 p-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                                                  <LinkIcon className="w-3 h-3 text-emerald-600" />
                                                  <span className="text-[10px] font-bold text-emerald-700">Auto-matched to internal {tx.matchType}</span>
                                                  <button 
                                                    className="ml-auto text-[9px] text-slate-400 hover:text-red-500 font-black"
                                                    onClick={() => {
                                                        const updated = [...parsedTransactions];
                                                        delete updated[idx].matchId;
                                                        delete updated[idx].matchType;
                                                        updated[idx].matched = false;
                                                        setParsedTransactions(updated);
                                                    }}
                                                  >
                                                      UNLINK
                                                  </button>
                                              </div>
                                          ) : (
                                              <div className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                                                  <span className="text-[10px] font-bold text-slate-500">No internal record found</span>
                                              </div>
                                          )}
                                      </div>
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
