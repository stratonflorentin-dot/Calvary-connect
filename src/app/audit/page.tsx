"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { AuditService } from '@/services/audit-service';
import { AuditTrailService } from '@/services/audit-trail-service';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, Filter, ArrowUpDown, ChevronRight, User, Database, Clock, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const CAN_CLEAR_ROLES = ['CEO', 'ADMIN'];

export default function AuditTrailPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const effectiveRole = role || 'ADMIN';
  const canClear = CAN_CLEAR_ROLES.includes(String(role || '').toUpperCase());
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [search, setSearch] = useState('');
  const [tableFilter, setTableFilter] = useState('all');
  // audit_logs (AuditService, financial/CRUD trail) and audit_trail
  // (AuditTrailService, general workflow trail — create/approve/reject/
  // convert/verify) are two separate tables with incompatible write
  // shapes (audit_logs' RPC requires a resolved user name+role that
  // audit_trail's ~15 call sites don't have), so this reads and displays
  // both — normalized into the same row shape below — rather than
  // migrating audit_trail's writes into audit_logs. audit_trail's rows
  // were previously written but never shown anywhere in the UI.
  const [source, setSource] = useState<'audit_logs' | 'audit_trail'>('audit_logs');

  useEffect(() => {
    loadLogs();
  }, [tableFilter, source]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      if (source === 'audit_logs') {
        const data = await AuditService.getLogs({
          tableName: tableFilter !== 'all' ? tableFilter : undefined,
          limit: 100
        });
        setLogs(data);
      } else {
        const data = await AuditTrailService.getRecentLogs(100);
        const normalized = data
          .filter((row) => tableFilter === 'all' || row.entity_type === tableFilter)
          .map((row) => ({
            id: row.id,
            created_at: row.timestamp,
            user_name: row.user_id ? `User ${String(row.user_id).slice(0, 8)}` : 'System / Auto-Agent',
            user_role: null,
            action: String(row.action || '').toUpperCase(),
            table_name: row.entity_type,
            change_summary: row.description,
          }));
        setLogs(normalized);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearAuditTrail = async () => {
    if (logs.length === 0) return;
    const confirmed = window.confirm(
      `Permanently delete all financial audit trail records? This is a full clear with no export step — the activity history will be gone, not archived. This cannot be undone.`,
    );
    if (!confirmed) return;
    setClearing(true);
    try {
      const { error, count } = await supabase.from('audit_logs').delete({ count: 'exact' }).not('id', 'is', null);
      if (error) throw error;
      // A missing RLS delete policy doesn't error here — Postgres/PostgREST
      // just matches zero rows and reports a clean success, so trusting
      // `error === null` alone previously showed "cleared" even when
      // nothing was actually deleted (the 098 migration hadn't run yet).
      if (!count) {
        toast({
          title: 'Nothing was deleted',
          description: `The delete ran without an error but matched 0 of ${logs.length} record(s) — migration 098_audit_logs_clear.sql likely hasn't been applied in Supabase yet.`,
          variant: 'destructive',
        });
        return;
      }
      // Recorded in the separate audit_trail table (untouched by this
      // action) so there's still a trace of who cleared the log, even
      // though the log itself is now empty.
      await AuditTrailService.log({
        user_id: user?.id,
        module: 'management',
        action: 'delete',
        entity_type: 'payment' as any,
        entity_id: 'audit_logs',
        description: `Cleared the Financial Audit Trail (${count} record(s) deleted)`,
      });
      toast({ variant: 'success', title: 'Audit trail cleared', description: `${count} record(s) deleted.` });
      loadLogs();
    } catch (err: any) {
      toast({ title: "Couldn't clear audit trail", description: err.message, variant: 'destructive' });
    } finally {
      setClearing(false);
    }
  };

  const filteredLogs = logs.filter(log =>
    log.user_name?.toLowerCase().includes(search.toLowerCase()) ||
    log.change_summary?.toLowerCase().includes(search.toLowerCase()) ||
    log.table_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case 'CREATE': return <Badge className="bg-success/10 text-success">CREATE</Badge>;
      case 'UPDATE': return <Badge className="bg-info/10 text-info">UPDATE</Badge>;
      case 'DELETE': return <Badge className="bg-destructive/10 text-destructive">DELETE</Badge>;
      default: return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getTableIcon = (tableName: string) => {
    switch (tableName) {
      case 'trips': return <History className="w-4 h-4 mr-2 text-primary" />;
      case 'expenses':
      case 'sales':
      case 'invoices': return <Database className="w-4 h-4 mr-2 text-success" />;
      default: return <Clock className="w-4 h-4 mr-2 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex h-screen bg-background transition-colors duration-300">
      <Sidebar role={effectiveRole} />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 md:pl-72 text-foreground">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                Financial Audit Trail
              </h1>
              <p className="text-muted-foreground mt-1">
                Trace every interaction and financial activity across the organization
              </p>
              <div className="flex gap-1 mt-3 bg-muted/50 rounded-xl p-1 w-fit">
                <button
                  onClick={() => setSource('audit_logs')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${source === 'audit_logs' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Financial (audit_logs)
                </button>
                <button
                  onClick={() => setSource('audit_trail')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${source === 'audit_trail' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  System (audit_trail)
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  className="pl-10 w-64 bg-card border-border text-foreground focus-visible:ring-primary rounded-xl shadow-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-48 bg-card border-border text-foreground rounded-xl shadow-sm">
                  <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filter by module" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All Modules</SelectItem>
                  <SelectItem value="trips">Logistics (Trips)</SelectItem>
                  <SelectItem value="sales">Revenue (Sales)</SelectItem>
                  <SelectItem value="expenses">Costs (Expenses)</SelectItem>
                  <SelectItem value="invoices">Finance (Invoices)</SelectItem>
                  <SelectItem value="vehicles">Fleet (Vehicles)</SelectItem>
                  <SelectItem value="allowances">HR (Allowances)</SelectItem>
                </SelectContent>
              </Select>
              {canClear && source === 'audit_logs' && (
                <Button
                  variant="outline"
                  onClick={clearAuditTrail}
                  disabled={clearing || logs.length === 0}
                  className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 rounded-xl"
                >
                  {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Clear audit trail
                </Button>
              )}
            </div>
          </div>

          <Card className="border border-border bg-card shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-0 pt-6">
              <CardTitle className="text-lg font-bold text-foreground">Activity Log</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="rounded-xl border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 border-border">
                      <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Timestamp</TableHead>
                      <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">User</TableHead>
                      <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Action</TableHead>
                      <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Module</TableHead>
                      <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Summary</TableHead>
                      <TableHead className="font-bold text-muted-foreground uppercase tracking-wider text-[11px] text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm font-semibold text-muted-foreground">Loading audit trail pipeline...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm font-medium">
                          No audit activity logs found matching your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => (
                        <TableRow
                          key={log.id}
                          className="hover:bg-muted/50 border-border transition-colors"
                        >
                          <TableCell className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                            {log.created_at ? format(new Date(log.created_at), 'MMM d, HH:mm:ss') : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3 shrink-0">
                                <User className="w-4 h-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground truncate text-sm">
                                  {log.user_name || 'System / Auto-Agent'}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                  {log.user_role || 'ADMIN'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{getActionBadge(log.action)}</TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm font-semibold text-muted-foreground">
                              {getTableIcon(log.table_name)}
                              <span className="capitalize">{log.table_name || 'unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <span className="text-xs md:text-sm text-muted-foreground font-medium line-clamp-2 leading-relaxed">
                              {log.change_summary || `Updated records in ${log.table_name || 'system'}`}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
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
