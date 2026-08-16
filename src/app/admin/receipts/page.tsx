"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/hooks/use-role";
import { toast } from "@/hooks/use-toast";
import { PageShell, PageHeader } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listReceiptFilesAction, deleteReceiptFileAction, type StorageFileEntry } from "@/app/storage/actions";
import { FileText, Trash2, RefreshCw, HardDrive, Search, ExternalLink } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const BUCKET_LABELS: Record<string, string> = {
  documents: "Documents (PODs, etc.)",
  "vehicle-documents": "Vehicle Documents (insurance, receipts)",
  "compliance-docs": "Compliance Docs",
};

export default function ReceiptsStorageManagerPage() {
  const { role, isLoading: roleLoading } = useRole();
  const [files, setFiles] = useState<StorageFileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [bucketFilter, setBucketFilter] = useState("all");
  const [search, setSearch] = useState("");

  const canManage = !roleLoading && ["CEO", "ADMIN"].includes(role ?? "");

  const load = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const result = await listReceiptFilesAction(session.access_token);
      if (result.error) throw new Error(result.error);
      setFiles(result.files || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to load files", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!roleLoading && canManage) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, canManage]);

  const handleDelete = async (file: StorageFileEntry) => {
    if (!window.confirm(`Delete "${file.name}"? This can't be undone.`)) return;
    setDeletingPath(`${file.bucket}/${file.path}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const result = await deleteReceiptFileAction(session.access_token, file.bucket, file.path);
      if (result.error) throw new Error(result.error);
      setFiles((prev) => prev.filter((f) => !(f.bucket === file.bucket && f.path === file.path)));
      toast({ variant: "success", title: "File deleted", description: file.name });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeletingPath(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((f) => {
      if (bucketFilter !== "all" && f.bucket !== bucketFilter) return false;
      if (q && !f.name.toLowerCase().includes(q) && !f.path.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [files, bucketFilter, search]);

  const totalBytes = files.reduce((s, f) => s + f.sizeBytes, 0);
  const bucketTotals = useMemo(() => {
    const map = new Map<string, { count: number; bytes: number }>();
    for (const f of files) {
      const cur = map.get(f.bucket) ?? { count: 0, bytes: 0 };
      cur.count += 1;
      cur.bytes += f.sizeBytes;
      map.set(f.bucket, cur);
    }
    return map;
  }, [files]);

  if (roleLoading) return null;
  if (!canManage) {
    return (
      <PageShell>
        <PageHeader eyebrow="Admin" title="Receipts & Document Storage" icon={FileText} />
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Only CEO/ADMIN can manage uploaded documents.
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Admin"
        title="Receipts & Document Storage"
        subtitle="Every uploaded receipt, POD, insurance, and compliance document — delete what you no longer need"
        icon={FileText}
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "size-4 mr-2 animate-spin" : "size-4 mr-2"} /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><HardDrive className="size-3.5" /> Total Storage Used</p>
            <p className="text-2xl font-bold mt-1">{formatBytes(totalBytes)}</p>
          </CardContent>
        </Card>
        {[...bucketTotals.entries()].map(([bucket, stat]) => (
          <Card key={bucket}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium truncate">{BUCKET_LABELS[bucket] ?? bucket}</p>
              <p className="text-xl font-bold mt-1">{formatBytes(stat.bytes)}</p>
              <p className="text-[10px] text-muted-foreground">{stat.count} file{stat.count === 1 ? "" : "s"}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search by file name…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={bucketFilter} onValueChange={setBucketFilter}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All buckets</SelectItem>
              {Object.keys(BUCKET_LABELS).map((b) => (
                <SelectItem key={b} value={b}>{BUCKET_LABELS[b]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Bucket / Folder</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No files found.</TableCell></TableRow>
              ) : (
                filtered.map((f) => (
                  <TableRow key={`${f.bucket}/${f.path}`}>
                    <TableCell className="font-medium max-w-xs truncate">{f.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.bucket}/{f.path.split("/").slice(0, -1).join("/")}</TableCell>
                    <TableCell className="text-right text-sm">{formatBytes(f.sizeBytes)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {f.updatedAt ? new Date(f.updatedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <a href={f.url} target="_blank" rel="noreferrer" title="Open">
                          <Button variant="ghost" size="sm"><ExternalLink className="size-3.5" /></Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(f)}
                          disabled={deletingPath === `${f.bucket}/${f.path}`}
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageShell>
  );
}
