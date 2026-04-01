"use client";

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wrench, FileText, Shield, Calendar, Milestone, History, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface VehicleDetailsDialogProps {
  vehicle: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: string;
}

export function VehicleDetailsDialog({ vehicle, open, onOpenChange, role }: VehicleDetailsDialogProps) {
  const { user } = useSupabase();
  const [serviceRecords, setServiceRecords] = useState<any[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<any[]>([]);
  const [insuranceDocs, setInsuranceDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const isAdminOrMechanic = role === 'ADMIN' || role === 'MECHANIC' || role === 'CEO';

  useEffect(() => {
    if (!open || !vehicle?.id) return;
    
    const loadVehicleData = async () => {
      try {
        setLoading(true);
        
        // Load service records
        const { data: services } = await supabase
          .from('vehicle_service_records')
          .select('*')
          .eq('vehicle_id', vehicle.id)
          .order('service_date', { ascending: false });
        
        // Load maintenance requests
        const { data: maintenance } = await supabase
          .from('maintenance_requests')
          .select('*')
          .eq('vehicle_id', vehicle.id)
          .order('created_at', { ascending: false });
        
        // Load insurance documents
        const { data: insurance } = await supabase
          .from('vehicle_documents')
          .select('*')
          .eq('vehicle_id', vehicle.id)
          .eq('document_type', 'insurance')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        
        setServiceRecords(services || []);
        setMaintenanceRequests(maintenance || []);
        setInsuranceDocs(insurance || []);
      } catch (error) {
        console.error('Error loading vehicle details:', error);
      } finally {
        setLoading(false);
      }
    };

    loadVehicleData();
  }, [open, vehicle?.id]);

  if (!vehicle) return null;

  const lastService = serviceRecords[0];
  const nextServiceDue = vehicle.next_service_date 
    ? new Date(vehicle.next_service_date) 
    : null;
  const isOverdue = nextServiceDue && nextServiceDue < new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="font-bold">{vehicle.plate_number}</span>
            <span className="text-muted-foreground">-</span>
            <span className="text-lg">{vehicle.make} {vehicle.model}</span>
            <Badge className={vehicle.status === 'active' ? 'bg-green-500' : vehicle.status === 'maintenance' ? 'bg-yellow-500' : 'bg-gray-500'}>
              {vehicle.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="service">Service History</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            {isAdminOrMechanic && (
              <TabsTrigger value="insurance">Insurance</TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Milestone className="size-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Current Mileage</span>
                  </div>
                  <p className="text-2xl font-bold">{vehicle.mileage?.toLocaleString() || '0'} km</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <History className="size-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Last Service</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {lastService ? format(new Date(lastService.service_date), 'MMM d, yyyy') : 'N/A'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Next Service</span>
                  </div>
                  <p className={`text-2xl font-bold ${isOverdue ? 'text-red-600' : ''}`}>
                    {nextServiceDue ? format(nextServiceDue, 'MMM d, yyyy') : 'N/A'}
                  </p>
                  {isOverdue && (
                    <p className="text-xs text-red-600 mt-1">Overdue!</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Service Records</span>
                  </div>
                  <p className="text-2xl font-bold">{serviceRecords.length}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Vehicle Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Plate Number</p>
                  <p className="font-medium">{vehicle.plate_number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Make & Model</p>
                  <p className="font-medium">{vehicle.make} {vehicle.model}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Year</p>
                  <p className="font-medium">{vehicle.year}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{vehicle.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fuel Type</p>
                  <p className="font-medium capitalize">{vehicle.fuel_type || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fuel Capacity</p>
                  <p className="font-medium">{vehicle.fuel_capacity ? `${vehicle.fuel_capacity} L` : 'N/A'}</p>
                </div>
              </CardContent>
            </Card>

            {lastService && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wrench className="size-4" />
                    Last Service Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Service Type</p>
                      <p className="font-medium">{lastService.service_type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Mileage at Service</p>
                      <p className="font-medium">{lastService.mileage_at_service?.toLocaleString() || 'N/A'} km</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Cost</p>
                      <p className="font-medium">${lastService.total_cost?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Description</p>
                    <p className="text-sm">{lastService.service_description}</p>
                  </div>
                  {lastService.next_service_mileage && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle className="size-4 text-blue-500" />
                      <span>Next service due at {lastService.next_service_mileage.toLocaleString()} km</span>
                    </div>
                  )}
                  {lastService.next_service_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="size-4 text-blue-500" />
                      <span>Next service due on {format(new Date(lastService.next_service_date), 'MMMM d, yyyy')}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Service History Tab */}
          <TabsContent value="service" className="space-y-4">
            {serviceRecords.length === 0 ? (
              <div className="text-center py-8">
                <Wrench className="size-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No service records found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {serviceRecords.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Wrench className="size-4 text-blue-500" />
                            <span className="font-medium">{record.service_type}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{record.service_description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{format(new Date(record.service_date), 'MMM d, yyyy')}</span>
                            <span>{record.mileage_at_service?.toLocaleString()} km</span>
                            <span className="font-medium text-foreground">${record.total_cost?.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          {record.next_service_date && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Next: </span>
                              <span>{format(new Date(record.next_service_date), 'MMM d, yyyy')}</span>
                            </div>
                          )}
                          {record.next_service_mileage && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">At: </span>
                              <span>{record.next_service_mileage.toLocaleString()} km</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance" className="space-y-4">
            {maintenanceRequests.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="size-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No maintenance requests found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {maintenanceRequests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {request.status === 'completed' ? (
                              <CheckCircle2 className="size-4 text-green-500" />
                            ) : request.status === 'in_progress' ? (
                              <Clock className="size-4 text-blue-500" />
                            ) : (
                              <AlertCircle className="size-4 text-yellow-500" />
                            )}
                            <span className="font-medium">{request.description}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{format(new Date(request.created_at), 'MMM d, yyyy')}</span>
                            <Badge className={
                              request.priority === 'critical' ? 'bg-red-500' :
                              request.priority === 'high' ? 'bg-orange-500' :
                              request.priority === 'medium' ? 'bg-yellow-500' :
                              'bg-blue-500'
                            }>
                              {request.priority}
                            </Badge>
                          </div>
                        </div>
                        <Badge className={
                          request.status === 'completed' ? 'bg-green-500' :
                          request.status === 'in_progress' ? 'bg-blue-500' :
                          request.status === 'pending' ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }>
                          {request.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Insurance Tab */}
          {isAdminOrMechanic && (
            <TabsContent value="insurance" className="space-y-4">
              {insuranceDocs.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="size-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">No insurance documents found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {insuranceDocs.map((doc) => (
                    <Card key={doc.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Shield className="size-4 text-emerald-500" />
                              <span className="font-medium">{doc.document_name}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {doc.insurance_type?.replace('_', ' ')} - {doc.insurance_company}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Policy: {doc.policy_number}</span>
                              {doc.expiry_date && (
                                <span className={new Date(doc.expiry_date) < new Date() ? 'text-red-600' : 'text-emerald-600'}>
                                  Expires: {format(new Date(doc.expiry_date), 'MMM d, yyyy')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(doc.file_url, '_blank')}
                            >
                              <FileText className="size-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
