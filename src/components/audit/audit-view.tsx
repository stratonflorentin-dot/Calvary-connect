"use client";

import { useEffect, useState } from "react";
import { AuditService } from "@/services/audit-service";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, FileText, Trash2, UserPlus, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data: any;
  new_data: any;
  change_summary: string;
  created_at: string;
}

export function AuditView() {
  const { role, isLoading } = useRole();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterTable, setFilterTable] = useState<string>("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    if (role === "CEO" || role === "ADMIN") {
      fetchLogs();
    }
  }, [role]);

  useEffect(() => {
    let filtered = logs;
    if (filterAction !== "all") {
      filtered = filtered.filter((log) => log.action === filterAction);
    }
    if (filterTable !== "all") {
      filtered = filtered.filter((log) => log.table_name === filterTable);
    }
    setFilteredLogs(filtered);
  }, [logs, filterAction, filterTable]);

  const fetchLogs = async () => {
    const data = await AuditService.getLogs({ limit: 100 });
    setLogs(data);
  };

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (role !== "CEO" && role !== "ADMIN") return <div className="p-8">Access Denied</div>;

  const getActionIcon = (action: string) => {
    switch (action) {
      case "CREATE":
        return <UserPlus className="size-4 text-emerald-500" />;
      case "UPDATE":
        return <FileText className="size-4 text-blue-500" />;
      case "DELETE":
        return <Trash2 className="size-4 text-red-500" />;
      default:
        return <AlertCircle className="size-4 text-gray-500" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "CREATE":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            <CheckCircle className="size-3 mr-1" />
            Created
          </Badge>
        );
      case "UPDATE":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <FileText className="size-3 mr-1" />
            Updated
          </Badge>
        );
      case "DELETE":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <Trash2 className="size-3 mr-1" />
            Deleted
          </Badge>
        );
      default:
        return <Badge>{action}</Badge>;
    }
  };

  const uniqueTables = [...new Set(logs.map((log) => log.table_name))];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-headline">Audit Log</h2>
        <Button onClick={fetchLogs} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filter Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">Action</label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger>
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="CREATE">Created</SelectItem>
                  <SelectItem value="UPDATE">Updated</SelectItem>
                  <SelectItem value="DELETE">Deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">Table</label>
              <Select value={filterTable} onValueChange={setFilterTable}>
                <SelectTrigger>
                  <SelectValue placeholder="All Tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {uniqueTables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Recent Activity ({filteredLogs.length} entries)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <>
                  <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(log.created_at), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{log.user_name}</div>
                      <div className="text-xs text-muted-foreground">{log.user_role}</div>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.table_name}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{log.change_summary}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                      >
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedLog === log.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30">
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            {log.old_data && (
                              <div>
                                <h4 className="font-semibold text-red-600 mb-2">Previous Data</h4>
                                <pre className="text-xs bg-red-50 p-3 rounded overflow-auto max-h-40">
                                  {JSON.stringify(log.old_data, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.new_data && (
                              <div>
                                <h4 className="font-semibold text-emerald-600 mb-2">New Data</h4>
                                <pre className="text-xs bg-emerald-50 p-3 rounded overflow-auto max-h-40">
                                  {JSON.stringify(log.new_data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Record ID: {log.record_id} | User ID: {log.user_id}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No audit logs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
