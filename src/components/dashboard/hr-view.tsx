
"use client";

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Users, UserMinus, UserCheck, CalendarDays, Download, Plus, Edit, Trash2, Award, AlertCircle } from 'lucide-react';
import { rowsToCsv, downloadCsv } from '@/lib/export-csv';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { NotificationService } from '@/lib/notification-service';
import { toast } from '@/hooks/use-toast';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function HrView() {
  const { t } = useLanguage();
  const { user } = useSupabase();

  // Meeting planning state
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');

  // Employee management state
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    email: '',
    role: '',
    status: 'active',
    phone: '',
    address: '',
    salary: '',
    hireDate: new Date()
  });

  // Insurance management state
  const [insuranceDialogOpen, setInsuranceDialogOpen] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<any>(null);
  const [insuranceForm, setInsuranceForm] = useState({
    policyName: '',
    policyType: 'vehicle',
    insuranceCompany: '',
    policyNumber: '',
    vehicleId: '',
    coverageAmount: '',
    premiumAmount: '',
    startDate: new Date(),
    endDate: new Date(),
    renewalDate: new Date(),
    status: 'active',
    notes: ''
  });
  const [insurancePolicies, setInsurancePolicies] = useState<any[]>([]);

  // Performance management state
  const [performanceDialogOpen, setPerformanceDialogOpen] = useState(false);
  const [performanceForm, setPerformanceForm] = useState({
    employeeId: '',
    rating: '',
    review: '',
    goals: '',
    date: new Date()
  });

  // Real data for HR functionality
  const [users, setUsers] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [allowances, setAllowances] = useState<any[]>([]);
  const [performanceReviews, setPerformanceReviews] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        // Load real users from database
        const { data: realUsers } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });
        
        // Load real meetings from database
        const { data: realMeetings } = await supabase
          .from('meetings')
          .select('*')
          .order('date', { ascending: false });
        
        // Load real allowances from database
        const { data: realAllowances } = await supabase
          .from('driver_allowances')
          .select('*')
          .order('created_at', { ascending: false });
        
        // Load real insurance policies from database
        const { data: realInsurancePolicies } = await supabase
          .from('insurance_policies')
          .select('*')
          .order('created_at', { ascending: false });
        
        // Load real performance reviews from database
        const { data: realPerformanceReviews } = await supabase
          .from('performance_reviews')
          .select('*')
          .order('review_date', { ascending: false });
        
        setUsers(realUsers || []);
        setMeetings(realMeetings || []);
        setAllowances(realAllowances || []);
        setInsurancePolicies(realInsurancePolicies || []);
        setPerformanceReviews(realPerformanceReviews || []);
        
      } catch (error) {
        console.error('Error loading HR data:', error);
        // Set empty arrays on error
        setUsers([]);
        setMeetings([]);
        setAllowances([]);
        setPerformanceReviews([]);
      }
    };

    loadData();
  }, [user]);

  const exportHrToExcelCsv = () => {
    const totalStaff = users?.length ?? 0;
    const activeStaff = users?.filter((u) => u.status !== 'inactive').length ?? 0;

    const sections: (string | number | boolean | null | undefined)[][] = [];
    const push = (title: string, header: string[], rows: (string | number | boolean | null | undefined)[][]) => {
      sections.push([title]);
      sections.push(header);
      rows.forEach((r) => sections.push(r));
      sections.push([]);
    };

    push(
      'HR SUMMARY',
      ['metric', 'value'],
      [
        ['total_staff', totalStaff],
        ['active_staff', activeStaff],
        ['meetings_scheduled', meetings?.length ?? 0],
        ['allowance_records', allowances?.length ?? 0],
      ]
    );

    push(
      'STAFF / USERS',
      ['id', 'name', 'email', 'role', 'status', 'created_at'],
      (users || []).map((u) => [
        u.id,
        u.name ?? '',
        u.email ?? '',
        u.role ?? '',
        u.status ?? '',
        u.created_at ?? '',
      ])
    );

    push(
      'MEETINGS',
      ['id', 'title', 'date', 'participants', 'createdBy', 'created_at'],
      (meetings || []).map((m) => [
        m.id,
        m.title ?? '',
        m.date ?? '',
        Array.isArray(m.participants) ? m.participants.join('; ') : String(m.participants ?? ''),
        m.createdBy ?? '',
        m.created_at ?? '',
      ])
    );

    const allowancesSorted = [...(allowances || [])].sort((a, b) =>
      String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
    );

    push(
      'ALLOWANCES (WORKER COMPENSATION)',
      ['id', 'workerName', 'role', 'userId', 'amount', 'created_at'],
      allowancesSorted.map((a) => [
        a.id,
        a.workerName ?? '',
        a.role ?? '',
        a.userId ?? '',
        a.amount ?? '',
        a.created_at ?? '',
      ])
    );

    const csv = rowsToCsv(sections);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadCsv(`calvary-hr-export-${stamp}.csv`, csv);
  };

  // Create meeting handler
  const handleCreateMeeting = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!meetingTitle || !meetingDate || !selectedParticipant) return;
    
    try {
      // Insert meeting into database
      const { error, data } = await supabase.from('meetings').insert({
        title: meetingTitle,
        date: meetingDate.toISOString(),
        participants: [selectedParticipant],
        created_by: user?.id,
        created_at: new Date().toISOString(),
        status: 'scheduled'
      });
      
      if (error) throw error;
      
      // Create notification for meeting participant
      const participant = users?.find(u => u.id === selectedParticipant);
      if (participant) {
        await NotificationService.createForUser(selectedParticipant, {
          title: 'New Meeting Scheduled',
          message: `You have been invited to a meeting: "${meetingTitle}" on ${format(new Date(meetingDate), 'PPP')} at ${format(new Date(meetingDate), 'p')}`,
          type: 'meeting',
          severity: 'info'
        });
      }
      
      // Refresh meetings
      const { data: refreshedMeetings } = await supabase
        .from('meetings')
        .select('*')
        .order('date', { ascending: false });
      setMeetings(refreshedMeetings || []);
      
      // Clear form
      setMeetingDialogOpen(false);
      setMeetingTitle('');
      setMeetingDate(undefined);
      setSelectedParticipant('');
      
      toast({ title: "Meeting Created", description: "Meeting scheduled successfully" });
      
    } catch (error: any) {
      console.error('Error creating meeting:', error);
      toast({ title: "Error", description: "Failed to create meeting", variant: "destructive" });
    }
  };

  // Employee management handlers
  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setEmployeeForm({
      name: '',
      email: '',
      role: '',
      status: 'active',
      phone: '',
      address: '',
      salary: '',
      hireDate: new Date()
    });
    setEmployeeDialogOpen(true);
  };

  const handleEditEmployee = (employee: any) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      name: employee.name || '',
      email: employee.email || '',
      role: employee.role || '',
      status: employee.status || 'active',
      phone: employee.phone || '',
      address: employee.address || '',
      salary: employee.salary || '',
      hireDate: employee.hireDate ? new Date(employee.hireDate) : new Date()
    });
    setEmployeeDialogOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      if (editingEmployee) {
        // Update existing employee
        const { error } = await supabase
          .from('user_profiles')
          .update({
            name: employeeForm.name,
            email: employeeForm.email,
            role: employeeForm.role,
            status: employeeForm.status,
            phone: employeeForm.phone,
            address: employeeForm.address,
            salary: employeeForm.salary,
            hire_date: employeeForm.hireDate.toISOString()
          })
          .eq('id', editingEmployee.id);
          
        if (error) throw error;
        toast({ title: "Employee Updated", description: "Employee information updated successfully" });
      } else {
        // Add new employee
        const { error, data } = await supabase
          .from('user_profiles')
          .insert({
            name: employeeForm.name,
            email: employeeForm.email,
            role: employeeForm.role,
            status: employeeForm.status,
            phone: employeeForm.phone,
            address: employeeForm.address,
            salary: employeeForm.salary,
            hire_date: employeeForm.hireDate.toISOString(),
            created_at: new Date().toISOString()
          });
          
        if (error) throw error;
        
        // Create notification for new employee
        await NotificationService.createForUser(data?.[0]?.id, {
          title: 'Welcome to the Team!',
          message: `Your account has been created as ${employeeForm.role}. Welcome to Calvary Chapel Fleet Management!`,
          type: 'welcome',
          severity: 'success'
        });
        
        // Create notification for HR/Admin users
        await NotificationService.createForAdmins({
          title: 'New Employee Added',
          message: `${employeeForm.name} has been added as ${employeeForm.role}`,
          type: 'employee',
          severity: 'info'
        });
        
        toast({ title: "Employee Added", description: "New employee added successfully" });
      }
      
      // Refresh users
      const { data: refreshedUsers } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      setUsers(refreshedUsers || []);
      
      setEmployeeDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast({ title: "Error", description: "Failed to save employee", variant: "destructive" });
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', employeeId);
        
      if (error) throw error;
      
      // Refresh users
      const { data: refreshedUsers } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      setUsers(refreshedUsers || []);
      
      toast({ title: "Employee Deleted", description: "Employee removed successfully" });
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      toast({ title: "Error", description: "Failed to delete employee", variant: "destructive" });
    }
  };

  // Insurance management handlers
  const handleAddInsurance = () => {
    setEditingInsurance(null);
    setInsuranceForm({
      policyName: '',
      policyType: 'vehicle',
      insuranceCompany: '',
      policyNumber: '',
      vehicleId: '',
      coverageAmount: '',
      premiumAmount: '',
      startDate: new Date(),
      endDate: new Date(),
      renewalDate: new Date(),
      status: 'active',
      notes: ''
    });
    setInsuranceDialogOpen(true);
  };

  const handleEditInsurance = (insurance: any) => {
    setEditingInsurance(insurance);
    setInsuranceForm({
      policyName: insurance.policy_name || '',
      policyType: insurance.policy_type || 'vehicle',
      insuranceCompany: insurance.insurance_company || '',
      policyNumber: insurance.policy_number || '',
      vehicleId: insurance.vehicle_id || '',
      coverageAmount: insurance.coverage_amount || '',
      premiumAmount: insurance.premium_amount || '',
      startDate: insurance.start_date ? new Date(insurance.start_date) : new Date(),
      endDate: insurance.end_date ? new Date(insurance.end_date) : new Date(),
      renewalDate: insurance.renewal_date ? new Date(insurance.renewal_date) : new Date(),
      status: insurance.status || 'active',
      notes: insurance.notes || ''
    });
    setInsuranceDialogOpen(true);
  };

  const handleSaveInsurance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      if (editingInsurance) {
        // Update existing insurance policy
        const { error } = await supabase
          .from('insurance_policies')
          .update({
            policy_name: insuranceForm.policyName,
            policy_type: insuranceForm.policyType,
            insurance_company: insuranceForm.insuranceCompany,
            policy_number: insuranceForm.policyNumber,
            vehicle_id: insuranceForm.vehicleId,
            coverage_amount: insuranceForm.coverageAmount,
            premium_amount: insuranceForm.premiumAmount,
            start_date: insuranceForm.startDate.toISOString().split('T')[0],
            end_date: insuranceForm.endDate.toISOString().split('T')[0],
            renewal_date: insuranceForm.renewalDate.toISOString().split('T')[0],
            status: insuranceForm.status,
            notes: insuranceForm.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingInsurance.id);
          
        if (error) throw error;
        toast({ title: "Insurance Policy Updated", description: "Policy updated successfully" });
      } else {
        // Add new insurance policy
        const { error, data } = await supabase
          .from('insurance_policies')
          .insert({
            policy_name: insuranceForm.policyName,
            policy_type: insuranceForm.policyType,
            insurance_company: insuranceForm.insuranceCompany,
            policy_number: insuranceForm.policyNumber,
            vehicle_id: insuranceForm.vehicleId,
            coverage_amount: insuranceForm.coverageAmount,
            premium_amount: insuranceForm.premiumAmount,
            start_date: insuranceForm.startDate.toISOString().split('T')[0],
            end_date: insuranceForm.endDate.toISOString().split('T')[0],
            renewal_date: insuranceForm.renewalDate.toISOString().split('T')[0],
            status: insuranceForm.status,
            notes: insuranceForm.notes,
            created_by: user?.id,
            created_at: new Date().toISOString()
          });
          
        if (error) throw error;
        
        // Create notification for HR/Admin users about new policy
        await NotificationService.createForAdmins({
          title: 'New Insurance Policy Added',
          message: `${insuranceForm.policyName} (${insuranceForm.policyType}) has been added with ${insuranceForm.insuranceCompany}`,
          type: 'insurance',
          severity: 'success'
        });
        
        // Create renewal reminder if renewal date is within 30 days
        const renewalDate = new Date(insuranceForm.renewalDate);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        if (renewalDate <= thirtyDaysFromNow) {
          await NotificationService.createForAdmins({
            title: 'Insurance Renewal Due Soon',
            message: `${insuranceForm.policyName} renewal is due on ${format(renewalDate, 'PPP')}`,
            type: 'insurance',
            severity: 'warning'
          });
        }
        
        toast({ title: "Insurance Policy Added", description: "New policy added successfully" });
      }
      
      // Refresh insurance policies
      const { data: refreshedPolicies } = await supabase
        .from('insurance_policies')
        .select('*')
        .order('created_at', { ascending: false });
      setInsurancePolicies(refreshedPolicies || []);
      
      setInsuranceDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving insurance policy:', error);
      toast({ title: "Error", description: "Failed to save insurance policy", variant: "destructive" });
    }
  };

  const handleDeleteInsurance = async (insuranceId: string) => {
    if (!confirm('Are you sure you want to delete this insurance policy?')) return;
    
    try {
      const { error } = await supabase
        .from('insurance_policies')
        .delete()
        .eq('id', insuranceId);
        
      if (error) throw error;
      
      // Refresh insurance policies
      const { data: refreshedPolicies } = await supabase
        .from('insurance_policies')
        .select('*')
        .order('created_at', { ascending: false });
      setInsurancePolicies(refreshedPolicies || []);
      
      toast({ title: "Insurance Policy Deleted", description: "Policy removed successfully" });
    } catch (error: any) {
      console.error('Error deleting insurance policy:', error);
      toast({ title: "Error", description: "Failed to delete insurance policy", variant: "destructive" });
    }
  };

  // Performance management handlers
  const handleAddPerformanceReview = () => {
    setPerformanceForm({
      employeeId: '',
      rating: '',
      review: '',
      goals: '',
      date: new Date()
    });
    setPerformanceDialogOpen(true);
  };

  const handleSavePerformanceReview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('performance_reviews')
        .insert({
          employee_id: performanceForm.employeeId,
          rating: performanceForm.rating,
          review: performanceForm.review,
          goals: performanceForm.goals,
          review_date: performanceForm.date.toISOString(),
          created_by: user?.id,
          created_at: new Date().toISOString()
        });
        
      if (error) throw error;
      
      // Refresh performance reviews
      const { data: refreshedReviews } = await supabase
        .from('performance_reviews')
        .select('*')
        .order('review_date', { ascending: false });
      setPerformanceReviews(refreshedReviews || []);
      
      toast({ title: "Performance Review Added", description: "Review saved successfully" });
      setPerformanceDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving performance review:', error);
      toast({ title: "Error", description: "Failed to save review", variant: "destructive" });
    }
  };

  const totalEmployees = users?.length || 0;
  const activeEmployees = users?.filter(u => u.status !== 'inactive').length || 0;
  const inactiveEmployees = users?.filter(u => u.status === 'inactive').length || 0;

  const roleCounts = useMemo(() => {
    const list = users || [];
    const countRole = (r: string) => list.filter((u) => (u.role || '').toUpperCase() === r).length;
    return {
      drivers: countRole('DRIVER'),
      mechanics: countRole('MECHANIC'),
      operators: countRole('OPERATOR'),
      administration: list.filter((u) =>
        ['CEO', 'HR', 'ACCOUNTANT'].includes((u.role || '').toUpperCase())
      ).length,
    };
  }, [users]);

  const recentStaff = useMemo(
    () =>
      [...(users || [])]
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
        .slice(0, 6),
    [users]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-3xl font-headline tracking-tighter text-foreground">Human Resources</h1>
          <p className="text-muted-foreground text-sm font-sans">Manage employees, track attendance, and oversee worker allowances.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2 rounded-full border-primary text-primary shrink-0"
          onClick={exportHrToExcelCsv}
        >
          <Download className="size-4" />
          Export to Excel (CSV)
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Staff" value={totalEmployees} icon={<Users className="size-4" />} color="primary" />
        <MetricCard title="Active Duty" value={activeEmployees} icon={<UserCheck className="size-4" />} color="emerald" />
        <MetricCard title="Inactive" value={inactiveEmployees} icon={<UserMinus className="size-4" />} color="amber" />
        <MetricCard title="Meetings" value={meetings?.length ?? 0} icon={<CalendarDays className="size-4" />} color="rose" />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insurance">Insurance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Meeting Planning */}
            <Card className="rounded-2xl shadow-sm border-none bg-white">
              <CardHeader>
                <CardTitle className="text-lg font-headline flex items-center justify-between">
                  Meeting Planning
                  <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">Plan Meeting</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl flex items-center gap-2">
                          📅 Plan a New Meeting
                        </DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateMeeting} className="space-y-6 pt-2">
                        {/* Meeting Details Section */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold border-b pb-2">Meeting Details</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label htmlFor="meetingTitle" className="text-sm font-medium flex items-center gap-2">
                                📝 Meeting Title
                                <span className="text-xs text-muted-foreground">(Meeting purpose)</span>
                              </Label>
                              <Input 
                                id="meetingTitle"
                                value={meetingTitle} 
                                onChange={e => setMeetingTitle(e.target.value)} 
                                placeholder="Enter meeting title or purpose"
                                className="h-10"
                                required 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="meetingDate" className="text-sm font-medium flex items-center gap-2">
                                📅 Meeting Date
                                <span className="text-xs text-muted-foreground">(Schedule date)</span>
                              </Label>
                              <div className="relative">
                                <Input
                                  id="meetingDate"
                                  type="date"
                                  value={meetingDate ? meetingDate.toISOString().split('T')[0] : ''}
                                  onChange={(e) => {
                                    const date = e.target.value ? new Date(e.target.value) : undefined;
                                    setMeetingDate(date);
                                  }}
                                  min={new Date().toISOString().split('T')[0]}
                                  className="h-10 pr-10"
                                  required
                                />
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                              {meetingDate && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(meetingDate), 'EEEE, MMMM d, yyyy')}
                                </p>
                              )}
                              {meetingDate && new Date(meetingDate) < new Date(new Date().setDate(new Date().getDate() - 1)) && (
                                <p className="text-xs text-red-500 font-medium">⚠️ Meeting date cannot be in the past</p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="participant" className="text-sm font-medium flex items-center gap-2">
                                👥 Participant
                                <span className="text-xs text-muted-foreground">(Select attendee)</span>
                              </Label>
                              <Select value={selectedParticipant} onValueChange={setSelectedParticipant}>
                                <SelectTrigger id="participant" className="h-10">
                                  <SelectValue placeholder="Select participant for meeting" />
                                </SelectTrigger>
                                <SelectContent>
                                  {users?.map(u => (
                                    <SelectItem key={u.id} value={u.id}>
                                      <div className="flex items-center gap-2">
                                        <span>{u.name || u.email}</span>
                                        <span className="text-xs text-muted-foreground">({u.role})</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        
                        {/* Meeting Summary */}
                        {meetingTitle && meetingDate && selectedParticipant && (
                          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                              <CalendarDays className="h-5 w-5 text-blue-600" />
                              <span className="font-medium text-blue-900">Meeting Summary</span>
                            </div>
                            <div className="space-y-1 text-sm">
                              <p className="text-blue-800"><strong>Title:</strong> {meetingTitle}</p>
                              <p className="text-blue-800"><strong>Date:</strong> {format(new Date(meetingDate), 'EEEE, MMMM d, yyyy')}</p>
                              <p className="text-blue-800"><strong>Participant:</strong> {users?.find(u => u.id === selectedParticipant)?.name || 'Selected'}</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-end pt-4 border-t">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setMeetingDialogOpen(false)}
                            className="px-6"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit"
                            className="px-6"
                          >
                            Create Meeting
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="font-bold text-sm mb-2">Upcoming Meetings</h4>
                  {meetings && meetings.length > 0 ? (
                    <ul className="space-y-1">
                      {meetings
                        .filter(m => new Date(m.date) >= new Date())
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .slice(0, 3)
                        .map(m => (
                          <li key={m.id} className="flex flex-col border-b last:border-0 pb-2 last:pb-0">
                            <span className="font-medium">{m.title}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(m.date), 'PPP')}</span>
                            <span className="text-xs">Participants: {users?.filter(u => m.participants?.includes(u.id)).map(u => u.name).join(', ')}</span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-muted-foreground">No upcoming meetings.</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Staff Activity */}
            <Card className="rounded-2xl shadow-sm border-none bg-white">
              <CardHeader>
                <CardTitle className="text-lg font-headline">Recently added staff</CardTitle>
              </CardHeader>
              <CardContent>
                {recentStaff.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No staff records yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {recentStaff.map((u: any) => (
                      <li key={u.id} className="flex justify-between items-start gap-2 bg-muted/20 p-3 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="bg-primary/10 text-primary p-2 rounded-lg shrink-0">
                            <Users className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{u.name || u.email || u.id}</p>
                            <p className="text-xs text-muted-foreground">{u.role} · {u.status || 'active'}</p>
                          </div>
                        </div>
                        {u.created_at && (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {format(new Date(u.created_at), 'MMM d')}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Department Overview */}
            <Card className="rounded-2xl shadow-sm border-none bg-white">
              <CardHeader>
                <CardTitle className="text-lg font-headline">Department Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <DeptRow name="Drivers" count={roleCounts.drivers} />
                  <DeptRow name="Mechanics" count={roleCounts.mechanics} />
                  <DeptRow name="Operations" count={roleCounts.operators} />
                  <DeptRow name="Administration" count={roleCounts.administration} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employees" className="space-y-6">
          <Card className="rounded-2xl shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-headline flex items-center justify-between">
                Employee Management
                <Button onClick={handleAddEmployee} className="gap-2">
                  <Plus className="size-4" />
                  Add Employee
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No employees found.</p>
                ) : (
                  <div className="space-y-3">
                    {users.map((employee: any) => (
                      <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="bg-primary/10 text-primary p-2 rounded-lg">
                            <Users className="size-4" />
                          </div>
                          <div>
                            <p className="font-medium">{employee.name || employee.email}</p>
                            <p className="text-sm text-muted-foreground">{employee.role} · {employee.status}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditEmployee(employee)}>
                            <Edit className="size-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeleteEmployee(employee.id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meetings" className="space-y-6">
          <Card className="rounded-2xl shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-headline">All Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {meetings?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No meetings scheduled.</p>
                ) : (
                  <div className="space-y-3">
                    {meetings.map((meeting: any) => (
                      <div key={meeting.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{meeting.title}</p>
                            <p className="text-sm text-muted-foreground">{format(new Date(meeting.date), 'PPP')}</p>
                            <p className="text-sm">Participants: {users?.filter(u => meeting.participants?.includes(u.id)).map(u => u.name).join(', ')}</p>
                          </div>
                          <Badge variant={meeting.status === 'completed' ? 'default' : 'secondary'}>
                            {meeting.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card className="rounded-2xl shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-headline flex items-center justify-between">
                Performance Management
                <Button onClick={handleAddPerformanceReview} className="gap-2">
                  <Award className="size-4" />
                  Add Review
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performanceReviews?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No performance reviews yet.</p>
                ) : (
                  <div className="space-y-3">
                    {performanceReviews.map((review: any) => (
                      <div key={review.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{users?.find(u => u.id === review.employee_id)?.name || 'Unknown Employee'}</p>
                            <p className="text-sm text-muted-foreground">{format(new Date(review.review_date), 'PPP')}</p>
                            <div className="flex gap-1 mt-1">
                              {Array.from({ length: parseInt(review.rating) || 0 }).map((_, i) => (
                                <span key={i}>⭐</span>
                              ))}
                            </div>
                            <p className="text-sm mt-2">{review.review}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance" className="space-y-6">
          <Card className="rounded-2xl shadow-sm border-none bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-headline flex items-center justify-between">
                Insurance Management
                <Button onClick={handleAddInsurance} className="gap-2">
                  <Plus className="size-4" />
                  Add Policy
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {insurancePolicies?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No insurance policies found.</p>
                ) : (
                  <div className="space-y-3">
                    {insurancePolicies.map((policy: any) => (
                      <div key={policy.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{policy.policy_name}</h4>
                              <Badge variant={policy.status === 'active' ? 'default' : 'secondary'}>
                                {policy.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Type:</span> {policy.policy_type}
                              </div>
                              <div>
                                <span className="font-medium">Company:</span> {policy.insurance_company}
                              </div>
                              <div>
                                <span className="font-medium">Policy #:</span> {policy.policy_number}
                              </div>
                              <div>
                                <span className="font-medium">Premium:</span> ${policy.premium_amount}
                              </div>
                              <div>
                                <span className="font-medium">Coverage:</span> ${policy.coverage_amount}
                              </div>
                              <div>
                                <span className="font-medium">Start:</span> {new Date(policy.start_date).toLocaleDateString()}
                              </div>
                              <div>
                                <span className="font-medium">End:</span> {new Date(policy.end_date).toLocaleDateString()}
                              </div>
                              <div>
                                <span className="font-medium">Renewal:</span> {new Date(policy.renewal_date).toLocaleDateString()}
                              </div>
                            </div>
                            {policy.notes && (
                              <div className="mt-2 text-sm text-muted-foreground">
                                <span className="font-medium">Notes:</span> {policy.notes}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEditInsurance(policy)}>
                              <Edit className="size-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteInsurance(policy.id)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Insurance Policy Dialog */}
      <Dialog open={insuranceDialogOpen} onOpenChange={setInsuranceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{editingInsurance ? 'Edit Insurance Policy' : 'Add Insurance Policy'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveInsurance} className="space-y-6 pt-2">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="policyName" className="text-sm font-medium">Policy Name</Label>
                  <Input 
                    id="policyName"
                    value={insuranceForm.policyName} 
                    onChange={e => setInsuranceForm({...insuranceForm, policyName: e.target.value})} 
                    placeholder="Enter policy name"
                    className="h-10"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="policyType" className="text-sm font-medium">Policy Type</Label>
                  <Select value={insuranceForm.policyType} onValueChange={(value) => setInsuranceForm({...insuranceForm, policyType: value})}>
                    <SelectTrigger id="policyType" className="h-10">
                      <SelectValue placeholder="Select policy type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vehicle">🚗 Vehicle Insurance</SelectItem>
                      <SelectItem value="road">🛣️ Road Insurance</SelectItem>
                      <SelectItem value="health">🏥 Health Insurance</SelectItem>
                      <SelectItem value="liability">⚖️ Liability Insurance</SelectItem>
                      <SelectItem value="comprehensive">🛡️ Comprehensive Insurance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insuranceCompany" className="text-sm font-medium">Insurance Company</Label>
                  <Input 
                    id="insuranceCompany"
                    value={insuranceForm.insuranceCompany} 
                    onChange={e => setInsuranceForm({...insuranceForm, insuranceCompany: e.target.value})} 
                    placeholder="Enter insurance company name"
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
                    placeholder="Enter policy number"
                    className="h-10"
                    required 
                  />
                </div>
              </div>
            </div>

            {/* Financial Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Financial Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="coverageAmount" className="text-sm font-medium">Coverage Amount ($)</Label>
                  <Input 
                    id="coverageAmount"
                    type="number" 
                    step="0.01" 
                    value={insuranceForm.coverageAmount} 
                    onChange={e => setInsuranceForm({...insuranceForm, coverageAmount: e.target.value})}
                    placeholder="0.00"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="premiumAmount" className="text-sm font-medium">Premium Amount ($)</Label>
                  <Input 
                    id="premiumAmount"
                    type="number" 
                    step="0.01" 
                    value={insuranceForm.premiumAmount} 
                    onChange={e => setInsuranceForm({...insuranceForm, premiumAmount: e.target.value})}
                    placeholder="0.00"
                    className="h-10"
                    required 
                  />
                </div>
              </div>
            </div>

            {/* Date Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Policy Dates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-sm font-medium flex items-center gap-2">
                    📅 Start Date
                    <span className="text-xs text-muted-foreground">(Policy begins)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="startDate"
                      type="date"
                      value={insuranceForm.startDate ? insuranceForm.startDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : new Date();
                        setInsuranceForm({...insuranceForm, startDate: date});
                      }}
                      className="h-10 pr-10"
                      required
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  {insuranceForm.startDate && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(insuranceForm.startDate), 'EEEE, MMMM d, yyyy')}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-sm font-medium flex items-center gap-2">
                    📆 End Date
                    <span className="text-xs text-muted-foreground">(Policy expires)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="endDate"
                      type="date"
                      value={insuranceForm.endDate ? insuranceForm.endDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : new Date();
                        setInsuranceForm({...insuranceForm, endDate: date});
                      }}
                      min={insuranceForm.startDate ? insuranceForm.startDate.toISOString().split('T')[0] : ''}
                      className="h-10 pr-10"
                      required
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  {insuranceForm.endDate && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(insuranceForm.endDate), 'EEEE, MMMM d, yyyy')}
                    </p>
                  )}
                  {insuranceForm.startDate && insuranceForm.endDate && new Date(insuranceForm.endDate) < new Date(insuranceForm.startDate) && (
                    <p className="text-xs text-red-500 font-medium">⚠️ End date must be after start date</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="renewalDate" className="text-sm font-medium flex items-center gap-2">
                    🔄 Renewal Date
                    <span className="text-xs text-muted-foreground">(Next renewal)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="renewalDate"
                      type="date"
                      value={insuranceForm.renewalDate ? insuranceForm.renewalDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const date = e.target.value ? new Date(e.target.value) : new Date();
                        setInsuranceForm({...insuranceForm, renewalDate: date});
                      }}
                      min={insuranceForm.endDate ? insuranceForm.endDate.toISOString().split('T')[0] : ''}
                      className="h-10 pr-10"
                      required
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  {insuranceForm.renewalDate && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(insuranceForm.renewalDate), 'EEEE, MMMM d, yyyy')}
                    </p>
                  )}
                  {insuranceForm.endDate && insuranceForm.renewalDate && new Date(insuranceForm.renewalDate) < new Date(insuranceForm.endDate) && (
                    <p className="text-xs text-red-500 font-medium">⚠️ Renewal date must be after end date</p>
                  )}
                  {insuranceForm.renewalDate && new Date(insuranceForm.renewalDate) <= new Date() && (
                    <p className="text-xs text-amber-500 font-medium">⏰ Renewal date is in the past</p>
                  )}
                </div>
              </div>
              
              {/* Policy Duration Summary */}
              {insuranceForm.startDate && insuranceForm.endDate && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-900">Policy Duration</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-blue-900">
                        {Math.ceil((new Date(insuranceForm.endDate).getTime() - new Date(insuranceForm.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                      </p>
                      <p className="text-xs text-blue-600">
                        {Math.ceil((new Date(insuranceForm.endDate).getTime() - new Date(insuranceForm.startDate).getTime()) / (1000 * 60 * 60 * 24) / 30.44).toFixed(1)} months
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Renewal Alert */}
              {insuranceForm.renewalDate && new Date(insuranceForm.renewalDate) <= new Date(new Date().setDate(new Date().getDate() + 30)) && (
                <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <span className="font-medium text-amber-900">Renewal Due Soon</span>
                  </div>
                  <p className="text-sm text-amber-700 mt-1">
                    This policy needs renewal within 30 days.
                  </p>
                </div>
              )}
            </div>

            {/* Status and Notes Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Status & Notes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm font-medium">Policy Status</Label>
                  <Select value={insuranceForm.status} onValueChange={(value) => setInsuranceForm({...insuranceForm, status: value})}>
                    <SelectTrigger id="status" className="h-10">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">✅ Active</SelectItem>
                      <SelectItem value="expired">❌ Expired</SelectItem>
                      <SelectItem value="pending">⏳ Pending</SelectItem>
                      <SelectItem value="cancelled">🚫 Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleId" className="text-sm font-medium">Vehicle ID (Optional)</Label>
                  <Input 
                    id="vehicleId"
                    value={insuranceForm.vehicleId} 
                    onChange={e => setInsuranceForm({...insuranceForm, vehicleId: e.target.value})} 
                    placeholder="Enter vehicle ID"
                    className="h-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                <Textarea 
                  id="notes"
                  value={insuranceForm.notes} 
                  onChange={e => setInsuranceForm({...insuranceForm, notes: e.target.value})} 
                  placeholder="Enter any additional notes about this policy..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
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
              >
                {editingInsurance ? 'Update Policy' : 'Add Policy'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Performance Review Dialog */}
      <Dialog open={performanceDialogOpen} onOpenChange={setPerformanceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Add Performance Review</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePerformanceReview} className="space-y-6 pt-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId" className="text-sm font-medium">Employee</Label>
                <Select value={performanceForm.employeeId} onValueChange={(value) => setPerformanceForm({...performanceForm, employeeId: value})} required>
                  <SelectTrigger id="employeeId" className="h-10">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.status !== 'inactive').map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rating" className="text-sm font-medium">Rating (1-5)</Label>
                <Select value={performanceForm.rating} onValueChange={(value) => setPerformanceForm({...performanceForm, rating: value})} required>
                  <SelectTrigger id="rating" className="h-10">
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">⭐ Poor (1)</SelectItem>
                    <SelectItem value="2">⭐⭐ Below Average (2)</SelectItem>
                    <SelectItem value="3">⭐⭐⭐ Average (3)</SelectItem>
                    <SelectItem value="4">⭐⭐⭐⭐ Good (4)</SelectItem>
                    <SelectItem value="5">⭐⭐⭐⭐⭐ Excellent (5)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review" className="text-sm font-medium">Review Notes</Label>
                <Textarea 
                  id="review"
                  value={performanceForm.review}
                  onChange={e => setPerformanceForm({...performanceForm, review: e.target.value})}
                  placeholder="Enter detailed performance review..."
                  rows={4}
                  className="resize-none"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goals" className="text-sm font-medium">Goals & Objectives</Label>
                <Textarea 
                  id="goals"
                  value={performanceForm.goals}
                  onChange={e => setPerformanceForm({...performanceForm, goals: e.target.value})}
                  placeholder="Set goals for next review period..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reviewDate" className="text-sm font-medium">Review Date</Label>
                <div className="relative">
                  <Input
                    id="reviewDate"
                    type="date"
                    value={performanceForm.date ? performanceForm.date.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : new Date();
                      setPerformanceForm({...performanceForm, date});
                    }}
                    className="h-10 pr-10"
                    required
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setPerformanceDialogOpen(false)}
                className="px-6"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="px-6"
              >
                Save Review
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  return (
    <Card className={cn("rounded-2xl border-none shadow-sm", `bg-${color}-50`)}>
      <CardContent className="p-4 pt-6 flex flex-col items-center justify-center text-center gap-2">
        <div className={cn("p-3 rounded-full bg-white shadow-sm", `text-${color}-600`)}>{icon}</div>
        <div>
          <p className={cn("text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground")}>{title}</p>
          <p className={cn("text-3xl font-headline tracking-tighter mt-1", `text-${color}-900`)}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DeptRow({ name, count }: { name: string, count: number }) {
  return (
    <div className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
      <span className="font-medium text-sm text-muted-foreground">{name}</span>
      <Badge variant="secondary" className="font-mono">{count}</Badge>
    </div>
  );
}
