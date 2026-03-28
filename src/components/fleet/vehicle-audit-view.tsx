"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, DollarSign, User, Search, Filter, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

interface VehicleAuditRecord {
  id: string;
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  mileage_at_deletion: number;
  sale_price: number | null;
  sold_to: string | null;
  sold_date: string | null;
  deletion_reason: string;
  deleted_by_name: string;
  deleted_at: string;
  previous_status: string;
  notes: string | null;
}

export function VehicleAuditView() {
  const [auditRecords, setAuditRecords] = useState<VehicleAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState<string>('all');

  useEffect(() => {
    const loadAuditRecords = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('vehicle_deletion_audit')
          .select('*')
          .order('deleted_at', { ascending: false });

        if (error) {
          console.error('Error loading audit records:', error);
          setAuditRecords([]);
        } else {
          setAuditRecords(data || []);
        }
      } catch (error) {
        console.error('Error loading audit records:', error);
        setAuditRecords([]);
      } finally {
        setLoading(false);
      }
    };

    loadAuditRecords();
  }, []);

  const filteredRecords = auditRecords.filter(record => {
    const matchesSearch = 
      record.vehicle_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.vehicle_make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.vehicle_model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.sold_to && record.sold_to.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesReason = reasonFilter === 'all' || record.deletion_reason === reasonFilter;
    
    return matchesSearch && matchesReason;
  });

  const exportToCSV = () => {
    const headers = [
      'Plate Number', 'Make', 'Model', 'Year', 'Mileage at Deletion',
      'Deletion Reason', 'Sold To', 'Sale Price', 'Sold Date', 'Deleted By', 'Deleted At', 'Notes'
    ];
    
    const csvData = filteredRecords.map(record => [
      record.vehicle_plate,
      record.vehicle_make,
      record.vehicle_model,
      record.vehicle_year,
      record.mileage_at_deletion,
      record.deletion_reason,
      record.sold_to || '',
      record.sale_price || '',
      record.sold_date ? format(new Date(record.sold_date), 'yyyy-MM-dd') : '',
      record.deleted_by_name,
      format(new Date(record.deleted_at), 'yyyy-MM-dd HH:mm'),
      record.notes || ''
    ]);

    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehicle-audit-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getReasonBadge = (reason: string) => {
    const variants = {
      sold: { variant: 'default' as const, icon: DollarSign, color: 'text-green-600' },
      decommissioned: { variant: 'secondary' as const, icon: CalendarDays, color: 'text-orange-600' },
      scrapped: { variant: 'destructive' as const, icon: Filter, color: 'text-red-600' }
    };
    
    const config = variants[reason as keyof typeof variants] || variants.decommissioned;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="size-3" />
        {reason.charAt(0).toUpperCase() + reason.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">Loading vehicle audit records...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Vehicle Disposition Audit</h2>
          <p className="text-muted-foreground">Track all sold, decommissioned, and scrapped vehicles</p>
        </div>
        <Button onClick={exportToCSV} className="flex items-center gap-2">
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Disposed</p>
                <p className="text-2xl font-bold">{auditRecords.length}</p>
              </div>
              <Filter className="size-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sold</p>
                <p className="text-2xl font-bold text-green-600">
                  {auditRecords.filter(r => r.deletion_reason === 'sold').length}
                </p>
              </div>
              <DollarSign className="size-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Decommissioned</p>
                <p className="text-2xl font-bold text-orange-600">
                  {auditRecords.filter(r => r.deletion_reason === 'decommissioned').length}
                </p>
              </div>
              <CalendarDays className="size-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  ${auditRecords
                    .filter(r => r.deletion_reason === 'sold' && r.sale_price)
                    .reduce((sum, r) => sum + (r.sale_price || 0), 0)
                    .toLocaleString()}
                </p>
              </div>
              <DollarSign className="size-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by plate, make, model, or buyer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="decommissioned">Decommissioned</SelectItem>
                <SelectItem value="scrapped">Scrapped</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Mileage</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Sale Info</TableHead>
                <TableHead>Processed By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No audit records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.vehicle_plate}</div>
                        <div className="text-sm text-muted-foreground">
                          {record.vehicle_make} {record.vehicle_model} ({record.vehicle_year})
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.mileage_at_deletion.toLocaleString()} km
                    </TableCell>
                    <TableCell>
                      {getReasonBadge(record.deletion_reason)}
                    </TableCell>
                    <TableCell>
                      {record.deletion_reason === 'sold' && record.sold_to ? (
                        <div>
                          <div className="flex items-center gap-1">
                            <User className="size-3" />
                            <span className="text-sm">{record.sold_to}</span>
                          </div>
                          {record.sale_price && (
                            <div className="text-sm text-green-600 font-medium">
                              ${record.sale_price.toLocaleString()}
                            </div>
                          )}
                          {record.sold_date && (
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(record.sold_date), 'MMM d, yyyy')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{record.deleted_by_name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(record.deleted_at), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(record.deleted_at), 'h:mm a')}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
