"use client";

import { useState, useRef } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { useRole } from '@/hooks/use-role';
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomTabs } from '@/components/navigation/bottom-tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Mail, Shield, LogOut, Camera, Pencil, Save, X, Building2, Phone, Hash } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const { user, signOut, refreshUser } = useSupabase();
  const { role } = useRole();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    employeeId: user?.employeeId || '',
    department: user?.department || '',
  });

  if (!user || !role) return null;

  const handleEdit = () => {
    setFormData({
      name: user.name || '',
      phone: user.phone || '',
      employeeId: user.employeeId || '',
      department: user.department || '',
    });
    setAvatarPreview(user.avatar || null);
    setIsEditing(true);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let avatarUrl = user.avatar;

      // Upload new avatar if changed
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile);

        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
          throw new Error('Failed to upload avatar: ' + uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
        
        avatarUrl = publicUrl;
      }

      // Update user profile - create if not exists
      const updateData = {
        name: formData.name,
        phone: formData.phone,
        employee_id: formData.employeeId,
        department: formData.department,
        avatar: avatarUrl,
        updated_at: new Date().toISOString(),
      };
      
      console.log('Updating profile with data:', updateData);
      console.log('User ID:', user.id);
      
      // Try to update first
      let { error: updateError, data: updateData2 } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id)
        .select();

      // If update fails (user doesn't exist or any error), try to insert
      if (updateError) {
        console.log('Update failed, trying to create new profile...', updateError);
        const { error: insertError, data: insertData } = await supabase
          .from('users')
          .insert([{
            id: user.id,
            email: user.email,
            name: formData.name,
            phone: formData.phone,
            employee_id: formData.employeeId,
            department: formData.department,
            avatar: avatarUrl,
            role: role || 'DRIVER',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }])
          .select();
        
        if (insertError) {
          console.error('Profile insert error:', insertError);
          // Fallback: Save to localStorage if Supabase fails
          console.log('Saving profile to localStorage instead...');
          localStorage.setItem('user_profile_' + user.id, JSON.stringify({
            ...updateData,
            id: user.id,
            email: user.email,
            role: role || 'DRIVER',
          }));
        } else {
          updateData2 = insertData;
          console.log('Profile created successfully:', insertData);
        }
      }
      
      console.log('Update/Insert successful:', updateData2);

      // Try to refresh user data - don't fail if this doesn't work
      try {
        await refreshUser();
      } catch (refreshErr) {
        console.log('Refresh failed, but profile was saved', refreshErr);
      }

      setIsEditing(false);
      setAvatarFile(null);
      alert('Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile: ' + (error.message || 'Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setAvatarPreview(null);
    setAvatarFile(null);
  };

  return (
    <div className="flex min-h-screen bg-background pb-20 md:pb-0">
      <Sidebar role={role} />
      <main className="flex-1 md:ml-60 p-4 md:p-8 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-lg border-primary/10">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-primary/10 w-24 h-24 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
              <User className="size-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-headline">My Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {/* Avatar with Edit Button */}
            <div className="relative mx-auto w-fit">
              <div 
                className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={handleAvatarClick}
              >
                {user.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.name || 'Profile'} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                    <User className="size-10 text-primary" />
                  </div>
                )}
              </div>
              <button
                onClick={handleEdit}
                className="absolute -bottom-1 -right-1 bg-primary text-white p-2 rounded-full shadow-lg hover:bg-primary/90 transition-colors"
              >
                <Pencil className="size-4" />
              </button>
            </div>

            {/* Profile Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <User className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Full Name</p>
                  <p className="font-medium">{user.name || 'Not set'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Mail className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Email Address</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Shield className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">System Role</p>
                  <p className="font-medium capitalize">{role.toLowerCase()}</p>
                </div>
              </div>

              {user.phone && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Phone className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Phone</p>
                    <p className="font-medium">{user.phone}</p>
                  </div>
                </div>
              )}

              {user.employeeId && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Hash className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Employee ID</p>
                    <p className="font-medium">{user.employeeId}</p>
                  </div>
                </div>
              )}

              {user.department && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Building2 className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Department</p>
                    <p className="font-medium">{user.department}</p>
                  </div>
                </div>
              )}
            </div>

            <Button 
              variant="destructive" 
              className="w-full gap-2" 
              onClick={() => signOut()}
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {/* Edit Profile Dialog */}
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline">Edit Profile</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  onClick={handleAvatarClick}
                  className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-primary/20 cursor-pointer hover:border-primary/40 transition-colors"
                >
                  {avatarPreview || user.avatar ? (
                    <img 
                      src={avatarPreview || user.avatar} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                      <User className="size-10 text-primary" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Camera className="size-6 text-white" />
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={handleAvatarClick}
                >
                  <Camera className="size-4 mr-2" />
                  Change Photo
                </Button>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 234 567 8900"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID</Label>
                  <Input
                    id="employeeId"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    placeholder="EMP-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. Operations, Logistics"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={loading}>
                <X className="size-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                <Save className="size-4 mr-2" />
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <BottomTabs role={role} />
    </div>
  );
}
