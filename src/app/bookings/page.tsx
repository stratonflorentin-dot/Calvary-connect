"use client";

import { useState, useEffect, useRef } from 'react';
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
  bookingNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceType: 'transport' | 'rental' | 'logistics' | 'other';
  vehicleType?: string;
  origin?: string;
  destination?: string;
  startDate: string;
  endDate?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  contractGenerated: boolean;
  contractStamped: boolean;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200'
};

const serviceTypeLabels: Record<string, string> = {
  transport: 'Transport Service',
  rental: 'Vehicle Rental',
  logistics: 'Logistics',
  other: 'Other'
};

export default function BookingsPage() {
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
      // Use trips table as bookings for now, or create dedicated bookings table
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform trips to bookings format
      const transformedData: Booking[] = (data || []).map((trip: any) => ({
        id: trip.id,
        bookingNumber: `BK-${trip.id.slice(0, 8).toUpperCase()}`,
        clientName: trip.client || 'Unknown Client',
        clientEmail: trip.client_email || '',
        clientPhone: trip.client_phone || '',
        serviceType: 'transport',
        vehicleType: trip.vehicle_id,
        origin: trip.origin,
        destination: trip.destination,
        startDate: trip.start_date || trip.created_at,
        endDate: trip.end_date,
        amount: trip.salesAmount || trip.fare || 0,
        currency: 'TZS',
        status: trip.status === 'completed' ? 'completed' : 
                trip.status === 'in_progress' ? 'in_progress' : 
                trip.status === 'cancelled' ? 'cancelled' : 'pending',
        notes: trip.notes,
        contractGenerated: trip.contract_generated || false,
        contractStamped: trip.contract_stamped || false,
        created_at: trip.created_at,
        updated_at: trip.updated_at
      }));

      setBookings(transformedData);
    } catch (error) {
      console.error('Error loading bookings:', error);
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
        b.bookingNumber.toLowerCase().includes(query) ||
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
      const { data: userData } = await supabase.auth.getUser();
      
      const bookingData = {
        client: formData.clientName,
        client_email: formData.clientEmail,
        client_phone: formData.clientPhone,
        origin: formData.origin,
        destination: formData.destination,
        vehicle_id: formData.vehicleType,
        start_date: formData.startDate,
        end_date: formData.endDate || null,
        salesAmount: formData.amount,
        fare: formData.amount,
        status: formData.status === 'pending' ? 'pending' : 'scheduled',
        notes: formData.notes,
        created_by: userData.data?.user?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('trips')
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
        .from('trips')
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
        .from('trips')
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
            <title>Contract - ${selectedBooking?.bookingNumber}</title>
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

Contract Number: ${selectedBooking.bookingNumber}
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
    a.download = `Contract_${selectedBooking.bookingNumber}.txt`;
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
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-headline tracking-tighter">Bookings</h1>
              <p className="text-muted-foreground">Manage transport and rental bookings with contracts</p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="size-4" />
                  New Booking
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Booking</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddBooking} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientName">Client Name *</Label>
                      <Input 
                        id="clientName" 
                        value={formData.clientName}
                        onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientEmail">Client Email</Label>
                      <Input 
                        id="clientEmail" 
                        type="email"
                        value={formData.clientEmail}
                        onChange={(e) => setFormData({...formData, clientEmail: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientPhone">Client Phone</Label>
                      <Input 
                        id="clientPhone" 
                        value={formData.clientPhone}
                        onChange={(e) => setFormData({...formData, clientPhone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serviceType">Service Type</Label>
                      <Select 
                        value={formData.serviceType}
                        onValueChange={(value) => setFormData({...formData, serviceType: value as any})}
                      >
                        <SelectTrigger>
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
                      <Label htmlFor="origin">Origin</Label>
                      <Input 
                        id="origin" 
                        value={formData.origin}
                        onChange={(e) => setFormData({...formData, origin: e.target.value})}
                        placeholder="Pickup location"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="destination">Destination</Label>
                      <Input 
                        id="destination" 
                        value={formData.destination}
                        onChange={(e) => setFormData({...formData, destination: e.target.value})}
                        placeholder="Delivery location"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date *</Label>
                      <Input 
                        id="startDate" 
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">End Date (optional)</Label>
                      <Input 
                        id="endDate" 
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount (TZS) *</Label>
                      <Input 
                        id="amount" 
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select 
                        value={formData.status}
                        onValueChange={(value) => setFormData({...formData, status: value as any})}
                      >
                        <SelectTrigger>
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
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea 
                      id="notes" 
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      rows={3}
                    />
                  </div>

                  <Button type="submit" className="w-full">Create Booking</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search bookings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
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
          <Card>
            <CardHeader>
              <CardTitle>All Bookings ({filteredBookings.length})</CardTitle>
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
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No bookings found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.bookingNumber}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{booking.clientName}</div>
                            {booking.clientPhone && (
                              <div className="text-xs text-muted-foreground">{booking.clientPhone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{serviceTypeLabels[booking.serviceType]}</TableCell>
                        <TableCell>
                          {booking.origin && booking.destination ? (
                            <div className="text-sm">
                              {booking.origin} → {booking.destination}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{format(parseISO(booking.startDate), 'MMM dd, yyyy')}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(booking.amount)}</TableCell>
                        <TableCell>
                          <Select 
                            value={booking.status}
                            onValueChange={(value) => handleUpdateStatus(booking.id, value)}
                          >
                            <SelectTrigger className="w-[130px] h-8">
                              <Badge className={statusColors[booking.status]}>
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
                            {booking.contractGenerated && (
                              <Badge variant="outline" className="text-xs">
                                <FileText className="size-3 mr-1" />
                                Gen
                              </Badge>
                            )}
                            {booking.contractStamped && (
                              <Badge variant="outline" className="text-xs border-red-200 text-red-600">
                                <Stamp className="size-3 mr-1" />
                                Stamp
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
                            >
                              <FileText className="size-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteBooking(booking.id)}
                              className="text-destructive hover:bg-destructive hover:text-white"
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Service Contract - {selectedBooking?.bookingNumber}</DialogTitle>
          </DialogHeader>
          
          <div ref={contractRef} className="space-y-6 p-6 border rounded-lg bg-white">
            {/* Contract Header */}
            <div className="text-center border-b-2 border-gray-800 pb-6">
              <h1 className="text-2xl font-bold text-gray-800">CALVARY CONNECT LIMITED</h1>
              <p className="text-gray-600">Transport & Logistics Services</p>
              <h2 className="text-xl font-bold mt-4">TRANSPORT SERVICE CONTRACT</h2>
              <p className="text-sm text-gray-500">Contract #: {selectedBooking?.bookingNumber}</p>
              <p className="text-sm text-gray-500">Date: {format(new Date(), 'MMMM dd, yyyy')}</p>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold border-b mb-2">SERVICE PROVIDER</h3>
                <p className="font-medium">Calvary Connect Limited</p>
                <p className="text-sm text-gray-600">Dar es Salaam, Tanzania</p>
                <p className="text-sm text-gray-600">Phone: +255 XXX XXX XXX</p>
                <p className="text-sm text-gray-600">Email: info@calvaryconnect.co.tz</p>
              </div>
              <div>
                <h3 className="font-bold border-b mb-2">CLIENT</h3>
                <p className="font-medium">{selectedBooking?.clientName}</p>
                <p className="text-sm text-gray-600">{selectedBooking?.clientEmail || 'Email: N/A'}</p>
                <p className="text-sm text-gray-600">{selectedBooking?.clientPhone || 'Phone: N/A'}</p>
              </div>
            </div>

            {/* Service Details */}
            <div>
              <h3 className="font-bold border-b mb-4">SERVICE DETAILS</h3>
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 font-medium w-1/3">Service Type:</td>
                    <td className="py-2">{selectedBooking && serviceTypeLabels[selectedBooking.serviceType]}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium">Origin:</td>
                    <td className="py-2">{selectedBooking?.origin || 'N/A'}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium">Destination:</td>
                    <td className="py-2">{selectedBooking?.destination || 'N/A'}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 font-medium">Start Date:</td>
                    <td className="py-2">
                      {selectedBooking && format(parseISO(selectedBooking.startDate), 'MMMM dd, yyyy')}
                    </td>
                  </tr>
                  {selectedBooking?.endDate && (
                    <tr className="border-b">
                      <td className="py-2 font-medium">End Date:</td>
                      <td className="py-2">
                        {format(parseISO(selectedBooking.endDate), 'MMMM dd, yyyy')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Terms */}
            <div>
              <h3 className="font-bold border-b mb-4">FINANCIAL TERMS</h3>
              <div className="bg-gray-50 p-4 rounded">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Amount:</span>
                  <span className="text-xl font-bold">
                    {selectedBooking && formatCurrency(selectedBooking.amount)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">Payment Terms: Net 30 days from invoice date</p>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div>
              <h3 className="font-bold border-b mb-4">TERMS AND CONDITIONS</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>The service provider agrees to provide the transport/logistics services as described above.</li>
                <li>The client agrees to pay the total amount specified above.</li>
                <li>Cancellation policy: 24-hour notice required for cancellations.</li>
                <li>Any additional services will be billed separately.</li>
                <li>The service provider is not liable for delays caused by force majeure.</li>
                <li>Goods are transported at owner's risk unless insurance is purchased.</li>
              </ol>
            </div>

            {/* Digital Stamp Area */}
            <div className="border-2 border-red-600 rounded-lg p-6 text-center my-8">
              <div className="text-red-600 font-bold text-lg mb-2">AUTHORIZED & STAMPED</div>
              <div className="border-2 border-dashed border-red-400 rounded p-8">
                <Stamp className="size-12 mx-auto text-red-600 mb-2" />
                <p className="text-red-600 text-sm">OFFICIAL COMPANY STAMP</p>
                <p className="text-red-600 text-xs mt-2">Calvary Connect Limited</p>
                <p className="text-gray-500 text-xs mt-1">Date: {format(new Date(), 'dd/MM/yyyy')}</p>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-16 mt-12">
              <div>
                <div className="border-t border-gray-800 pt-2">
                  <p className="font-bold">Service Provider</p>
                  <p className="text-sm text-gray-600">Calvary Connect Ltd.</p>
                  <p className="text-sm text-gray-600">Signature & Date</p>
                </div>
              </div>
              <div>
                <div className="border-t border-gray-800 pt-2">
                  <p className="font-bold">Client</p>
                  <p className="text-sm text-gray-600">{selectedBooking?.clientName}</p>
                  <p className="text-sm text-gray-600">Signature & Date</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleDownloadContract} className="gap-2">
              <Download className="size-4" />
              Download
            </Button>
            <Button onClick={handlePrintContract} className="gap-2">
              <Printer className="size-4" />
              Print Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
