"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRole } from '@/hooks/use-role';
import { useCurrency } from '@/hooks/use-currency';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/navigation/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CalendarDays, 
  Plus, 
  FileText, 
  Download, 
  Printer, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2,
  Clock,
  AlertCircle,
  Stamp
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Booking {
  id: string;
  booking_number: string;
  customer_id?: string;
  quotation_id?: string;
  contract_id?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceType: 'transport' | 'rental' | 'logistics' | 'other';
  vehicleType?: string;
  origin?: string;
  destination?: string;
  pickup_location?: string;
  delivery_location?: string;
  cargo_description?: string;
  cargo_weight?: number;
  container_size?: string;
  vehicle_requirement?: string;
  startDate: string;
  endDate?: string;
  pickup_date?: string;
  delivery_date?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  operations_review_status?: string;
  notes?: string;
  contractGenerated: boolean;
  contractStamped: boolean;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  confirmed: 'bg-primary/10 text-primary border-primary/20',
  in_progress: 'bg-accent/10 text-accent border-accent/20',
  completed: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20'
};

const serviceTypeLabels: Record<string, string> = {
  transport: 'Transport Service',
  rental: 'Vehicle Rental',
  logistics: 'Logistics',
  other: 'Other'
};

function BookingsContent() {
  const { role } = useRole();
  const { format: formatCurrency } = useCurrency();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const contractRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<Booking>>({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    serviceType: 'transport',
    vehicleType: '',
    origin: '',
    destination: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    amount: 0,
    currency: 'TZS',
    status: 'pending',
    notes: ''
  });

  useEffect(() => {
    loadBookings();
    
    // Check for URL parameters from Trips or Customers page
    const customerName = searchParams.get('name');
    const customerEmail = searchParams.get('email');
    const customerPhone = searchParams.get('phone');
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const amount = searchParams.get('amount');
    
    if (customerName || origin || destination) {
      // Pre-fill form with data from URL
      setFormData(prev => ({
        ...prev,
        clientName: customerName || prev.clientName,
        clientEmail: customerEmail || prev.clientEmail,
        clientPhone: customerPhone || prev.clientPhone,
        origin: origin || prev.origin,
        destination: destination || prev.destination,
        amount: amount ? Number(amount) : prev.amount
      }));
      
      // Auto-open the add dialog
      setIsAddDialogOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    filterBookings();
  }, [bookings, searchQuery, statusFilter]);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, customers(company_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform bookings data
      const transformedData: Booking[] = (data || []).map((booking: any) => ({
        id: booking.id,
        booking_number: booking.booking_number,
        customer_id: booking.customer_id,
        quotation_id: booking.quotation_id,
        contract_id: booking.contract_id,
        clientName: booking.customers?.company_name || 'Unknown',
        clientEmail: '',
        clientPhone: '',
        serviceType: booking.vehicle_requirement || 'transport',
        vehicleType: booking.vehicle_requirement,
        origin: booking.pickup_location,
        destination: booking.delivery_location,
        pickup_location: booking.pickup_location,
        delivery_location: booking.delivery_location,
        cargo_description: booking.cargo_description,
        cargo_weight: booking.cargo_weight,
        container_size: booking.container_size,
        vehicle_requirement: booking.vehicle_requirement,
        startDate: booking.pickup_date || booking.created_at,
        endDate: booking.delivery_date,
        pickup_date: booking.pickup_date,
        delivery_date: booking.delivery_date,
        amount: booking.amount || 0,
        currency: booking.currency || 'TZS',
        status: booking.status || 'pending',
        operations_review_status: booking.operations_review_status,
        notes: booking.notes,
        contractGenerated: false,
        contractStamped: false,
        created_at: booking.created_at,
        updated_at: booking.updated_at
      }));

      setBookings(transformedData);
    } catch (err) {
      console.error('Error loading bookings:', err);
      toast({ title: 'Error', description: 'Failed to load bookings', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const filterBookings = () => {
    let filtered = [...bookings];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        b.clientName.toLowerCase().includes(query) ||
        b.booking_number.toLowerCase().includes(query) ||
        b.origin?.toLowerCase().includes(query) ||
        b.destination?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }

    setFilteredBookings(filtered);
  };

  const handleAddBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const bookingNumber = `BK-${Date.now().toString().slice(-8)}`;
      
      const bookingData = {
        booking_number: bookingNumber,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientPhone: formData.clientPhone,
        serviceType: formData.serviceType,
        vehicleType: formData.vehicleType,
        origin: formData.origin,
        destination: formData.destination,
        startDate: formData.startDate,
        endDate: formData.endDate || null,
        amount: formData.amount,
        currency: formData.currency,
        status: formData.status,
        notes: formData.notes,
        operations_review_status: 'pending',
        pickup_location: formData.origin,
        delivery_location: formData.destination,
        pickup_date: formData.startDate,
        delivery_date: formData.endDate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('bookings')
        .insert([bookingData])
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Success', description: 'Booking created successfully' });
      setIsAddDialogOpen(false);
      setFormData({
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        serviceType: 'transport',
        vehicleType: '',
        origin: '',
        destination: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
        amount: 0,
        currency: 'TZS',
        status: 'pending',
        notes: ''
      });
      loadBookings();
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({ title: 'Error', description: 'Failed to create booking', variant: 'destructive' });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Status updated' });
      loadBookings();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;
    
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Booking deleted' });
      loadBookings();
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast({ title: 'Error', description: 'Failed to delete booking', variant: 'destructive' });
    }
  };

  const generateContract = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsContractDialogOpen(true);
  };

  const handlePrintContract = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && contractRef.current) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Contract - ${selectedBooking?.booking_number}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
              .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
              .company-name { font-size: 24px; font-weight: bold; color: #1a365d; }
              .contract-title { font-size: 20px; margin: 20px 0; }
              .section { margin: 20px 0; }
              .section-title { font-weight: bold; margin-bottom: 10px; }
              .stamp { border: 3px solid #c53030; padding: 20px; text-align: center; margin: 30px 0; color: #c53030; }
              .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
              .signature-box { width: 200px; border-top: 1px solid #333; padding-top: 10px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
              th { background-color: #f5f5f5; }
            </style>
          </head>
          <body>
            ${contractRef.current.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadContract = () => {
    if (!contractRef.current || !selectedBooking) return;
    
    const content = `
TRANSPORT SERVICE CONTRACT

Contract Number: ${selectedBooking.booking_number}
Date: ${format(new Date(), 'MMMM dd, yyyy')}

PARTIES:
Service Provider: CALVARY CONNECT LIMITED
Client: ${selectedBooking.clientName}
Email: ${selectedBooking.clientEmail}
Phone: ${selectedBooking.clientPhone}

SERVICE DETAILS:
Service Type: ${serviceTypeLabels[selectedBooking.serviceType]}
Origin: ${selectedBooking.origin || 'N/A'}
Destination: ${selectedBooking.destination || 'N/A'}
Start Date: ${format(parseISO(selectedBooking.startDate), 'MMMM dd, yyyy')}
${selectedBooking.endDate ? `End Date: ${format(parseISO(selectedBooking.endDate), 'MMMM dd, yyyy')}` : ''}

FINANCIAL TERMS:
Total Amount: ${formatCurrency(selectedBooking.amount)}
Currency: ${selectedBooking.currency}
Payment Terms: Net 30 days from invoice date

TERMS AND CONDITIONS:
1. The service provider agrees to provide the transport/logistics services as described above.
2. The client agrees to pay the total amount specified above.
3. Cancellation policy: 24-hour notice required for cancellations.
4. Any additional services will be billed separately.

SIGNATURES:

_________________________                    _________________________
Service Provider                             Client
Calvary Connect Ltd.                         ${selectedBooking.clientName}
Date: ${format(new Date(), 'dd/MM/yyyy')}                         Date: ________________

[STAMP AREA - AUTHORIZED SEAL]
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Contract_${selectedBooking.booking_number}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 md:ml-60 p-4 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground tracking-tight">Bookings</h1>
              <p className="text-base text-muted-foreground mt-2">Manage transport and rental bookings with contracts</p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow gap-2">
                  <Plus className="size-4" />
                  New Booking
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">Create New Booking</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddBooking} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientName" className="text-sm font-semibold text-foreground">Client Name *</Label>
                      <Input 
                        id="clientName" 
                        value={formData.clientName}
                        onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                        required 
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientEmail" className="text-sm font-semibold text-foreground">Client Email</Label>
                      <Input 
                        id="clientEmail" 
                        type="email"
                        value={formData.clientEmail}
                        onChange={(e) => setFormData({...formData, clientEmail: e.target.value})}
                        className="h-11"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientPhone" className="text-sm font-semibold text-foreground">Client Phone</Label>
                      <Input 
                        id="clientPhone" 
                        value={formData.clientPhone}
                        onChange={(e) => setFormData({...formData, clientPhone: e.target.value})}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serviceType" className="text-sm font-semibold text-foreground">Service Type</Label>
                      <Select 
                        value={formData.serviceType}
                        onValueChange={(value) => setFormData({...formData, serviceType: value as any})}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transport">Transport Service</SelectItem>
                          <SelectItem value="rental">Vehicle Rental</SelectItem>
                          <SelectItem value="logistics">Logistics</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="origin" className="text-sm font-semibold text-foreground">Origin</Label>
                      <Input 
                        id="origin" 
                        value={formData.origin}
                        onChange={(e) => setFormData({...formData, origin: e.target.value})}
                        placeholder="Pickup location"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="destination" className="text-sm font-semibold text-foreground">Destination</Label>
                      <Input 
                        id="destination" 
                        value={formData.destination}
                        onChange={(e) => setFormData({...formData, destination: e.target.value})}
                        placeholder="Delivery location"
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate" className="text-sm font-semibold text-foreground">Start Date *</Label>
                      <Input 
                        id="startDate" 
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate" className="text-sm font-semibold text-foreground">End Date (optional)</Label>
                      <Input 
                        id="endDate" 
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount" className="text-sm font-semibold text-foreground">Amount (TZS) *</Label>
                      <Input 
                        id="amount" 
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status" className="text-sm font-semibold text-foreground">Status</Label>
                      <Select 
                        value={formData.status}
                        onValueChange={(value) => setFormData({...formData, status: value as any})}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-semibold text-foreground">Notes</Label>
                    <Textarea 
                      id="notes" 
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      rows={3}
                      className="min-h-[80px]"
                    />
                  </div>

                  <Button type="submit" className="w-full h-11 shadow-md hover:shadow-lg transition-shadow">Create Booking</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <Card className="shadow-lg border-border">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search bookings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] h-11">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Bookings Table */}
          <Card className="shadow-lg border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-foreground">All Bookings ({filteredBookings.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">Loading...</TableCell>
                    </TableRow>
                  ) : filteredBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        No bookings found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBookings.map((booking) => (
                      <TableRow key={booking.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-foreground">{booking.booking_number}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-foreground">{booking.clientName}</div>
                            {booking.clientPhone && (
                              <div className="text-xs text-muted-foreground">{booking.clientPhone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">{serviceTypeLabels[booking.serviceType]}</TableCell>
                        <TableCell>
                          {booking.origin && booking.destination ? (
                            <div className="text-sm text-foreground">
                              {booking.origin} → {booking.destination}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{format(parseISO(booking.startDate), 'MMM dd, yyyy')}</TableCell>
                        <TableCell className="font-medium text-foreground">{formatCurrency(booking.amount)}</TableCell>
                        <TableCell>
                          <Select 
                            value={booking.status}
                            onValueChange={(value) => handleUpdateStatus(booking.id, value)}
                          >
                            <SelectTrigger className="w-[130px] h-9">
                              <Badge className={statusColors[booking.status]} variant="outline">
                                {booking.status.replace('_', ' ')}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {booking.quotation_id && (
                              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                Quote
                              </Badge>
                            )}
                            {booking.contract_id && (
                              <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/20">
                                Contract
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => generateContract(booking)}
                              className="hover:bg-primary/10 hover:text-primary"
                            >
                              <FileText className="size-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteBooking(booking.id)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
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
        </div>
      </main>

      {/* Contract Dialog */}
      <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Service Contract - {selectedBooking?.booking_number}</DialogTitle>
          </DialogHeader>
          
          <div ref={contractRef} className="space-y-6 p-6 border border-border rounded-xl bg-card">
            {/* Contract Header */}
            <div className="text-center border-b-2 border-border pb-6">
              <h1 className="text-2xl font-bold text-foreground">CALVARY CONNECT LIMITED</h1>
              <p className="text-muted-foreground">Transport & Logistics Services</p>
              <h2 className="text-xl font-bold mt-4 text-foreground">TRANSPORT SERVICE CONTRACT</h2>
              <p className="text-sm text-muted-foreground">Contract #: {selectedBooking?.booking_number}</p>
              <p className="text-sm text-muted-foreground">Date: {format(new Date(), 'MMMM dd, yyyy')}</p>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold border-b border-border mb-2 text-foreground">SERVICE PROVIDER</h3>
                <p className="font-medium text-foreground">Calvary Connect Limited</p>
                <p className="text-sm text-muted-foreground">Dar es Salaam, Tanzania</p>
                <p className="text-sm text-muted-foreground">Phone: +255 XXX XXX XXX</p>
                <p className="text-sm text-muted-foreground">Email: info@calvaryconnect.co.tz</p>
              </div>
              <div>
                <h3 className="font-bold border-b border-border mb-2 text-foreground">CLIENT</h3>
                <p className="font-medium text-foreground">{selectedBooking?.clientName}</p>
                <p className="text-sm text-muted-foreground">{selectedBooking?.clientEmail || 'Email: N/A'}</p>
                <p className="text-sm text-muted-foreground">{selectedBooking?.clientPhone || 'Phone: N/A'}</p>
              </div>
            </div>

            {/* Service Details */}
            <div>
              <h3 className="font-bold border-b border-border mb-4 text-foreground">SERVICE DETAILS</h3>
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 font-medium w-1/3 text-foreground">Service Type:</td>
                    <td className="py-2 text-foreground">{selectedBooking && serviceTypeLabels[selectedBooking.serviceType]}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 font-medium text-foreground">Origin:</td>
                    <td className="py-2 text-foreground">{selectedBooking?.origin || 'N/A'}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 font-medium text-foreground">Destination:</td>
                    <td className="py-2 text-foreground">{selectedBooking?.destination || 'N/A'}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-2 font-medium text-foreground">Start Date:</td>
                    <td className="py-2 text-foreground">
                      {selectedBooking && format(parseISO(selectedBooking.startDate), 'MMMM dd, yyyy')}
                    </td>
                  </tr>
                  {selectedBooking?.endDate && (
                    <tr className="border-b border-border">
                      <td className="py-2 font-medium text-foreground">End Date:</td>
                      <td className="py-2 text-foreground">
                        {format(parseISO(selectedBooking.endDate), 'MMMM dd, yyyy')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Terms */}
            <div>
              <h3 className="font-bold border-b border-border mb-4 text-foreground">FINANCIAL TERMS</h3>
              <div className="bg-muted/50 p-4 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-foreground">Total Amount:</span>
                  <span className="text-xl font-bold text-foreground">
                    {selectedBooking && formatCurrency(selectedBooking.amount)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Payment Terms: Net 30 days from invoice date</p>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div>
              <h3 className="font-bold border-b border-border mb-4 text-foreground">TERMS AND CONDITIONS</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-foreground">
                <li>The service provider agrees to provide the transport/logistics services as described above.</li>
                <li>The client agrees to pay the total amount specified above.</li>
                <li>Cancellation policy: 24-hour notice required for cancellations.</li>
                <li>Any additional services will be billed separately.</li>
                <li>The service provider is not liable for delays caused by force majeure.</li>
                <li>Goods are transported at owner's risk unless insurance is purchased.</li>
              </ol>
            </div>

            {/* Digital Stamp Area */}
            <div className="border-2 border-destructive rounded-xl p-6 text-center my-8">
              <div className="text-destructive font-bold text-lg mb-2">AUTHORIZED & STAMPED</div>
              <div className="border-2 border-dashed border-destructive/50 rounded-xl p-8">
                <Stamp className="size-12 mx-auto text-destructive mb-2" />
                <p className="text-destructive text-sm">OFFICIAL COMPANY STAMP</p>
                <p className="text-destructive text-xs mt-2">Calvary Connect Limited</p>
                <p className="text-muted-foreground text-xs mt-1">Date: {format(new Date(), 'dd/MM/yyyy')}</p>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-16 mt-12">
              <div>
                <div className="border-t border-border pt-2">
                  <p className="font-bold text-foreground">Service Provider</p>
                  <p className="text-sm text-muted-foreground">Calvary Connect Ltd.</p>
                  <p className="text-sm text-muted-foreground">Signature & Date</p>
                </div>
              </div>
              <div>
                <div className="border-t border-border pt-2">
                  <p className="font-bold text-foreground">Client</p>
                  <p className="text-sm text-muted-foreground">{selectedBooking?.clientName}</p>
                  <p className="text-sm text-muted-foreground">Signature & Date</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-3 pt-6">
            <Button variant="outline" onClick={handleDownloadContract} className="h-11 px-6 gap-2">
              <Download className="size-4" />
              Download
            </Button>
            <Button onClick={handlePrintContract} className="h-11 px-6 shadow-md hover:shadow-lg transition-shadow gap-2">
              <Printer className="size-4" />
              Print Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<BookingsLoading />}>
      <BookingsContent />
    </Suspense>
  );
}

function BookingsLoading() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-8">
            <div className="h-12 bg-muted rounded-xl w-64" />
            <div className="h-6 bg-muted rounded-xl w-96" />
            <div className="h-64 bg-muted rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
