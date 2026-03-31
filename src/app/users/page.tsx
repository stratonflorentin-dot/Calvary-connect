"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Search, Mail, Shield } from 'lucide-react';

export default function UsersPage() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        // Load real data from Supabase
        const { data: usersData } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });
        
        setUsers(usersData || []);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsers();
  }, [user]);

  const filteredUsers = users?.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      const formData = new FormData(e.currentTarget);
      const userData = {
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        role: formData.get('role') as string,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Only CEO and ADMIN can create CEO users
      if (userData.role === 'CEO' && role !== 'CEO' && role !== 'ADMIN') {
        console.error("You don't have permission to create CEO users.");
        return;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .insert([userData])
        .select()
        .single();

      if (error) {
        console.error('Error adding user:', error);
      } else {
        console.log('User added successfully:', data);
        // Refresh users list
        const { data: updatedUsers } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });
        
        setUsers(updatedUsers || []);
        setIsAddDialogOpen(false);
        e.currentTarget.reset();
      }
    } catch (error) {
      console.error('Error adding user:', error);
    }
  };

  if (!['CEO', 'HR'].includes(role || '')) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">User Management</h1>
            <p className="text-muted-foreground text-sm">Add and manage employee access.</p>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full gap-2">
                <UserPlus className="size-4" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Team Member</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddUser} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" name="name" placeholder="Full name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" name="email" type="email" placeholder="john@calvaryconnect.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">System Role</Label>
                  <Select name="role" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {(role === "CEO" || role === "ADMIN") && <SelectItem value="CEO">CEO</SelectItem>}
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="OPERATOR">Operations</SelectItem>
                      <SelectItem value="DRIVER">Driver</SelectItem>
                      <SelectItem value="MECHANIC">Mechanic</SelectItem>
                      <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">Create Account</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border p-0 overflow-hidden">
          <div className="p-4 border-b">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                placeholder="Search users..." 
                className="pl-9 rounded-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">Loading users...</TableCell></TableRow>
              ) : filteredUsers?.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">No users found.</TableCell></TableRow>
              ) : filteredUsers?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-headline tracking-tighter text-[10px]">
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-500">{u.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
