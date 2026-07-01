"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sidebar } from "@/components/navigation/sidebar";
import { FinanceSidebar } from "@/components/finance/finance-sidebar";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Trash2,
  FileText,
  Calendar,
  ArrowLeft,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Filter,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Clock,
  History,
  Layout,
} from "lucide-react";
import { formatCurrency, AVAILABLE_CURRENCIES } from "@/components/ui/currency-badge";
import { ChartOfAccountsService, COAAccount } from "@/services/chart-of-accounts-service";
import { cn } from "@/lib/utils";

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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<COAAccount[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Sidebar states
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);

  // Filter states
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterAccountCode, setFilterAccountCode] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // New entry form state
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [entryDescription, setEntryDescription] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [entryLines, setEntryLines] = useState<JournalEntryLine[]>([
    { account_code: "", account_name: "", debit_amount: 0, credit_amount: 0 }
  ]);

  // COA dropdown search states
  const [coaSearchTerm, setCoaSearchTerm] = useState("");

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
    setSaving(true);

    try {
      const entryData = {
        entry_date: entryDate,
        description: entryDescription,
        reference_number: referenceNumber || `JE-${Date.now()}`
      };

      if (editingEntry) {
        const { error: entryError } = await supabase
          .from("journal_entries")
          .update(entryData)
          .eq("id", editingEntry.id);

        if (entryError) throw entryError;

        const { error: deleteError } = await supabase
          .from("journal_entry_lines")
          .delete()
          .eq("journal_entry_id", editingEntry.id);

        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase
          .from("journal_entry_lines")
          .insert(entryLines.map(line => ({
            ...line,
            journal_entry_id: editingEntry.id
          })));

        if (insertError) throw insertError;

        toast({ title: "Success", description: "Journal entry updated successfully" });
      } else {
        const { data: newEntry, error: entryError } = await supabase
          .from("journal_entries")
          .insert(entryData)
          .select()
          .single();

        if (entryError) throw entryError;

        const { error: insertError } = await supabase
          .from("journal_entry_lines")
          .insert(entryLines.map(line => ({
            ...line,
            journal_entry_id: newEntry.id
          })));

        if (insertError) throw insertError;

        toast({ title: "Success", description: "Journal entry created successfully" });
      }

      resetForm();
      setIsAddDialogOpen(false);
      await loadData();
    } catch (err: any) {
      console.error("Error saving entry:", err);
      toast({
        title: "Error Saving Entry",
        description: err.message || "Failed to save journal entry",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (entryId: string) => {
    setDeleting(entryId);
    try {
      const { error } = await supabase.from("journal_entries").delete().eq("id", entryId);
      if (error) throw error;
      toast({ title: "Success", description: "Journal entry deleted successfully" });
      await loadData();
    } catch (err: any) {
      console.error("Error deleting entry:", err);
      toast({
        title: "Error Deleting Entry",
        description: err.message || "Failed to delete journal entry",
        variant: "destructive"
      });
    } finally {
      setDeleting(null);
      setIsDeleteDialogOpen(false);
      setEntryToDelete(null);
    }
  };

  const confirmDelete = (entry: JournalEntry) => {
    setEntryToDelete(entry);
    setIsDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setEditingEntry(null);
    setEntryDate(new Date().toISOString().split('T')[0]);
    setEntryDescription("");
    setReferenceNumber("");
    setEntryLines([
      { account_code: "", account_name: "", debit_amount: 0, credit_amount: 0 }
    ]);
    setCoaSearchTerm("");
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

  // Filtered COA accounts based on search term
  const filteredCoaAccounts = useMemo(() => {
    if (!coaSearchTerm) return coaAccounts;
    const searchLower = coaSearchTerm.toLowerCase();
    return coaAccounts.filter(acc =>
      acc.code.toLowerCase().includes(searchLower) ||
      acc.name.toLowerCase().includes(searchLower)
    );
  }, [coaAccounts, coaSearchTerm]);

  // Filtered journal entries based on search and filters
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      let matches = true;

      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        matches = matches && (
          entry.description.toLowerCase().includes(searchLower) ||
          entry.reference_number.toLowerCase().includes(searchLower)
        );
      }

      if (filterDateFrom) {
        matches = matches && new Date(entry.entry_date) >= new Date(filterDateFrom);
      }

      if (filterDateTo) {
        matches = matches && new Date(entry.entry_date) <= new Date(filterDateTo);
      }

      if (filterAccountCode) {
        matches = matches && (entry.lines || []).some(line => line.account_code === filterAccountCode);
      }

      return matches;
    });
  }, [entries, searchTerm, filterDateFrom, filterDateTo, filterAccountCode]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left: Main Sidebar */}
      <Sidebar role={role} />

      <div className="flex flex-1">
        {/* Left: Finance Sidebar (Collapsible) */}
        <div className="relative">
          {!isLeftSidebarCollapsed ? (
            <div className="flex">
              <FinanceSidebar />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-4 z-10 bg-background border border-l-0 border-border rounded-l-none rounded-r-lg"
                onClick={() => setIsLeftSidebarCollapsed(true)}
              >
                <ChevronLeft className="size-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="border border-border bg-background"
              onClick={() => setIsLeftSidebarCollapsed(false)}
            >
              <Layout className="size-4" />
            </Button>
          )}

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-y-auto w-full">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-2">
                    <FileText className="size-6" />
                    Journal Entries
                  </h1>
                  <p className="text-muted-foreground">Record and manage your accounting journal entries</p>
                </div>
                <div className="flex gap-3 items-center">
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
                                <TableHead className="w-1/2">Account</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                                <TableHead className="w-10"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {entryLines.map((line, index) => (
                                <TableRow key={index}>
                                  <TableCell className="w-1/2">
                                    <div className="space-y-2">
                                      <Input
                                        placeholder="Search accounts..."
                                        value={coaSearchTerm}
                                        onChange={(e) => setCoaSearchTerm(e.target.value)}
                                        className="mb-2"
                                      />
                                      <Select
                                        value={line.account_code}
                                        onValueChange={(val) => updateLine(index, { account_code: val })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select account" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-80">
                                          {filteredCoaAccounts.map(acc => (
                                            <SelectItem key={acc.code} value={acc.code}>
                                              {acc.code} - {acc.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
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
                        }} disabled={saving}>
                          Cancel
                        </Button>
                        <Button onClick={saveEntry} disabled={!isBalanced || saving}>
                          {saving ? (
                            <>
                              <Loader2 className="size-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            editingEntry ? "Update Entry" : "Create Entry"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Entries Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Journal Entries</CardTitle>
                      <CardDescription>
                        Showing {filteredEntries.length} entry{filteredEntries.length !== 1 ? "ies" : ""}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}>
                      <Filter className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                      <Loader2 className="size-8 animate-spin mb-4" />
                      Loading entries...
                    </div>
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
                                <Button variant="destructive" size="sm" onClick={() => confirmDelete(entry)} disabled={deleting === entry.id}>
                                  {deleting === entry.id ? (
                                    <Loader2 className="size-4 mr-1 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-4 mr-1" />
                                  )}
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

              {/* Delete Confirmation Dialog */}
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Journal Entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this journal entry? This action cannot be undone.
                      <br />
                      <span className="font-semibold mt-2 block">Reference: {entryToDelete?.reference_number}</span>
                      <span className="text-sm text-muted-foreground">{entryToDelete?.description}</span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => {
                      setIsDeleteDialogOpen(false);
                      setEntryToDelete(null);
                    }} disabled={!!deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => entryToDelete && deleteEntry(entryToDelete.id)}
                      className="bg-red-600 hover:bg-red-700 text-white"
                      disabled={!!deleting}
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

            </div>
          </main>
        </div>

        {/* Right Sidebar (Filters & History) */}
        {!isRightSidebarCollapsed && (
          <aside className="w-80 bg-card border-l border-border flex flex-col h-[calc(100vh-64px)] sticky top-16 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-primary" />
                <h3 className="font-semibold text-foreground">Filters & History</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsRightSidebarCollapsed(true)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Search and Filter Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Search & Filter</h4>

                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search journal entries..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="date-from" className="text-xs">From Date</Label>
                      <Input
                        id="date-from"
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="date-to" className="text-xs">To Date</Label>
                      <Input
                        id="date-to"
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="account-filter" className="text-xs">Chart of Accounts</Label>
                    <Select
                      value={filterAccountCode || "all"}
                      onValueChange={(val) => setFilterAccountCode(val === "all" ? "" : val)}
                    >
                      <SelectTrigger id="account-filter">
                        <SelectValue placeholder="All Accounts" />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        <SelectItem value="all">All Accounts</SelectItem>
                        {coaAccounts.map(acc => (
                          <SelectItem key={acc.code} value={acc.code}>
                            {acc.code} - {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setSearchTerm("");
                        setFilterDateFrom("");
                        setFilterDateTo("");
                        setFilterAccountCode("");
                      }}
                    >
                      Reset Filters
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Chart of Accounts Quick Reference */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="size-4" />
                  Chart of Accounts
                </h4>
                <div className="space-y-1 max-h-48 overflow-y-auto bg-muted/30 rounded-lg p-2">
                  {coaAccounts.slice(0, 20).map(acc => (
                    <div key={acc.code} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded cursor-pointer transition-colors" onClick={() => setFilterAccountCode(acc.code)}>
                      <div className="flex justify-between">
                        <span className="font-medium">{acc.code}</span>
                        <span>{acc.name}</span>
                      </div>
                    </div>
                  ))}
                  {coaAccounts.length > 20 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground italic text-center">
                      ...and {coaAccounts.length - 20} more
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Recent Entries History */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <History className="size-4" />
                  Recent Entries
                </h4>
                <div className="space-y-2">
                  {entries.slice(0, 5).map(entry => (
                    <div key={entry.id} className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => startEdit(entry)}>
                      <div className="flex items-start justify-between mb-1">
                        <div className="font-medium text-foreground text-sm">{entry.reference_number}</div>
                        <Badge variant="outline" className="text-[10px]">{(entry.lines || []).length} lines</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{entry.description}</div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                        <Clock className="size-3" />
                        {new Date(entry.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
