"use client";

import { useState, useEffect } from 'react';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Camera, X, UserPlus, Search, Trash2, Pencil, RefreshCw, Users, Activity, Clock, User, Shield, AlertTriangle } from 'lucide-react';
import { IndustryRoleShell } from '@/components/role-shell/industry-role-shell';
import { IndustryCard, IndustryCardKicker } from '@/components/industry/card';
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from '@/components/industry/table';
import { IndustryTag } from '@/components/industry/tag';
import { IndustryButton } from '@/components/industry/button';
import {
  IndustryDialog,
  IndustryDialogTrigger,
  IndustryDialogContent,
  IndustryDialogTitle,
} from '@/components/industry/dialog';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'invited' | 'dormant' | 'suspended' | 'inactive';
  status_reason?: string;
  avatar_url?: string;
  created_at: string;
  last_login_at?: string;
  last_activity_at?: string;
  login_count?: number;
  invited_at?: string;
  invited_by?: string;
  employee_id?: string;
  department?: string;
}

import { inviteUserAction, getUsersAction, deleteUserAction, updateUserAction, backfillEmployeeIdsAction } from './actions';
import { uploadToBucket } from '@/lib/storage-upload';
import { resizeImageToJpeg } from '@/lib/image-resize';
import { effectiveUserStatus } from '@/lib/user-status-utils';

const HR_PAGES = [
  { label: "People", href: "/users" },
  { label: "Payroll & allowances", href: "/allowances" },
  { label: "Leave", href: "/hr/leave" },
  { label: "Driver compliance", href: "/admin/hr/driver-compliance" },
];

const fieldClass = "w-full text-[14px] bg-transparent border border-[var(--ci-divider)] px-[10px] py-[7px] outline-none focus-visible:border-[var(--ci-accent)]";

const ROLE_CONFIG: Record<string, { label: string }> = {
  CEO: { label: 'CEO' },
  ADMIN: { label: 'Admin' },
  HR: { label: 'HR' },
  OPERATOR: { label: 'Operations' },
  DRIVER: { label: 'Driver' },
  MECHANIC: { label: 'Mechanic' },
  ACCOUNTANT: { label: 'Accountant' },
  SALESMAN: { label: 'Salesman' },
  CASHIER: { label: 'Cashier' },
};

const STATUS_CONFIG: Record<string, { variant: "accent" | "warning" | "neutral" | "danger"; label: string }> = {
  active: { variant: 'accent', label: 'Active' },
  invited: { variant: 'warning', label: 'Invited' },
  dormant: { variant: 'neutral', label: 'Dormant' },
  suspended: { variant: 'danger', label: 'Suspended' },
  inactive: { variant: 'neutral', label: 'Inactive' },
};

function initials(name: string) {
  return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
}

function Avatar({ url, name, size = 36 }: { url?: string | null; name: string; size?: number }) {
  return (
    <div
      className="shrink-0 border border-[var(--ci-divider)] flex items-center justify-center overflow-hidden bg-[color-mix(in_srgb,var(--ci-text)_5%,transparent)]"
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="ci-mono text-[11px] text-[var(--ci-text-secondary)]">{initials(name)}</span>
      )}
    </div>
  );
}

export default function UsersPage() {
  const { role, isAdmin } = useRole();
  const { user } = useSupabase();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const teamStats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => effectiveUserStatus(u) === 'active').length,
    pendingInvites: users.filter(u => effectiveUserStatus(u) === 'invited').length,
    dormantUsers: users.filter(u => u.status === 'dormant').length,
    driversCount: users.filter(u => u.role === 'DRIVER').length,
    operatorsCount: users.filter(u => u.role === 'OPERATOR').length,
  };

  useEffect(() => {
    const loadUsers = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        const usersData = await getUsersAction();
        setUsers(usersData || []);
      } catch (error: any) {
        console.error('[UsersPage] Exception loading users:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadUsers();
  }, [user, isAdmin]);

  const refresh = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const usersData = await getUsersAction();
      setUsers(usersData || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        alert('Photo must be less than 8MB');
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
      const resized = await resizeImageToJpeg(selectedPhoto).catch(() => null);
      if (!resized) {
        console.error('Error uploading photo: unsupported image format');
        return null;
      }
      return await uploadToBucket('profile-photos', 'avatars', resized, `${userId}.jpg`);
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

  const filteredUsers = users?.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      const userData = {
        id: crypto.randomUUID(),
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        role: formData.get('role') as string,
        department: formData.get('department') as string,
        status: 'invited',
        status_reason: 'Waiting for user to complete signup',
        invited_at: new Date().toISOString(),
        invited_by: (await supabase.auth.getUser()).data?.user?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (userData.role === 'CEO' && role !== 'CEO' && role !== 'ADMIN') {
        console.error("You don't have permission to create CEO users.");
        return;
      }

      let data;
      try {
        data = await inviteUserAction(userData);
      } catch (insertError: any) {
        toast({ title: 'Error', description: insertError.message || 'Failed to invite user. Please try again.', variant: 'destructive' });
        return;
      }

      let avatarUrl = null;
      if (data?.id && selectedPhoto) {
        avatarUrl = await uploadPhoto(data.id);
        if (avatarUrl) {
          await updateUserAction(data.id, { avatar_url: avatarUrl }, user?.id);
        }
      }

      toast({ title: 'Success', description: `Invitation sent to ${userData.email}` });
      const updatedUsers = await getUsersAction();
      setUsers(updatedUsers || []);
      setIsAddDialogOpen(false);
      clearPhoto();
      if (e.currentTarget && typeof e.currentTarget.reset === 'function') {
        e.currentTarget.reset();
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'An unexpected error occurred. Please try again.', variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const userToDelete = users.find(u => u.id === userId);
    if (userToDelete?.role === 'ADMIN') {
      alert('The Admin user cannot be deleted. This account is protected.');
      return;
    }
    if (role === 'HR' && userToDelete?.role === 'CEO') {
      alert('HR cannot delete CEO users. Only CEO or Admin can delete CEO users.');
      return;
    }
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await deleteUserAction(userId);
      const updatedUsers = await getUsersAction();
      setUsers(updatedUsers || []);
    } catch (error: any) {
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
        department: formData.get('department') as string,
        status: newStatus,
        status_reason: formData.get('status_reason') as string,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'active' && editingUser?.status !== 'active') {
        updateData.last_activity_at = new Date().toISOString();
        updateData.status_reason = updateData.status_reason || 'Manually reactivated';
      }

      if (updateData.role === 'CEO' && role !== 'CEO' && role !== 'ADMIN') {
        alert("You don't have permission to assign CEO role.");
        return;
      }
      if (editingUser.role === 'ADMIN' && updateData.role !== 'ADMIN') {
        alert('Cannot change the role of the system Admin.');
        return;
      }

      await updateUserAction(editingUser.id, updateData, user?.id);

      if (selectedPhoto) {
        const avatarUrl = await uploadPhoto(editingUser.id);
        if (avatarUrl) {
          await updateUserAction(editingUser.id, { avatar_url: avatarUrl }, user?.id);
        }
      }

      const updatedUsers = await getUsersAction();
      setUsers(updatedUsers || []);
      setIsEditDialogOpen(false);
      setEditingUser(null);
      clearPhoto();
    } catch (error: any) {
      alert('Failed to update user: ' + error.message);
    }
  };

  const canManage = role === 'CEO' || role === 'ADMIN';

  return (
    <IndustryRoleShell roleLabel="HR" pages={HR_PAGES}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-[12px] text-[var(--ci-text-secondary)]">Add and manage employee access.</p>
        <div className="flex gap-2">
          {canManage && (
            <IndustryButton
              variant="secondary"
              className="gap-1.5"
              onClick={async () => {
                const runBackfill = async (dryRun: boolean) => {
                  try {
                    const results = await backfillEmployeeIdsAction(dryRun);
                    if (results.length === 0) {
                      alert("All employees already have Employee IDs assigned!");
                      return;
                    }
                    const listText = results.map((r: any) => `${r.name} (${r.email}): ${r.oldId || 'None'} → ${r.newId} [${r.department}]`).join('\n');
                    if (dryRun) {
                      const confirmSave = confirm(`DRY-RUN RESULTS (Simulated Employee ID generation):\n\n${listText}\n\nWould you like to write these changes to the database?`);
                      if (confirmSave) await runBackfill(false);
                    } else {
                      alert(`SUCCESS!\n\nSuccessfully saved the following changes to the database:\n\n${listText}`);
                      const updatedUsers = await getUsersAction();
                      setUsers(updatedUsers || []);
                    }
                  } catch (err: any) {
                    alert("Error: " + err.message);
                  }
                };
                await runBackfill(true);
              }}
            >
              <Users className="size-4" /> Backfill IDs
            </IndustryButton>
          )}
          <IndustryButton variant="secondary" onClick={refresh} disabled={isLoading} className="gap-1.5">
            <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} /> Refresh
          </IndustryButton>
          <IndustryDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <IndustryDialogTrigger asChild>
              <IndustryButton variant="primary" className="gap-1.5">
                <UserPlus className="size-4" /> Invite user
              </IndustryButton>
            </IndustryDialogTrigger>
            <IndustryDialogContent open={isAddDialogOpen}>
              <IndustryDialogTitle>Invite new team member</IndustryDialogTitle>
              <form onSubmit={handleAddUser} className="flex flex-col gap-3 mt-2">
                <div>
                  <label className="ci-lbl block mb-1">Full name</label>
                  <input name="name" placeholder="Full name" required className={fieldClass} />
                </div>
                <div>
                  <label className="ci-lbl block mb-1">Email address</label>
                  <input name="email" type="email" placeholder="john@calvaryconnect.com" required className={fieldClass} />
                </div>
                <div>
                  <label className="ci-lbl block mb-1">System role</label>
                  <select name="role" required defaultValue="" className={fieldClass}>
                    <option value="" disabled>Select a role</option>
                    {(role === "CEO" || role === "ADMIN") && <option value="CEO">CEO</option>}
                    <option value="HR">HR</option>
                    <option value="OPERATOR">Operations</option>
                    <option value="DRIVER">Driver</option>
                    <option value="MECHANIC">Mechanic</option>
                    <option value="ACCOUNTANT">Accountant</option>
                    <option value="SALESMAN">Salesman</option>
                    <option value="CASHIER">Cashier</option>
                  </select>
                </div>
                <div>
                  <label className="ci-lbl block mb-1">Department</label>
                  <select name="department" required defaultValue="" className={fieldClass}>
                    <option value="" disabled>Select a department</option>
                    <option value="Operations">Operations (OPS)</option>
                    <option value="Finance">Finance (FIN)</option>
                    <option value="IT">IT</option>
                    <option value="Administration">Administration (ADM)</option>
                    <option value="HR">HR</option>
                    <option value="Workshop">Workshop (WRK)</option>
                    <option value="Sales">Sales (SAL)</option>
                  </select>
                </div>
                <div>
                  <label className="ci-lbl block mb-1">Profile photo</label>
                  <div className="flex items-center gap-3">
                    {photoPreview ? (
                      <div className="relative">
                        <Avatar url={photoPreview} name="U" size={56} />
                        <button type="button" onClick={clearPhoto} className="absolute -top-1.5 -right-1.5 bg-[#8c1d18] text-white p-0.5">
                          <X className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" />
                        <label htmlFor="photo" className="cursor-pointer inline-flex items-center gap-2 border border-[var(--ci-divider)] px-3 py-2 text-[12px] hover:bg-[var(--ci-row-hover)]">
                          <Camera className="size-4" /> Upload photo
                        </label>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--ci-text-tertiary)] mt-1">Max 2MB (JPEG, PNG, WebP)</p>
                </div>
                <p className="text-[11px] text-[var(--ci-text-secondary)] border border-[var(--ci-divider)] p-[10px]">
                  Employee ID will be auto-generated based on the selected department when you save (e.g. OPS-001, FIN-002).
                </p>
                <IndustryButton type="submit" variant="primary" className="w-full" disabled={uploading}>
                  {uploading ? 'Inviting…' : 'Send invitation'}
                </IndustryButton>
              </form>
            </IndustryDialogContent>
          </IndustryDialog>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {[
          { label: "Total users", value: teamStats.totalUsers, icon: Users },
          { label: "Active", value: teamStats.activeUsers, icon: Activity },
          { label: "Pending invites", value: teamStats.pendingInvites, icon: Clock },
          { label: "Dormant", value: teamStats.dormantUsers, icon: User },
          { label: "Drivers", value: teamStats.driversCount, icon: Shield },
          { label: "Operators", value: teamStats.operatorsCount, icon: AlertTriangle },
        ].map((s) => (
          <IndustryCard key={s.label} className="gap-1">
            <IndustryCardKicker>{s.label}</IndustryCardKicker>
            <p className="ci-mono text-[22px] font-bold leading-none">{s.value}</p>
          </IndustryCard>
        ))}
      </div>

      <IndustryDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <IndustryDialogContent open={isEditDialogOpen}>
          <IndustryDialogTitle>Edit user</IndustryDialogTitle>
          <form onSubmit={handleEditUser} className="flex flex-col gap-3 mt-2">
            {editingUser?.employee_id && (
              <div>
                <label className="ci-lbl block mb-1">Employee ID</label>
                <input type="text" value={editingUser.employee_id} readOnly className={fieldClass + " ci-mono opacity-60 cursor-not-allowed"} />
                <p className="text-[10px] text-[var(--ci-text-tertiary)] mt-1">Auto-generated. Cannot be changed.</p>
              </div>
            )}
            <div>
              <label className="ci-lbl block mb-1">Full name</label>
              <input name="name" defaultValue={editingUser?.name} placeholder="Full name" required className={fieldClass} />
            </div>
            <div>
              <label className="ci-lbl block mb-1">Email address</label>
              <input name="email" type="email" defaultValue={editingUser?.email} placeholder="john@calvaryconnect.com" required className={fieldClass} />
            </div>
            <div>
              <label className="ci-lbl block mb-1">System role</label>
              <select name="role" defaultValue={editingUser?.role} required className={fieldClass}>
                {(role === "CEO" || role === "ADMIN") && <option value="CEO">CEO</option>}
                <option value="ADMIN">Admin</option>
                <option value="HR">HR</option>
                <option value="OPERATOR">Operations</option>
                <option value="DRIVER">Driver</option>
                <option value="MECHANIC">Mechanic</option>
                <option value="ACCOUNTANT">Accountant</option>
                <option value="SALESMAN">Salesman</option>
                <option value="CASHIER">Cashier</option>
              </select>
            </div>
            <div>
              <label className="ci-lbl block mb-1">Department</label>
              <select name="department" defaultValue={editingUser?.department || 'Operations'} className={fieldClass}>
                <option value="Operations">Operations</option>
                <option value="Finance">Finance</option>
                <option value="IT">IT</option>
                <option value="Administration">Administration</option>
                <option value="HR">HR</option>
                <option value="Workshop">Workshop</option>
                <option value="Sales">Sales</option>
              </select>
            </div>
            <div>
              <label className="ci-lbl block mb-1">Status</label>
              <select name="status" defaultValue={editingUser?.status || 'active'} required className={fieldClass}>
                <option value="active">Active — Currently using system</option>
                <option value="invited">Invited — Pre-added, pending signup</option>
                <option value="dormant">Dormant — No activity for 30+ days</option>
                <option value="suspended">Suspended — Access revoked</option>
                <option value="inactive">Inactive — Manually deactivated</option>
              </select>
            </div>
            <div>
              <label className="ci-lbl block mb-1">Status reason (optional)</label>
              <input name="status_reason" defaultValue={editingUser?.status_reason} placeholder="e.g., No login for 45 days, left company, etc." className={fieldClass} />
            </div>
            <div>
              <label className="ci-lbl block mb-1">Profile photo</label>
              <div className="flex items-center gap-3">
                {photoPreview ? (
                  <div className="relative">
                    <Avatar url={photoPreview} name={editingUser?.name || 'U'} size={56} />
                    <button type="button" onClick={clearPhoto} className="absolute -top-1.5 -right-1.5 bg-[#8c1d18] text-white p-0.5">
                      <X className="size-3" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input id="edit-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" />
                    <label htmlFor="edit-photo" className="cursor-pointer inline-flex items-center gap-2 border border-[var(--ci-divider)] px-3 py-2 text-[12px] hover:bg-[var(--ci-row-hover)]">
                      <Camera className="size-4" /> Change photo
                    </label>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-[var(--ci-text-tertiary)] mt-1">Max 2MB (JPEG, PNG, WebP)</p>
            </div>
            <IndustryButton type="submit" variant="primary" className="w-full" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Update user'}
            </IndustryButton>
          </form>
        </IndustryDialogContent>
      </IndustryDialog>

      <IndustryCard>
        <div className="relative max-w-sm">
          <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 size-3.5 text-[var(--ci-text-tertiary)]" />
          <input
            placeholder="Search users…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={fieldClass + " pl-8"}
          />
        </div>
        <IndustryTable>
          <thead>
            <tr>
              <IndustryTh>Employee ID</IndustryTh>
              <IndustryTh>User</IndustryTh>
              <IndustryTh>Role</IndustryTh>
              <IndustryTh>Status</IndustryTh>
              <IndustryTh>Joined</IndustryTh>
              <IndustryTh align="right">Actions</IndustryTh>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><IndustryTd colSpan={6} className="text-center text-[var(--ci-text-tertiary)]">Loading users…</IndustryTd></tr>
            ) : filteredUsers?.length === 0 ? (
              <tr><IndustryTd colSpan={6} className="text-center text-[var(--ci-text-tertiary)]">No users found.</IndustryTd></tr>
            ) : (
              filteredUsers?.map((u) => {
                const displayStatus = effectiveUserStatus(u);
                const statusCfg = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.active;
                const showReason = u.status_reason && displayStatus !== 'active';
                return (
                  <IndustryTr key={u.id}>
                    <IndustryTd mono>{u.employee_id || '—'}</IndustryTd>
                    <IndustryTd>
                      <div className="flex items-center gap-2.5">
                        <Avatar url={u.avatar_url} name={u.name} />
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium">{u.name}</span>
                          <span className="text-[11px] text-[var(--ci-text-tertiary)]">{u.email}</span>
                        </div>
                      </div>
                    </IndustryTd>
                    <IndustryTd><IndustryTag variant="neutral">{ROLE_CONFIG[u.role]?.label || u.role}</IndustryTag></IndustryTd>
                    <IndustryTd>
                      <div className="flex flex-col gap-0.5">
                        <IndustryTag variant={statusCfg.variant} pulse={displayStatus === 'active'}>{statusCfg.label}</IndustryTag>
                        {showReason && <span className="text-[10px] text-[var(--ci-text-tertiary)] max-w-[150px] truncate" title={u.status_reason}>{u.status_reason}</span>}
                        {displayStatus === 'active' && u.last_login_at && (
                          <span className="text-[10px] text-[var(--ci-text-tertiary)] ci-mono">Last login {new Date(u.last_login_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </IndustryTd>
                    <IndustryTd mono className="text-[11px]">
                      <div className="flex flex-col gap-0.5">
                        <span>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                        {(u.login_count ?? 0) > 0 && <span className="text-[var(--ci-text-tertiary)]">{u.login_count} logins</span>}
                      </div>
                    </IndustryTd>
                    <IndustryTd align="right">
                      <div className="flex justify-end gap-1">
                        {canManage && (
                          <IndustryButton variant="ghost" onClick={() => { setEditingUser(u); setIsEditDialogOpen(true); }}>
                            <Pencil className="size-3.5" />
                          </IndustryButton>
                        )}
                        {u.role !== 'ADMIN' && u.role !== 'CEO' && (
                          <IndustryButton variant="ghost" onClick={() => handleDeleteUser(u.id)} className="text-[#8c1d18]">
                            <Trash2 className="size-3.5" />
                          </IndustryButton>
                        )}
                      </div>
                    </IndustryTd>
                  </IndustryTr>
                );
              })
            )}
          </tbody>
        </IndustryTable>
      </IndustryCard>
    </IndustryRoleShell>
  );
}
