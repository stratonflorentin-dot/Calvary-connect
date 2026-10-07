"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell, PageHeader, SectionCard, EmptyState } from "@/components/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
  Bot,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Database,
  Download,
  Copy,
  Save,
  RotateCcw,
  FileDown,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Quote,
  Undo,
  Redo,
  Link,
  Image as ImageIcon,
  Table,
  Share2,
  Star,
  Search,
  Edit3,
  Folder,
  Archive,
  MoreHorizontal,
} from "lucide-react";

const ALLOWED_ROLES = ["CEO", "ADMIN", "ACCOUNTANT", "HR"];

const LIVE_SOURCES: { key: string; label: string; description: string }[] = [
  { key: "revenue_by_vehicle", label: "Revenue by vehicle", description: "Delivered trips and revenue per truck" },
  { key: "driver_performance", label: "Driver performance", description: "Trips and delivery rate per driver" },
  { key: "route_profitability", label: "Route profitability", description: "Revenue per origin → destination corridor" },
  { key: "fuel_per_trip", label: "Fuel records", description: "Fuel requests with litres and cost" },
  { key: "trip_cost_variance", label: "Expenses by category", description: "Operating costs grouped by category" },
  { key: "fleet_snapshot", label: "Fleet snapshot", description: "Current vehicles, cash position, receivables" },
  { key: "monthly_reports", label: "Monthly reports", description: "Generated periodic reports" },
];

type FileSource = {
  id: string;
  name: string;
  file_name: string | null;
  kind: "excel" | "pdf";
  row_count: number;
  analysis: string | null;
  created_at: string;
};

type Msg = { 
  role: "user" | "ai"; 
  text: string;
  id: string;
  timestamp: Date;
  starred?: boolean;
  tags?: string[];
};

type Notebook = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Msg[];
  sources: string[];
};

export default function ReportNotebookPage() {
  const { role, isLoading: roleLoading } = useRole();
  const { user } = useSupabase();
  const allowed = !roleLoading && role && ALLOWED_ROLES.includes(role);

  const [liveSelected, setLiveSelected] = useState<string[]>(["revenue_by_vehicle", "fleet_snapshot"]);
  const [fileSources, setFileSources] = useState<FileSource[]>([]);
  const [includedIds, setIncludedIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [asking, setAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New features
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [currentNotebook, setCurrentNotebook] = useState<Notebook | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFormatting, setShowFormatting] = useState(false);
  const [history, setHistory] = useState<{ action: string; state: any }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const authHeader = useCallback(async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadSources = useCallback(async () => {
    try {
      const headers = await authHeader();
      const resp = await fetch("/api/ai/notebook/sources", { headers });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Failed to load sources");
      setFileSources(data.sources ?? []);
      setIncludedIds((prev) => {
        const ids = new Set((data.sources ?? []).map((s: FileSource) => s.id));
        return new Set([...prev].filter((id) => ids.has(id)));
      });
    } catch {
      setFileSources([]);
    }
  }, [authHeader]);

  useEffect(() => {
    if (allowed) loadSources();
  }, [allowed, loadSources]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, asking]);

  const toggleLive = (key: string) =>
    setLiveSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const toggleIncluded = (id: string) =>
    setIncludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const headers = await authHeader();
      const form = new FormData();
      form.append("file", file);
      const resp = await fetch("/api/ai/notebook/sources", { method: "POST", headers, body: form });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Upload failed");
      await loadSources();
      setIncludedIds((prev) => new Set([...prev, data.source.id]));
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: `Added source **${data.source.name}** (${data.source.kind}) and ran a full analysis — open it on the left to read it, then ask me anything about it.` },
      ]);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteSource = async (id: string) => {
    try {
      const headers = await authHeader();
      await fetch(`/api/ai/notebook/sources?id=${id}`, { method: "DELETE", headers });
      setFileSources((prev) => prev.filter((s) => s.id !== id));
      setIncludedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      /* non-fatal */
    }
  };

  const ask = async (rawQuestion?: string) => {
    const question = (rawQuestion ?? inputVal).trim();
    if (!question || asking) return;
    if (!liveSelected.length && !includedIds.size) {
      setMessages((prev) => [...prev, { role: "ai", text: "Select at least one source on the left first — a live report or an uploaded Excel/PDF." }]);
      return;
    }
    setInputVal("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setAsking(true);
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeader()) };
      const resp = await fetch("/api/ai/notebook", {
        method: "POST",
        headers,
        body: JSON.stringify({
          question,
          history: messages.slice(-10).map((m) => ({ role: m.role === "ai" ? "model" : "user", text: m.text })),
          liveSources: liveSelected,
          fileSourceIds: [...includedIds],
          startDate,
          endDate,
          user: user ? { name: user.name, email: user.email, role: user.role } : null,
        }),
      });
      const data = await resp.json();
      setMessages((prev) => [...prev, { role: "ai", text: data?.text || data?.error || "No response." }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "ai", text: `Notebook error: ${err.message || "server timeout"}` }]);
    } finally {
      setAsking(false);
    }
  };

  const downloadChat = () => {
    const md = messages.map((m) => (m.role === "user" ? `## Q: ${m.text}` : m.text)).join("\n\n---\n\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `notebook-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyToClipboard = () => {
    const text = messages.map((m) => (m.role === "user" ? `Q: ${m.text}\n\n` : `A: ${m.text}\n\n`)).join("\n---\n\n");
    navigator.clipboard.writeText(text);
  };

  const clearChat = () => {
    setMessages([]);
  };

  const saveAsPDF = () => {
    window.print();
  };

  const toggleStar = (msgId: string) => {
    setMessages(prev => prev.map(m => 
      m.id === msgId ? { ...m, starred: !m.starred } : m
    ));
  };

  const addTag = (msgId: string, tag: string) => {
    setMessages(prev => prev.map(m => 
      m.id === msgId ? { ...m, tags: [...(m.tags || []), tag] } : m
    ));
  };

  const createNewNotebook = () => {
    const newNotebook: Notebook = {
      id: crypto.randomUUID(),
      title: `Notebook ${notebooks.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [...messages],
      sources: [...liveSelected, ...includedIds],
    };
    setNotebooks(prev => [...prev, newNotebook]);
    setCurrentNotebook(newNotebook);
  };

  const saveCurrentNotebook = () => {
    if (!currentNotebook) return;
    setCurrentNotebook({
      ...currentNotebook,
      updatedAt: new Date(),
      messages,
      sources: [...liveSelected, ...includedIds],
    });
    setNotebooks(prev => prev.map(n => 
      n.id === currentNotebook.id ? { ...n, messages, sources: [...liveSelected, ...includedIds], updatedAt: new Date() } : n
    ));
  };

  const loadNotebook = (notebook: Notebook) => {
    setCurrentNotebook(notebook);
    setMessages(notebook.messages);
    setLiveSelected(notebook.sources.filter(s => LIVE_SOURCES.some(ls => ls.key === s)));
    setIncludedIds(new Set(notebook.sources.filter(s => !LIVE_SOURCES.some(ls => ls.key === s))));
  };

  const deleteNotebook = (id: string) => {
    setNotebooks(prev => prev.filter(n => n.id !== id));
    if (currentNotebook?.id === id) {
      setCurrentNotebook(null);
      setMessages([]);
    }
  };

  const filteredMessages = messages.filter(m => 
    m.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const insertFormatting = (format: string) => {
    const textarea = document.querySelector('textarea[name="message"]') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    
    let formatted = "";
    switch (format) {
      case "bold": formatted = `**${selected}**`; break;
      case "italic": formatted = `*${selected}*`; break;
      case "h1": formatted = `# ${selected}`; break;
      case "h2": formatted = `## ${selected}`; break;
      case "h3": formatted = `### ${selected}`; break;
      case "code": formatted = `\`${selected}\``; break;
      case "quote": formatted = `> ${selected}`; break;
      case "list": formatted = `- ${selected}`; break;
      case "ordered": formatted = `1. ${selected}`; break;
    }
    
    textarea.value = text.substring(0, start) + formatted + text.substring(end);
    setInputVal(textarea.value);
    textarea.focus();
    textarea.setSelectionRange(start + formatted.length, start + formatted.length);
  };

  if (roleLoading) return null;
  if (!allowed) {
    return (
      <PageShell>
        <EmptyState icon={Bot} title="Access denied" description="The AI Report Notebook is available to CEO, ADMIN, ACCOUNTANT and HR." />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Analytics"
        title="AI Report Notebook"
        subtitle="Pick live company reports and upload Excel / PDF files, then ask Gemini to analyse them together — answers are grounded in the real data."
        icon={Sparkles}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={createNewNotebook}>
              <Plus className="size-4 mr-2" /> New Notebook
            </Button>
            {currentNotebook && (
              <Button variant="outline" size="sm" onClick={saveCurrentNotebook}>
                <Save className="size-4 mr-2" /> Save
              </Button>
            )}
            {messages.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="size-4 mr-2" /> Copy
                </Button>
                <Button variant="outline" size="sm" onClick={downloadChat}>
                  <Download className="size-4 mr-2" /> Export
                </Button>
                <Button variant="outline" size="sm" onClick={saveAsPDF}>
                  <FileDown className="size-4 mr-2" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={clearChat}>
                  <RotateCcw className="size-4 mr-2" /> Clear
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_380px_1fr] gap-4 items-start">
        {/* ── Notebooks sidebar ── */}
        <div className="space-y-4">
          <SectionCard title="Notebooks" icon={Folder}>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full" onClick={createNewNotebook}>
                <Plus className="size-3 mr-2" /> New
              </Button>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {notebooks.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No notebooks yet</p>
                )}
                {notebooks.map((nb) => (
                  <button
                    key={nb.id}
                    onClick={() => loadNotebook(nb)}
                    className={cn(
                      "w-full text-left rounded-lg px-2.5 py-2 text-xs transition-colors",
                      currentNotebook?.id === nb.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold truncate">{nb.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteNotebook(nb.id); }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {nb.messages.length} messages · {new Date(nb.updatedAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Sources column ── */}
        <div className="space-y-4">
          <SectionCard title="Add source" icon={Plus}>
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
              />
              <Button className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
                {uploading ? "Uploading & analysing…" : "Upload Excel or PDF"}
              </Button>
              {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

              <div className="flex gap-2 items-center">
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">From</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">To</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>

              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pt-1">Live report sources</p>
              <div className="space-y-1.5">
                {LIVE_SOURCES.map((s) => (
                  <label
                    key={s.key}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border px-2.5 py-2 cursor-pointer transition-colors",
                      liveSelected.includes(s.key) ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/50",
                    )}
                  >
                    <input type="checkbox" className="mt-0.5 accent-[hsl(var(--primary))]" checked={liveSelected.includes(s.key)} onChange={() => toggleLive(s.key)} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Database className="size-3 text-info shrink-0" /> {s.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{s.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </SectionCard>

          {fileSources.length > 0 && (
            <SectionCard title={`Uploaded files (${fileSources.length})`} icon={FileSpreadsheet}>
              <div className="space-y-2">
                {fileSources.map((s) => (
                  <div key={s.id} className={cn("rounded-lg border px-2.5 py-2", includedIds.has(s.id) ? "border-primary/40 bg-primary/5" : "border-border")}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1 accent-[hsl(var(--primary))]" checked={includedIds.has(s.id)} onChange={() => toggleIncluded(s.id)} title="Include in chat" />
                      {s.kind === "excel" ? (
                        <FileSpreadsheet className="size-4 text-success shrink-0 mt-0.5" />
                      ) : (
                        <FileText className="size-4 text-destructive shrink-0 mt-0.5" />
                      )}
                      <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setExpandedSource(expandedSource === s.id ? null : s.id)}>
                        <p className="text-xs font-semibold text-foreground truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {s.kind === "excel" ? `${s.row_count} rows` : `${s.row_count} pages`} · {new Date(s.created_at).toLocaleDateString()}
                        </p>
                      </button>
                      <Button variant="ghost" size="icon" className="size-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteSource(s.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    {expandedSource === s.id && s.analysis && (
                      <div className="mt-2 max-h-72 overflow-y-auto rounded-md bg-muted/40 p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/90">
                        {s.analysis}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        {/* ── Chat column ── */}
        <Card className="flex flex-col min-h-[560px] max-h-[calc(100dvh-160px)]">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Bot className="size-5 text-primary" /> Notebook chat
              </span>
              <Badge variant="outline" className="text-[10px]">
                {liveSelected.length + includedIds.size} source{liveSelected.length + includedIds.size === 1 ? "" : "s"} · live data
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 pt-4">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-10 space-y-2">
                  <Sparkles className="size-6 mx-auto text-primary" />
                  <p>Ask anything about the selected sources — e.g. “Which route is losing money?” or “Summarise my uploaded file and compare it to system revenue.”</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60 border border-border text-foreground",
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {asking && (
                <div className="flex justify-start">
                  <div className="bg-muted/60 border border-border rounded-2xl px-3.5 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Fetching live sources and thinking…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-3 shrink-0">
              {["Give me a full business analysis of everything selected", "What is in my uploaded file? Compare it to system data", "Where are we losing money?", "Top 3 risks in this data"].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => ask(chip)}
                  disabled={asking}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>

            <form
              className="flex gap-2 pt-2 shrink-0"
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
            >
              <Input value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="Ask about the selected sources…" disabled={asking} />
              <Button type="submit" disabled={asking || !inputVal.trim()}>
                {asking ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
