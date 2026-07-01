"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sidebar } from "@/components/navigation/sidebar";
import { FinanceSidebar } from "@/components/finance/finance-sidebar";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { 
  Plus, Edit, Trash2, FileText, Calendar, ArrowLeft, Search
} from "lucide-react";
import { formatCurrency, AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";
import { ChartOfAccountsService, COAAccount } from "@/services/chart-of-accounts-service";

interface JournalEntryLine {
  id?: string;
  account_code: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
}

interface JournalEntry {
  id: string;
  entry_date: string;
  description: string;
  reference_number: string;
  created_at: string;
  lines?: JournalEntryLine[];
}

export default function JournalEntriesPage() {
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<COAAccount[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // New entry form state
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [entryDescription, setEntryDescription] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [entryLines, setEntryLines] = useState<JournalEntryLine[]>([
    { account_code: "", account_name: "", debit_amount: 0, credit_amount: 0 }
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accountsRes, entriesRes] = await Promise.all([
        ChartOfAccountsService.getAccounts(),
        supabase
          .from("journal_entries")
          .select("*, journal_entry_lines(*)")
          .order("entry_date", { ascending: false })
          .order("created_at", { ascending: false })
      ]);
      
      setCoaAccounts(accountsRes);
      setEntries((entriesRes.data || []) as JournalEntry[]);
    } catch (err) {
      console.error("Error loading data:", err);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => {
    setEntryLines([
      ...entryLines,
      { account_code: "", account_name: "", debit_amount: 0, credit_amount: 0 }
    ]);
  };

  const removeLine = (index: number) => {
    if (entryLines.length > 1) {
      setEntryLines(entryLines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, updates: Partial<JournalEntryLine>) => {
    const newLines = [...entryLines];
    if (updates.account_code) {
      const account = coaAccounts.find(a => a.code === updates.account_code);
      if (account) {
        updates.account_name = account.name;
      }
    }
    newLines[index] = { ...newLines[index], ...updates };
    setEntryLines(newLines);
  };

  const validateEntry = () => {
    if (!entryDescription.trim()) {
      toast({ title: "Error", description: "Description is required", variant: "destructive" });
      return false;
    }

    if (entryLines.length < 2) {
      toast({ title: "Error", description: "At least two lines are required (debit and credit)", variant: "destructive" });
      return false;
    }

    const totalDebits = entryLines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
    const totalCredits = entryLines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      toast({ 
        title: "Error", 
        description: `Debits (${formatCurrency(totalDebits, 'TZS')}) must equal credits (${formatCurrency(totalCredits, 'TZS')})`, 
        variant: "destructive" 
      });
      return false;
    }

    for (const line of entryLines) {
      if (!line.account_code) {
        toast({ title: "Error", description: "All lines must have an account selected", variant: "destructive" });
        return false;
      }
      if ((line.debit_amount || 0) === 0 && (line.credit_amount || 0) === 0) {
        toast({ title: "Error", description: "All lines must have a debit or credit amount", variant: "destructive" });
        return false;
      }
    }

    return true;
  };

  const saveEntry = async () => {
    if (!validateEntry()) return;

    try {
      const entryData = {
        entry_date: entryDate,
        description: entryDescription,
        reference_number: referenceNumber || `JE-${Date.now()}`
      };

      if (editingEntry) {
        // Update existing entry
        const { error: entryError } = await supabase
          .from("journal_entries")
          .update(entryData)
          .eq("id", editingEntry.id);

        if (entryError) throw entryError;

        // Delete old lines
        const { error: deleteError } = await supabase
          .from("journal_entry_lines")
          .delete()
          .eq("journal_entry_id", editingEntry.id);

        if (deleteError) throw deleteError;

        // Insert new lines
        const { error: insertError } = await supabase
          .from("journal_entry_lines")
          .insert(entryLines.map(line => ({
            ...line,
            journal_entry_id: editingEntry.id
          })));

        if (insertError) throw insertError;

        toast({ title: "Success", description: "Journal entry updated" });
      } else {
        // Create new entry
        const { data: newEntry, error: entryError } = await supabase
          .from("journal_entries")
          .insert(entryData)
          .select()
          .single();

        if (entryError) throw entryError;

        // Insert lines
        const { error: insertError } = await supabase
          .from("journal_entry_lines")
          .insert(entryLines.map(line => ({
            ...line,
            journal_entry_id: newEntry.id
          })));

        if (insertError) throw insertError;

        toast({ title: "Success", description: "Journal entry created" });
      }

      // Reset form and reload
      resetForm();
      setIsAddDialogOpen(false);
      await loadData();
    } catch (err) {
      console.error("Error saving entry:", err);
      toast({ title: "Error", description: "Failed to save journal entry", variant: "destructive" });
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this journal entry?")) return;

    try {
      await supabase.from("journal_entries").delete().eq("id", entryId);
      toast({ title: "Success", description: "Journal entry deleted" });
      await loadData();
    } catch (err) {
      console.error("Error deleting entry:", err);
      toast({ title: "Error", description: "Failed to delete journal entry", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setEditingEntry(null);
    setEntryDate(new Date().toISOString().split('T')[0]);
    setEntryDescription("");
    setReferenceNumber("");
    setEntryLines([
      { account_code: "", account_name: "", debit_amount: 0, credit_amount: 0 }
    ]);
  };

  const startEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setEntryDate(entry.entry_date);
    setEntryDescription(entry.description);
    setReferenceNumber(entry.reference_number);
    setEntryLines((entry.lines || []).map(line => ({ ...line })));
    setIsAddDialogOpen(true);
  };

  const totalDebits = entryLines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
  const totalCredits = entryLines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  const filteredEntries = entries.filter(entry => 
    entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.reference_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <div className="flex flex-1">
        <FinanceSidebar />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <FileText className="size-6" />
                  Journal Entries
                </h1>
                <p className="text-muted-foreground">Record and manage your accounting journal entries</p>
              </div>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search journal entries..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                  if (!open) resetForm();
                  setIsAddDialogOpen(open);
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="size-4" />
                      New Entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingEntry ? "Edit Journal Entry" : "New Journal Entry"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="entry-date">Date</Label>
                          <Input 
                            id="entry-date"
                            type="date"
                            value={entryDate}
                            onChange={(e) => setEntryDate(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="reference">Reference #</Label>
                          <Input 
                            id="reference"
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            placeholder="e.g., JE-001"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea 
                          id="description"
                          value={entryDescription}
                          onChange={(e) => setEntryDescription(e.target.value)}
                          placeholder="Description of this journal entry"
                          required
                        />
                      </div>

                      {/* Lines */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium">Entry Lines</h3>
                          <Button type="button" variant="outline" onClick={addLine}>
                            <Plus className="size-4 mr-2" />
                            Add Line
                          </Button>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Account</TableHead>
                              <TableHead className="text-right">Debit</TableHead>
                              <TableHead className="text-right">Credit</TableHead>
                              <TableHead className="w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {entryLines.map((line, index) => (
                              <TableRow key={index}>
                                <TableCell className="w-1/2">
                                  <Select 
                                    value={line.account_code}
                                    onValueChange={(val) => updateLine(index, { account_code: val })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select account" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-80">
                                      {coaAccounts.map(acc => (
                                        <SelectItem key={acc.code} value={acc.code}>
                                          {acc.code} - {acc.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input 
                                    type="number" 
                                    step="0.01"
                                    value={line.debit_amount || ""}
                                    onChange={(e) => updateLine(index, { debit_amount: parseFloat(e.target.value) || 0 })}
                                    placeholder="0.00"
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input 
                                    type="number" 
                                    step="0.01"
                                    value={line.credit_amount || ""}
                                    onChange={(e) => updateLine(index, { credit_amount: parseFloat(e.target.value) || 0 })}
                                    placeholder="0.00"
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  {entryLines.length > 1 && (
                                    <Button 
                                      variant="destructive" 
                                      size="sm" 
                                      onClick={() => removeLine(index)}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Totals */}
                        <div className="flex justify-end gap-8 pt-4 border-t">
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Total Debits</div>
                            <div className="text-xl font-bold">{formatCurrency(totalDebits, "TZS")}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Total Credits</div>
                            <div className="text-xl font-bold">{formatCurrency(totalCredits, "TZS")}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Balance</div>
                            <div className={cn("text-xl font-bold", isBalanced ? "text-green-600" : "text-red-600")}>
                              {isBalanced ? "Balanced" : `Unbalanced: ${formatCurrency(Math.abs(totalDebits - totalCredits), "TZS")}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="pt-6">
                      <Button variant="outline" onClick={() => {
                        resetForm();
                        setIsAddDialogOpen(false);
                      }}>
                        Cancel
                      </Button>
                      <Button onClick={saveEntry} disabled={!isBalanced}>
                        {editingEntry ? "Update Entry" : "Create Entry"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Entries Table */}
            <Card>
              <CardHeader>
                <CardTitle>Journal Entries</CardTitle>
                <CardDescription>
                  Showing {filteredEntries.length} entry{filteredEntries.length !== 1 ? "ies" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12 text-muted-foreground">Loading entries...</div>
                ) : filteredEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="size-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-4">No journal entries yet</p>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                      <Plus className="size-4 mr-2" />
                      Create your first entry
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference #</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Lines</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Calendar className="size-4 text-muted-foreground" />
                              {new Date(entry.entry_date).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{entry.reference_number}</Badge>
                          </TableCell>
                          <TableCell>{entry.description}</TableCell>
                          <TableCell className="text-right">
                            <Badge>{(entry.lines || []).length} lines</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(entry.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => startEdit(entry)}>
                                <Edit className="size-4 mr-1" />
                                Edit
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => deleteEntry(entry.id)}>
                                <Trash2 className="size-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
