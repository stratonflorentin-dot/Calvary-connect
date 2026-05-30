"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { AuditService } from '@/services/audit-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, Filter, ArrowUpDown, ChevronRight, User, Database, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function AuditTrailPage() {
  const { role } = useRole();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tableFilter, setTableFilter] = useState('all');

  useEffect(() => {
    loadLogs();
  }, [tableFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await AuditService.getLogs({
        tableName: tableFilter !== 'all' ? tableFilter : undefined,
        limit: 100
      });
      setLogs(data);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.user_name?.toLowerCase().includes(search.toLowerCase()) ||
    log.change_summary?.toLowerCase().includes(search.toLowerCase()) ||
    log.table_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case 'CREATE': return <Badge className="bg-green-100 text-green-800">CREATE</Badge>;
      case 'UPDATE': return <Badge className="bg-blue-100 text-blue-800">UPDATE</Badge>;
      case 'DELETE': return <Badge className="bg-red-100 text-red-800">DELETE</Badge>;
      default: return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getTableIcon = (tableName: string) => {
    switch (tableName) {
      case 'trips': return <History className="w-4 h-4 mr-2 text-indigo-500" />;
      case 'expenses':
      case 'sales':
      case 'invoices': return <Database className="w-4 h-4 mr-2 text-emerald-500" />;
      default: return <Clock className="w-4 h-4 mr-2 text-slate-500" />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 md:pl-72 text-slate-900 dark:text-slate-100">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                Financial Audit Trail
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Trace every interaction and financial activity across the organization
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <Input 
                  placeholder="Search logs..." 
                  className="pl-10 w-64 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 focus-visible:ring-indigo-500 rounded-xl shadow-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 rounded-xl shadow-sm">
                  <Filter className="w-4 h-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Filter by module" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
                  <SelectItem value="all">All Modules</SelectItem>
                  <SelectItem value="trips">Logistics (Trips)</SelectItem>
                  <SelectItem value="sales">Revenue (Sales)</SelectItem>
                  <SelectItem value="expenses">Costs (Expenses)</SelectItem>
                  <SelectItem value="invoices">Finance (Invoices)</SelectItem>
                  <SelectItem value="vehicles">Fleet (Vehicles)</SelectItem>
                  <SelectItem value="allowances">HR (Allowances)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-0 pt-6">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-50">Activity Log</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800">
                      <TableHead className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[11px]">Timestamp</TableHead>
                      <TableHead className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[11px]">User</TableHead>
                      <TableHead className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[11px]">Action</TableHead>
                      <TableHead className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[11px]">Module</TableHead>
                      <TableHead className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[11px]">Summary</TableHead>
                      <TableHead className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[11px] text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-3 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Loading audit trail pipeline...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm font-medium">
                          No audit activity logs found matching your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => (
                        <TableRow 
                          key={log.id} 
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800 transition-colors"
                        >
                          <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                            {log.created_at ? format(new Date(log.created_at), 'MMM d, HH:mm:ss') : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center mr-3 shrink-0">
                                <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm">
                                  {log.user_name || 'System / Auto-Agent'}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                                  {log.user_role || 'ADMIN'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{getActionBadge(log.action)}</TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                              {getTableIcon(log.table_name)}
                              <span className="capitalize">{log.table_name || 'unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <span className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-medium line-clamp-2 leading-relaxed">
                              {log.change_summary || `Updated records in ${log.table_name || 'system'}`}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
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