"use client";

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomTabs } from '@/components/navigation/bottom-tabs';
import { RoleSelector } from '@/components/dashboard/role-selector';
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
import { Camera, Upload, X, UserPlus, Search, Trash2, Pencil, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'invited' | 'dormant' | 'suspended' | 'inactive';
  status_reason?: string;
  password?: string;
  avatar_url?: string;
  created_at: string;
  last_login_at?: string;
  last_activity_at?: string;
  login_count?: number;
  invited_at?: string;
  invited_by?: string;
}

export default function UsersPage() {
  const { role, isAdmin } = useRole();
  const { user } = useSupabase();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      console.log('[UsersPage] Loading users... user:', user?.email, 'isAdmin:', isAdmin);
      
      if (!user) {
        console.log('[UsersPage] No user available, skipping load');
        return;
      }
      
      try {
        setIsLoading(true);
        console.log('[UsersPage] Fetching from user_profiles...');
        
        // Fetch all users
        const { data: usersData, error } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('[UsersPage] Error loading users:', error);
          console.error('[UsersPage] Error details:', error.message, error.details);
          // Try fetching without ordering as fallback
          console.log('[UsersPage] Trying fallback query...');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('user_profiles')
            .select('id, email, name, role, status, created_at, avatar_url, last_login_at, login_count, status_reason');
          
          if (fallbackError) {
            console.error('[UsersPage] Fallback also failed:', fallbackError);
          } else {
            console.log('[UsersPage] Fallback succeeded, loaded:', fallbackData?.length || 0);
            setUsers(fallbackData || []);
          }
        } else {
          console.log('[UsersPage] Loaded users:', usersData?.length || 0);
          if (usersData && usersData.length > 0) {
            console.log('[UsersPage] First user:', usersData[0].email, usersData[0].name);
          }
          setUsers(usersData || []);
        }
      } catch (error: any) {
        console.error('[UsersPage] Exception loading users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsers();
  }, [user, isAdmin]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Photo must be less than 2MB');
        return;
      }
      setSelectedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const uploadPhoto = async (userId: string): Promise<string | null> => {
    if (!selectedPhoto) return null;
    
    try {
      setUploading(true);
      const fileExt = selectedPhoto.name.split('.').pop();
      const fileName = `${userId}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, selectedPhoto, { upsert: true });
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);
        
      return publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const clearPhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

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
        status: 'invited',
        status_reason: 'Waiting for user to complete signup',
        invited_at: new Date().toISOString(),
        invited_by: user?.id,
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
        return;
      }

      // Upload photo if selected
      let avatarUrl = null;
      if (data?.id && selectedPhoto) {
        avatarUrl = await uploadPhoto(data.id);
        if (avatarUrl) {
          await supabase
            .from('user_profiles')
            .update({ avatar_url: avatarUrl })
            .eq('id', data.id);
        }
      }

      console.log('User added successfully:', data);
      // Refresh users list
      const { data: updatedUsers } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      setUsers(updatedUsers || []);
      setIsAddDialogOpen(false);
      clearPhoto();
      e.currentTarget.reset();
    } catch (error) {
      console.error('Error adding user:', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // Find the user being deleted
    const userToDelete = users.find(u => u.id === userId);
    
    // No role can delete ADMIN users
    if (userToDelete?.role === 'ADMIN') {
      alert('The Admin user cannot be deleted. This account is protected.');
      return;
    }
    
    // HR cannot delete CEO users
    if (role === 'HR' && userToDelete?.role === 'CEO') {
      alert('HR cannot delete CEO users. Only CEO or Admin can delete CEO users.');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      // Hard delete - remove user completely
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);
        
      if (error) throw error;
      
      // Refresh users list
      const { data: updatedUsers } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      setUsers(updatedUsers || []);
      console.log('User deleted successfully');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user: ' + error.message);
    }
  };

  const handleEditUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const formData = new FormData(e.currentTarget);
      const newStatus = formData.get('status') as string;
      const updateData: any = {
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        role: formData.get('role') as string,
        status: newStatus,
        status_reason: formData.get('status_reason') as string,
        updated_at: new Date().toISOString(),
      };
      
      // If reactivating a user, update activity timestamp
      if (newStatus === 'active' && editingUser?.status !== 'active') {
        updateData.last_activity_at = new Date().toISOString();
        updateData.status_reason = updateData.status_reason || 'Manually reactivated';
      }

      // Only CEO and ADMIN can change role to CEO
      if (updateData.role === 'CEO' && role !== 'CEO' && role !== 'ADMIN') {
        alert("You don't have permission to assign CEO role.");
        return;
      }

      // Prevent changing ADMIN user role/status (for protection)
      if (editingUser.role === 'ADMIN' && updateData.role !== 'ADMIN') {
        alert('Cannot change the role of the system Admin.');
        return;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', editingUser.id);

      if (error) throw error;

      // Upload new photo if selected
      if (selectedPhoto) {
        const avatarUrl = await uploadPhoto(editingUser.id);
        if (avatarUrl) {
          await supabase
            .from('user_profiles')
            .update({ avatar_url: avatarUrl })
            .eq('id', editingUser.id);
        }
      }

      // Refresh users list
      const { data: updatedUsers } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      setUsers(updatedUsers || []);
      setIsEditDialogOpen(false);
      setEditingUser(null);
      clearPhoto();
      console.log('User updated successfully');
    } catch (error: any) {
      console.error('Error updating user:', error);
      alert('Failed to update user: ' + error.message);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-headline tracking-tighter">User Management</h1>
            <p className="text-muted-foreground text-sm">Add and manage employee access.</p>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="rounded-full gap-2"
              onClick={() => {
                console.log('[UsersPage] Manual refresh triggered');
                // Force reload users
                const loadUsers = async () => {
                  if (!user) return;
                  try {
                    setIsLoading(true);
                    const { data: usersData, error } = await supabase
                      .from('user_profiles')
                      .select('*')
                      .order('created_at', { ascending: false });
                    
                    if (error) {
                      console.error('[UsersPage] Refresh error:', error);
                      alert('Error loading users: ' + error.message);
                    } else {
                      console.log('[UsersPage] Refreshed, loaded:', usersData?.length || 0);
                      setUsers(usersData || []);
                    }
                  } catch (error: any) {
                    console.error('[UsersPage] Refresh exception:', error);
                    alert('Error: ' + error.message);
                  } finally {
                    setIsLoading(false);
                  }
                };
                loadUsers();
              }}
            >
              <RefreshCw className="size-4" /> Refresh
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full gap-2">
                  <UserPlus className="size-4" /> Invite User
                </Button>
              </DialogTrigger>
              <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New Team Member</DialogTitle>
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
                <div className="space-y-2">
                  <Label htmlFor="photo">Profile Photo</Label>
                  <div className="flex items-center gap-4">
                    {photoPreview ? (
                      <div className="relative">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={photoPreview} />
                          <AvatarFallback>U</AvatarFallback>
                        </Avatar>
                        <button
                          type="button"
                          onClick={clearPhoto}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          id="photo"
                          name="photo"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                        <Label
                          htmlFor="photo"
                          className="cursor-pointer flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted"
                        >
                          <Camera className="h-4 w-4" />
                          <span>Upload Photo</span>
                        </Label>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Max 2MB (JPEG, PNG, WebP)</p>
                </div>
                <Button type="submit" className="w-full" disabled={uploading}>
                  {uploading ? 'Inviting...' : 'Send Invitation'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>

          {/* Edit User Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditUser} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input id="edit-name" name="name" defaultValue={editingUser?.name} placeholder="Full name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email Address</Label>
                  <Input id="edit-email" name="email" type="email" defaultValue={editingUser?.email} placeholder="john@calvaryconnect.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">System Role</Label>
                  <Select name="role" defaultValue={editingUser?.role} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {(role === "CEO" || role === "ADMIN") && <SelectItem value="CEO">CEO</SelectItem>}
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="OPERATOR">Operations</SelectItem>
                      <SelectItem value="DRIVER">Driver</SelectItem>
                      <SelectItem value="MECHANIC">Mechanic</SelectItem>
                      <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select name="status" defaultValue={editingUser?.status || 'active'} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span>Active - Currently using system</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="invited">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                          <span>Invited - Pre-added, pending signup</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="dormant">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                          <span>Dormant - No activity for 30+ days</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="suspended">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span>Suspended - Access revoked</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="inactive">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                          <span>Inactive - Manually deactivated</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status-reason">Status Reason (Optional)</Label>
                  <Input 
                    id="edit-status-reason" 
                    name="status_reason" 
                    defaultValue={editingUser?.status_reason} 
                    placeholder="e.g., No login for 45 days, left company, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-photo">Profile Photo</Label>
                  <div className="flex items-center gap-4">
                    {photoPreview ? (
                      <div className="relative">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={photoPreview} />
                          <AvatarFallback>{getInitials(editingUser?.name || 'U')}</AvatarFallback>
                        </Avatar>
                        <button
                          type="button"
                          onClick={clearPhoto}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          id="edit-photo"
                          name="photo"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                        <Label
                          htmlFor="edit-photo"
                          className="cursor-pointer flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted"
                        >
                          <Camera className="h-4 w-4" />
                          <span>Change Photo</span>
                        </Label>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Max 2MB (JPEG, PNG, WebP)</p>
                </div>
                <Button type="submit" className="w-full" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Update User'}
                </Button>
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
                {(role === 'CEO' || role === 'ADMIN') && <TableHead>Password</TableHead>}
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={(role === 'CEO' || role === 'ADMIN') ? 6 : 5} className="text-center py-8">Loading users...</TableCell></TableRow>
              ) : filteredUsers?.length === 0 ? (
                <TableRow><TableCell colSpan={(role === 'CEO' || role === 'ADMIN') ? 6 : 5} className="text-center py-8">No users found.</TableCell></TableRow>
              ) : filteredUsers?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{u.name}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  {(role === 'CEO' || role === 'ADMIN') && (
                    <TableCell>
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono text-slate-600">
                        {u.password || 'N/A'}
                      </code>
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant="outline" className="font-headline tracking-tighter text-[10px]">
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const statusConfig = {
                        active: { bg: 'bg-emerald-500', text: 'text-white', label: 'Active' },
                        invited: { bg: 'bg-amber-400', text: 'text-slate-900', label: 'Invited' },
                        dormant: { bg: 'bg-slate-400', text: 'text-white', label: 'Dormant' },
                        suspended: { bg: 'bg-red-500', text: 'text-white', label: 'Suspended' },
                        inactive: { bg: 'bg-gray-300', text: 'text-slate-700', label: 'Inactive' }
                      };
                      const config = statusConfig[u.status as keyof typeof statusConfig] || statusConfig.active;
                      return (
                        <div className="flex flex-col gap-1">
                          <Badge className={`${config.bg} ${config.text} text-xs font-medium`}>
                            {config.label}
                          </Badge>
                          {u.status_reason && (
                            <span className="text-[10px] text-muted-foreground max-w-[150px] truncate" title={u.status_reason}>
                              {u.status_reason}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <div className="flex flex-col gap-1">
                      <span>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                      {u.last_login_at && (
                        <span className="text-[10px] text-slate-500">
                          Login: {new Date(u.last_login_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                      {(u.login_count ?? 0) > 0 && (
                        <span className="text-[10px] text-slate-400">
                          {u.login_count} logins
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {(role === 'CEO' || role === 'ADMIN') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingUser(u);
                            setIsEditDialogOpen(true);
                          }}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {u.role !== 'ADMIN' && u.role !== 'CEO' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
      <BottomTabs role={role!} />
      <RoleSelector />
    </div>
  );
}




