"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell, PageHeader, SectionCard, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { Mail, Send, Loader2, Inbox } from "lucide-react";

interface Customer {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
}

interface ClientEmailRow {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  status: "sent" | "failed";
  error_message: string | null;
  created_at: string;
  customers: { company_name: string } | null;
  sender: { name: string } | null;
}

async function authedFetch(url: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function ClientEmailPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [history, setHistory] = useState<ClientEmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [to, setTo] = useState("");
  const [toName, setToName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [customersRes, historyRes] = await Promise.all([
        supabase.from("customers").select("id, company_name, contact_person, email").is("deleted_at", null).order("company_name"),
        supabase
          .from("client_emails")
          .select("id, to_email, to_name, subject, status, error_message, created_at, customers(company_name), sender:user_profiles(name)")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (customersRes.error) throw customersRes.error;
      if (historyRes.error) throw historyRes.error;
      setCustomers((customersRes.data as any) ?? []);
      setHistory((historyRes.data as any) ?? []);
    } catch (error: any) {
      toast({ title: "Error loading email data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setTo(customer.email || "");
      setToName(customer.contact_person || customer.company_name || "");
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await authedFetch("/api/email/send", {
        method: "POST",
        body: JSON.stringify({
          customerId: selectedCustomerId || null,
          to,
          toName: toName || null,
          subject,
          message,
        }),
      });
      toast({ title: "Email sent", description: `Sent to ${to}` });
      setSubject("");
      setMessage("");
      load();
    } catch (error: any) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Client Communication"
        title="Client Email"
        subtitle="Send from info@calvary.co.tz — every message is logged against the customer record."
        icon={Mail}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <SectionCard title="Compose" icon={Send} className="lg:col-span-2 h-fit">
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-2">
              <Label>Customer (optional)</Label>
              <Select value={selectedCustomerId} onValueChange={handleSelectCustomer}>
                <SelectTrigger><SelectValue placeholder="Pick a customer to autofill" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCustomer && !selectedCustomer.email && (
                <p className="text-xs text-warning">This customer has no email on file — enter one below.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>To email *</Label>
                <Input type="email" required value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Contact name</Label>
                <Input value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Jane Mwangi" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input required value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea required rows={8} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your message…" />
            </div>
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {sending ? "Sending…" : "Send email"}
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="Sent history" icon={Inbox} className="lg:col-span-3" padded={false}>
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : history.length === 0 ? (
            <EmptyState icon={Mail} title="No emails sent yet" description="Emails you send to clients will show up here." />
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>To</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Sent by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium">{row.to_name || row.to_email}</p>
                      <p className="text-xs text-muted-foreground">{row.to_email}</p>
                    </TableCell>
                    <TableCell>{row.customers?.company_name ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{row.subject}</TableCell>
                    <TableCell>{row.sender?.name ?? "—"}</TableCell>
                    <TableCell>
                      {row.status === "sent" ? (
                        <Badge className="bg-success/10 text-success">Sent</Badge>
                      ) : (
                        <Badge className="bg-destructive/10 text-destructive" title={row.error_message ?? undefined}>Failed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </SectionCard>
      </div>
    </PageShell>
  );
}
