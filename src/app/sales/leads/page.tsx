"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { 
  Building2, Plus, Search, Phone, Mail, MapPin, TrendingUp, 
  ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock, User, 
  Briefcase, Globe, FileText, ArrowRight
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Lead = {
  id?: string;
  company_name: string;
  industry: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  lead_source: string;
  probability: number;
  status: string;
  assigned_salesperson_id?: string;
  notes: string;
  converted_to_customer_id?: string;
  created_at?: string;
};

type Salesperson = {
  id: string;
  name: string;
  email: string;
};

const INDUSTRIES = [
  "Manufacturing",
  "Mining",
  "Agriculture",
  "Construction",
  "Logistics",
  "Retail",
  "Technology",
  "Other",
];

const LEAD_SOURCES = [
  "Website",
  "Referral",
  "Cold Call",
  "Trade Show",
  "Social Media",
  "Advertisement",
  "Partner",
  "Other",
];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-10 text-blue border-blue/20",
  contacted: "bg-purple-10 text-purple border-purple/20",
  qualified: "bg-cyan-10 text-cyan border-cyan/20",
  converted: "bg-success/10 text-success border-success/20",
  lost: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function LeadsPage() {
  const { toast } = useToast();
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [leadForm, setLeadForm] = useState<Lead>({
    company_name: "",
    industry: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    country: "",
    lead_source: "",
    probability: 50,
    status: "new",
    notes: "",
  });

  const loadLeads = async () => {
    setLoading(true);
    try {
      const [leadsData, usersData] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("users").select("*").eq("role", "SALES"),
      ]);

      setLeads(leadsData.data || []);
      setSalespeople(usersData.data || []);
    } catch (err) {
      console.error("Error loading leads:", err);
      toast({ title: "Error", description: "Failed to load leads", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const saveLead = async () => {
    if (!leadForm.company_name || !leadForm.contact_person || !leadForm.phone) {
      toast({ title: "Validation Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const leadData = {
        company_name: leadForm.company_name,
        industry: leadForm.industry,
        contact_person: leadForm.contact_person,
        phone: leadForm.phone,
        email: leadForm.email,
        address: leadForm.address,
        country: leadForm.country,
        lead_source: leadForm.lead_source,
        probability: leadForm.probability,
        status: leadForm.status,
        assigned_salesperson_id: leadForm.assigned_salesperson_id || null,
        notes: leadForm.notes,
      };

      let error;
      if (editingLead?.id) {
        const result = await supabase.from("leads").update(leadData).eq("id", editingLead.id);
        error = result.error;
      } else {
        const result = await supabase.from("leads").insert(leadData);
        error = result.error;
      }

      if (error) throw error;

      await loadLeads();
      setShowDialog(false);
      setLeadForm({
        company_name: "",
        industry: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "",
        country: "",
        lead_source: "",
        probability: 50,
        status: "new",
        notes: "",
      });
      setEditingLead(null);
      toast({ title: "Success", description: editingLead ? "Lead updated" : "Lead created" });
    } catch (err) {
      console.error("Error saving lead:", err);
      toast({ title: "Error", description: "Failed to save lead", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const convertToCustomer = async (lead: Lead) => {
    if (!confirm(`Convert ${lead.company_name} to a customer?`)) return;

    try {
      // Generate customer code
      const customerCode = `CUST-${Date.now().toString().slice(-8)}`;

      const customerData = {
        customer_code: customerCode,
        company_name: lead.company_name,
        contact_person: lead.contact_person,
        email: lead.email,
        phone: lead.phone,
        address: lead.address,
        city: lead.country,
        tax_id: "",
        credit_limit: 0,
        status: "active",
      };

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert(customerData)
        .select()
        .single();

      if (customerError) throw customerError;

      // Update lead with customer reference
      const { error: leadError } = await supabase
        .from("leads")
        .update({ 
          converted_to_customer_id: customer.id, 
          status: "converted" 
        })
        .eq("id", lead.id);

      if (leadError) throw leadError;

      await loadLeads();
      toast({ 
        title: "Success", 
        description: `Lead converted to customer: ${customerCode}` 
      });
    } catch (err) {
      console.error("Error converting lead:", err);
      toast({ title: "Error", description: "Failed to convert lead", variant: "destructive" });
    }
  };

  const editLead = (lead: Lead) => {
    setEditingLead(lead);
    setLeadForm({ ...lead });
    setShowDialog(true);
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;

    try {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
      await loadLeads();
      toast({ title: "Success", description: "Lead deleted" });
    } catch (err) {
      console.error("Error deleting lead:", err);
      toast({ title: "Error", description: "Failed to delete lead", variant: "destructive" });
    }
  };

  const filteredLeads = leads.filter(
    (lead) =>
      (statusFilter === "all" || lead.status === statusFilter) &&
      (lead.company_name.toLowerCase().includes(search.toLowerCase()) ||
        lead.contact_person.toLowerCase().includes(search.toLowerCase()) ||
        lead.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const getStatusBadge = (status: string) => (
    <Badge className={STATUS_COLORS[status] || "bg-gray-10 text-gray border-gray/20"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );

  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.status === "new").length;
  const qualifiedLeads = leads.filter((l) => l.status === "qualified").length;
  const convertedLeads = leads.filter((l) => l.status === "converted").length;
  const avgProbability = leads.length > 0 
    ? Math.round(leads.reduce((sum, l) => sum + l.probability, 0) / leads.length) 
    : 0;

  if (role === "DRIVER") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar role={role} />
        <main className="flex-1 md:ml-60 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Access denied. Drivers cannot access Sales module.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role || "CEO"} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" asChild>
              <Link href="/sales">
                <ArrowLeft className="size-4 mr-2" /> Back to Sales
              </Link>
            </Button>
            <Button onClick={loadLeads} disabled={loading}>
              <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
            </Button>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Lead Management</h1>
            <p className="text-muted-foreground">Track and convert potential customers</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="size-4 text-primary" />
                  <p className="text-xs font-medium text-muted-foreground uppercase">Total Leads</p>
                </div>
                <p className="text-2xl font-bold">{totalLeads}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="size-4 text-blue-500" />
                  <p className="text-xs font-medium text-muted-foreground uppercase">New</p>
                </div>
                <p className="text-2xl font-bold text-blue-500">{newLeads}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="size-4 text-cyan-500" />
                  <p className="text-xs font-medium text-muted-foreground uppercase">Qualified</p>
                </div>
                <p className="text-2xl font-bold text-cyan-500">{qualifiedLeads}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="size-4 text-success" />
                  <p className="text-xs font-medium text-muted-foreground uppercase">Avg Probability</p>
                </div>
                <p className="text-2xl font-bold text-success">{avgProbability}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mb-6">
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="size-4" /> Add Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingLead ? "Edit Lead" : "Add New Lead"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Company Name *</Label>
                      <Input
                        value={leadForm.company_name}
                        onChange={(e) => setLeadForm({ ...leadForm, company_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Industry</Label>
                      <Select
                        value={leadForm.industry}
                        onValueChange={(value) => setLeadForm({ ...leadForm, industry: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.map((industry) => (
                            <SelectItem key={industry} value={industry}>
                              {industry}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Person *</Label>
                      <Input
                        value={leadForm.contact_person}
                        onChange={(e) => setLeadForm({ ...leadForm, contact_person: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone *</Label>
                      <Input
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Lead Source</Label>
                      <Select
                        value={leadForm.lead_source}
                        onValueChange={(value) => setLeadForm({ ...leadForm, lead_source: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_SOURCES.map((source) => (
                            <SelectItem key={source} value={source}>
                              {source}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Country</Label>
                      <Input
                        value={leadForm.country}
                        onChange={(e) => setLeadForm({ ...leadForm, country: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Assigned Salesperson</Label>
                      <Select
                        value={leadForm.assigned_salesperson_id}
                        onValueChange={(value) => setLeadForm({ ...leadForm, assigned_salesperson_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {salespeople.map((sp) => (
                            <SelectItem key={sp.id} value={sp.id}>
                              {sp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={leadForm.address}
                      onChange={(e) => setLeadForm({ ...leadForm, address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={leadForm.status}
                        onValueChange={(value) => setLeadForm({ ...leadForm, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="converted">Converted</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Probability ({leadForm.probability}%)</Label>
                      <Input
                        type="range"
                        min="0"
                        max="100"
                        value={leadForm.probability}
                        onChange={(e) => setLeadForm({ ...leadForm, probability: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={leadForm.notes}
                      onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => { setShowDialog(false); setEditingLead(null); }}>
                      Cancel
                    </Button>
                    <Button onClick={saveLead} disabled={submitting}>
                      {submitting ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <div className="flex items-center gap-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Leads Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-5" /> All Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Probability</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          No leads found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLeads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.company_name}</TableCell>
                          <TableCell>{lead.contact_person}</TableCell>
                          <TableCell className="text-muted-foreground">{lead.phone}</TableCell>
                          <TableCell className="text-muted-foreground">{lead.email || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{lead.lead_source || "-"}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(lead.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${lead.probability}%` }}
                                />
                              </div>
                              <span className="text-xs">{lead.probability}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {salespeople.find((sp) => sp.id === lead.assigned_salesperson_id)?.name || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {lead.status !== "converted" && lead.status !== "lost" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => convertToCustomer(lead)}
                                  className="text-xs h-7 text-success"
                                  title="Convert to Customer"
                                >
                                  <CheckCircle className="size-3 mr-1" /> Convert
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => editLead(lead)}>
                                <FileText className="size-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteLead(lead.id!)}>
                                <XCircle className="size-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

