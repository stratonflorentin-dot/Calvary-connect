
"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Wrench, Route, History, Plus, CalendarDays, FileText, Shield, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function TruckHistoryPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [fleet, setFleet] = useState<any[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<any[]>([]);
  const [serviceRecords, setServiceRecords] = useState<any[]>([]);
  const [insuranceDocuments, setInsuranceDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Service record form state
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    serviceType: '',
    serviceDescription: '',
    partsUsed: '',
    laborHours: '',
    laborCost: '',
    partsCost: '',
    mileageAtService: '',
    nextServiceDate: '',
    nextServiceMileage: '',
    notes: ''
  });
  
  // Insurance upload state
  const [insuranceDialogOpen, setInsuranceDialogOpen] = useState(false);
  const [insuranceForm, setInsuranceForm] = useState({
    documentName: '',
    insuranceType: 'motor_vehicle',
    insuranceCompany: '',
    policyNumber: '',
    expiryDate: '',
    file: null as File | null
  });
  const [uploadingInsurance, setUploadingInsurance] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Load real fleet data from Supabase
        const { data: vehicles, error: vehiclesError } = await supabase
          .from('vehicles')
          .select('*')
          .order('plate_number');
        
        if (vehiclesError) throw vehiclesError;
        
        // Load real maintenance history from Supabase
        const { data: maintenance, error: maintenanceError } = await supabase
          .from('maintenance_requests')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (maintenanceError) throw maintenanceError;
        
        // Load service records
        const { data: services, error: servicesError } = await supabase
          .from('vehicle_service_records')
          .select('*')
          .order('service_date', { ascending: false });
        
        if (servicesError) throw servicesError;
        
        // Load insurance documents
        const { data: insuranceDocs, error: insuranceError } = await supabase
          .from('vehicle_documents')
          .select('*')
          .eq('document_type', 'insurance')
          .order('created_at', { ascending: false });
        
        if (insuranceError) throw insuranceError;
        
        setFleet(vehicles || []);
        setMaintenanceHistory(maintenance || []);
        setServiceRecords(services || []);
        setInsuranceDocuments(insuranceDocs || []);
      } catch (error) {
        console.error('Error loading truck history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const selectedVehicle = fleet?.find(v => v.id === selectedVehicleId);
  const vehicleServices = serviceRecords?.filter(s => s.vehicle_id === selectedVehicleId);
  const vehicleInsuranceDocs = insuranceDocuments?.filter(d => d.vehicle_id === selectedVehicleId);
  const isMechanic = role === 'MECHANIC' || role === 'CEO' || role === 'ADMIN';
  const canUploadDocs = role === 'DRIVER' || role === 'ADMIN' || role === 'CEO' || role === 'OPERATOR';

  const handleAddServiceRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId || !user) return;
    
    try {
      const totalCost = (parseFloat(serviceForm.laborCost) || 0) + (parseFloat(serviceForm.partsCost) || 0);
      
      const { error } = await supabase
        .from('vehicle_service_records')
        .insert({
          vehicle_id: selectedVehicleId,
          mechanic_id: user.id,
          service_type: serviceForm.serviceType,
          service_description: serviceForm.serviceDescription,
          parts_used: serviceForm.partsUsed,
          labor_hours: parseFloat(serviceForm.laborHours) || 0,
          labor_cost: parseFloat(serviceForm.laborCost) || 0,
          parts_cost: parseFloat(serviceForm.partsCost) || 0,
          total_cost: totalCost,
          mileage_at_service: parseInt(serviceForm.mileageAtService) || 0,
          next_service_date: serviceForm.nextServiceDate || null,
          next_service_mileage: parseInt(serviceForm.nextServiceMileage) || 0,
          notes: serviceForm.notes,
          service_date: new Date().toISOString()
        });
        
      if (error) throw error;
      
      // Refresh service records
      const { data: refreshedServices } = await supabase
        .from('vehicle_service_records')
        .select('*')
        .order('service_date', { ascending: false });
      setServiceRecords(refreshedServices || []);
      
      toast({ title: "Service Record Added", description: "Service has been logged successfully" });
      setServiceDialogOpen(false);
      setServiceForm({
        serviceType: '',
        serviceDescription: '',
        partsUsed: '',
        laborHours: '',
        laborCost: '',
        partsCost: '',
        mileageAtService: '',
        nextServiceDate: '',
        nextServiceMileage: '',
        notes: ''
      });
    } catch (error: any) {
      console.error('Error adding service record:', error);
      toast({ title: "Error", description: "Failed to add service record", variant: "destructive" });
    }
  };

  const handleUploadInsurance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId || !user || !insuranceForm.file) return;
    
    try {
      setUploadingInsurance(true);
      
      // Upload file to Supabase Storage
      const fileExt = insuranceForm.file.name.split('.').pop();
      const fileName = `${selectedVehicleId}_${Date.now()}.${fileExt}`;
      const filePath = `insurance/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('vehicle-documents')
        .upload(filePath, insuranceForm.file, { upsert: true });
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('vehicle-documents')
        .getPublicUrl(filePath);
      
      // Save document record to database
      const { error: dbError } = await supabase
        .from('vehicle_documents')
        .insert({
          vehicle_id: selectedVehicleId,
          uploaded_by: user.id,
          document_type: 'insurance',
          document_name: insuranceForm.documentName,
          insurance_type: insuranceForm.insuranceType,
          insurance_company: insuranceForm.insuranceCompany,
          policy_number: insuranceForm.policyNumber,
          expiry_date: insuranceForm.expiryDate || null,
          file_url: publicUrl,
          file_path: filePath,
          status: 'active',
          created_at: new Date().toISOString()
        });
        
      if (dbError) throw dbError;
      
      // Refresh insurance documents
      const { data: refreshedDocs } = await supabase
        .from('vehicle_documents')
        .select('*')
        .eq('document_type', 'insurance')
        .order('created_at', { ascending: false });
      setInsuranceDocuments(refreshedDocs || []);
      
      toast({ title: "Insurance Document Uploaded", description: "Document has been uploaded successfully" });
      setInsuranceDialogOpen(false);
      setInsuranceForm({
        documentName: '',
        insuranceType: 'motor_vehicle',
        insuranceCompany: '',
        policyNumber: '',
        expiryDate: '',
        file: null
      });
    } catch (error: any) {
      console.error('Error uploading insurance document:', error);
      toast({ title: "Error", description: "Failed to upload insurance document", variant: "destructive" });
    } finally {
      setUploadingInsurance(false);
    }
  };

  if (!['CEO', 'ADMIN', 'OPERATOR', 'MECHANIC'].includes(role || '')) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">Truck Lifecycle History</h1>
            <p className="text-muted-foreground text-sm font-sans">Audit maintenance logs and trip history per asset.</p>
          </div>
          
          <div className="w-full md:w-64">
            <Select onValueChange={(val) => setSelectedVehicleId(val)}>
              <SelectTrigger className="bg-white rounded-xl shadow-sm border-none h-12">
                <SelectValue placeholder="Select a Vehicle" />
              </SelectTrigger>
              <SelectContent>
                {fleet?.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name} ({v.plateNumber})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {!selectedVehicleId ? (
          <div className="h-96 flex flex-col items-center justify-center text-center space-y-4 bg-muted/20 rounded-3xl border border-dashed">
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <History className="size-10" />
            </div>
            <div>
              <p className="font-headline text-lg">No Vehicle Selected</p>
              <p className="text-sm text-muted-foreground">Choose a truck from the dropdown to view its full operational history.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Sidebar Stats */}
            <div className="space-y-6">
              <Card className="rounded-3xl border-none shadow-sm bg-primary text-white">
                <CardHeader>
                  <CardTitle className="text-sm uppercase tracking-widest opacity-70">Asset Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-headline">{selectedVehicle?.name}</h2>
                    <p className="font-mono text-sm opacity-80">{selectedVehicle?.plateNumber}</p>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="text-xs">Current Condition</span>
                    <Badge className="bg-white text-primary font-bold">{selectedVehicle?.condition}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Operational Status</span>
                    <Badge variant="outline" className="border-white text-white">{selectedVehicle?.status}</Badge>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card className="rounded-2xl border-none shadow-sm bg-white p-4">
                  <Wrench className="size-5 text-primary mb-2" />
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Services</p>
                  <p className="text-2xl font-headline">{vehicleServices?.length || 0}</p>
                </Card>
                <Card className="rounded-2xl border-none shadow-sm bg-white p-4">
                  <Route className="size-5 text-emerald-500 mb-2" />
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Trips Done</p>
                  <p className="text-2xl font-headline">0</p>
                </Card>
              </div>
              
              {isMechanic && (
                <Button 
                  onClick={() => setServiceDialogOpen(true)}
                  className="w-full gap-2"
                >
                  <Plus className="size-4" />
                  Log Service Record
                </Button>
              )}
            </div>

            {/* Main Timeline */}
            <div className="xl:col-span-2 space-y-6">
              <h2 className="text-xl font-headline flex items-center gap-2">
                <History className="size-5 text-primary" /> Operational Timeline
              </h2>

              <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                {/* Combined Logs Sorted by Date (Simplified implementation: Maintenance followed by Trips) */}
                <div className="space-y-8">
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground ml-12 md:text-center md:ml-0">Service Records</h3>
                      {isMechanic && (
                        <Button size="sm" onClick={() => setServiceDialogOpen(true)} className="gap-1">
                          <Plus className="size-3" />
                          Add Record
                        </Button>
                      )}
                    </div>
                    {vehicleServices?.length > 0 ? (
                      vehicleServices.map((service) => (
                        <TimelineItem 
                          key={service.id}
                          type="service"
                          title={service.service_type}
                          date={new Date(service.service_date).toLocaleDateString()}
                          description={service.service_description}
                          tag={`$${service.total_cost || 0}`}
                          icon={<Wrench className="size-4" />}
                          color="blue"
                        />
                      ))
                    ) : (
                      <p className="text-center text-xs text-muted-foreground italic">No service records found.</p>
                    )}
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground ml-12 md:text-center md:ml-0">Maintenance Logs</h3>
                    {maintenanceHistory?.filter(m => m.vehicle_id === selectedVehicleId).map((log) => (
                      <TimelineItem 
                        key={log.id}
                        type="maintenance"
                        title="Service Request"
                        date={new Date(log.created_at).toLocaleDateString()}
                        description={log.description}
                        tag={log.status}
                        icon={<Wrench className="size-4" />}
                        color="primary"
                      />
                    ))}
                    {maintenanceHistory?.filter(m => m.vehicle_id === selectedVehicleId).length === 0 && (
                      <p className="text-center text-xs text-muted-foreground italic">No maintenance logs found.</p>
                    )}
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground ml-12 md:text-center md:ml-0">Insurance Documents</h3>
                      {canUploadDocs && (
                        <Button 
                          size="sm" 
                          onClick={() => setInsuranceDialogOpen(true)}
                          className="gap-1"
                        >
                          <Upload className="size-3" />
                          Upload Insurance
                        </Button>
                      )}
                    </div>
                    {vehicleInsuranceDocs?.length > 0 ? (
                      vehicleInsuranceDocs.map((doc) => (
                        <TimelineItem 
                          key={doc.id}
                          type="insurance"
                          title={doc.document_name || 'Insurance Document'}
                          date={new Date(doc.created_at).toLocaleDateString()}
                          description={`${doc.insurance_type || 'Motor Vehicle'} - ${doc.insurance_company || 'Unknown Provider'}`}
                          tag={doc.status || 'Active'}
                          icon={<Shield className="size-4" />}
                          color="emerald"
                        />
                      ))
                    ) : (
                      <p className="text-center text-xs text-muted-foreground italic">No insurance documents found.</p>
                    )}
                  </section>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Service Record Dialog */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Log Vehicle Service</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddServiceRecord} className="space-y-6 pt-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serviceType" className="text-sm font-medium">Service Type</Label>
                <Input
                  id="serviceType"
                  value={serviceForm.serviceType}
                  onChange={e => setServiceForm({...serviceForm, serviceType: e.target.value})}
                  placeholder="e.g., Oil Change, Tire Replacement"
                  className="h-10"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceDescription" className="text-sm font-medium">Service Description</Label>
                <Textarea 
                  id="serviceDescription"
                  value={serviceForm.serviceDescription}
                  onChange={e => setServiceForm({...serviceForm, serviceDescription: e.target.value})}
                  placeholder="Describe the work performed..."
                  rows={3}
                  className="resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="laborHours" className="text-sm font-medium">Labor Hours</Label>
                  <Input
                    id="laborHours"
                    type="number"
                    step="0.5"
                    value={serviceForm.laborHours}
                    onChange={e => setServiceForm({...serviceForm, laborHours: e.target.value})}
                    placeholder="Hours"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laborCost" className="text-sm font-medium">Labor Cost ($)</Label>
                  <Input
                    id="laborCost"
                    type="number"
                    step="0.01"
                    value={serviceForm.laborCost}
                    onChange={e => setServiceForm({...serviceForm, laborCost: e.target.value})}
                    placeholder="Cost"
                    className="h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="partsCost" className="text-sm font-medium">Parts Cost ($)</Label>
                  <Input
                    id="partsCost"
                    type="number"
                    step="0.01"
                    value={serviceForm.partsCost}
                    onChange={e => setServiceForm({...serviceForm, partsCost: e.target.value})}
                    placeholder="Cost"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mileageAtService" className="text-sm font-medium">Mileage</Label>
                  <Input
                    id="mileageAtService"
                    type="number"
                    value={serviceForm.mileageAtService}
                    onChange={e => setServiceForm({...serviceForm, mileageAtService: e.target.value})}
                    placeholder="Current mileage"
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="partsUsed" className="text-sm font-medium">Parts Used</Label>
                <Textarea 
                  id="partsUsed"
                  value={serviceForm.partsUsed}
                  onChange={e => setServiceForm({...serviceForm, partsUsed: e.target.value})}
                  placeholder="List parts used (optional)"
                  rows={2}
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nextServiceDate" className="text-sm font-medium">Next Service Date</Label>
                  <div className="relative">
                    <Input
                      id="nextServiceDate"
                      type="date"
                      value={serviceForm.nextServiceDate}
                      onChange={e => setServiceForm({...serviceForm, nextServiceDate: e.target.value})}
                      className="h-10 pr-10"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextServiceMileage" className="text-sm font-medium">Next Service Mileage</Label>
                  <Input
                    id="nextServiceMileage"
                    type="number"
                    value={serviceForm.nextServiceMileage}
                    onChange={e => setServiceForm({...serviceForm, nextServiceMileage: e.target.value})}
                    placeholder="Mileage for next service"
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">Additional Notes</Label>
                <Textarea 
                  id="notes"
                  value={serviceForm.notes}
                  onChange={e => setServiceForm({...serviceForm, notes: e.target.value})}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setServiceDialogOpen(false)}
                className="px-6"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="px-6"
              >
                Save Record
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Insurance Upload Dialog */}
      <Dialog open={insuranceDialogOpen} onOpenChange={setInsuranceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Upload Insurance Document</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUploadInsurance} className="space-y-6 pt-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="documentName" className="text-sm font-medium">Document Name</Label>
                <Input
                  id="documentName"
                  value={insuranceForm.documentName}
                  onChange={e => setInsuranceForm({...insuranceForm, documentName: e.target.value})}
                  placeholder="e.g., Motor Vehicle Insurance 2024"
                  className="h-10"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="insuranceType" className="text-sm font-medium">Insurance Type</Label>
                <Select 
                  value={insuranceForm.insuranceType}
                  onValueChange={(value) => setInsuranceForm({...insuranceForm, insuranceType: value})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select insurance type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motor_vehicle">Motor Vehicle Insurance</SelectItem>
                    <SelectItem value="road">Road Insurance</SelectItem>
                    <SelectItem value="comprehensive">Comprehensive Coverage</SelectItem>
                    <SelectItem value="third_party">Third Party</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="insuranceCompany" className="text-sm font-medium">Insurance Company</Label>
                <Input
                  id="insuranceCompany"
                  value={insuranceForm.insuranceCompany}
                  onChange={e => setInsuranceForm({...insuranceForm, insuranceCompany: e.target.value})}
                  placeholder="e.g., Jubilee Insurance"
                  className="h-10"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="policyNumber" className="text-sm font-medium">Policy Number</Label>
                <Input
                  id="policyNumber"
                  value={insuranceForm.policyNumber}
                  onChange={e => setInsuranceForm({...insuranceForm, policyNumber: e.target.value})}
                  placeholder="e.g., POL-123456789"
                  className="h-10"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate" className="text-sm font-medium">Expiry Date</Label>
                <div className="relative">
                  <Input
                    id="expiryDate"
                    type="date"
                    value={insuranceForm.expiryDate}
                    onChange={e => setInsuranceForm({...insuranceForm, expiryDate: e.target.value})}
                    className="h-10 pr-10"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="insuranceFile" className="text-sm font-medium">Insurance Document (PDF/Image)</Label>
                <Input
                  id="insuranceFile"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast({ title: "Error", description: "File must be less than 5MB", variant: "destructive" });
                        return;
                      }
                      setInsuranceForm({...insuranceForm, file});
                    }
                  }}
                  className="h-10"
                  required
                />
                <p className="text-xs text-muted-foreground">Max 5MB (PDF, JPG, PNG)</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setInsuranceDialogOpen(false)}
                className="px-6"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="px-6"
                disabled={uploadingInsurance}
              >
                {uploadingInsurance ? 'Uploading...' : 'Upload Document'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TimelineItem({ type, title, date, description, tag, icon, color }: any) {
  return (
    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
      {/* Icon Circle */}
      <div className={cn(
        "flex items-center justify-center w-10 h-10 rounded-full border border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10",
        color === 'primary' ? 'bg-primary text-white' : 
        color === 'blue' ? 'bg-blue-500 text-white' :
        color === 'emerald' ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white'
      )}>
        {icon}
      </div>
      {/* Card Content */}
      <div className="w-[calc(100%-4rem)] md:w-[45%] p-4 rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <time className="font-mono text-[10px] font-bold text-slate-500">{date}</time>
          <Badge variant="outline" className="text-[9px] uppercase tracking-tighter">{tag}</Badge>
        </div>
        <div className="text-sm font-headline text-slate-900 mb-1">{title}</div>
        <div className="text-xs text-slate-500 line-clamp-2 italic">{description}</div>
      </div>
    </div>
  );
}
