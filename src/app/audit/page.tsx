"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { AuditService } from '@/services/audit-service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Financial Audit Trail</h1>
              <p className="text-slate-500">Trace every interaction and financial activity across the organization</p>
            </div>
            <div className="flex gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Search logs..." 
                  className="pl-10 w-64 bg-white"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-48 bg-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by module" />
                </SelectTrigger>
                <SelectContent>
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

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="text-lg font-medium">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-slate-500">Loading audit trail...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                        No activity found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="text-sm text-slate-500">
                          {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center mr-2">
                              <User className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{log.user_name}</div>
                              <div className="text-xs text-slate-500 uppercase">{log.user_role}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                          <div className="flex items-center text-slate-600">
                            {getTableIcon(log.table_name)}
                            <span className="capitalize">{log.table_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <span className="text-slate-700">{log.change_summary}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}