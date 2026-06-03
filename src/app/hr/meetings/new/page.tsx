'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface User {
    id: string;
    email: string;
    name: string | null;
}

export default function NewMeetingPage() {
    const router = useRouter();
    const supabase = createClientComponentClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [employees, setEmployees] = useState<User[]>([]);
    const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        meeting_type: 'staff_meeting',
        scheduled_at: '',
        duration_minutes: 60,
        location: '',
        meeting_link: '',
    });

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('id, email, name')
                    .order('name');

                if (error) throw error;
                setEmployees(data || []);
            } catch (err) {
                console.error('Error fetching employees:', err);
            }
        };

        fetchEmployees();
    }, [supabase]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Create meeting
            const { data: meeting, error: meetingError } = await supabase
                .from('meetings')
                .insert([{
                    title: formData.title,
                    description: formData.description || null,
                    meeting_type: formData.meeting_type,
                    scheduled_at: formData.scheduled_at,
                    duration_minutes: formData.duration_minutes,
                    location: formData.location || null,
                    meeting_link: formData.meeting_link || null,
                    created_by: user.id,
                    status: 'scheduled',
                }])
                .select()
                .single();

            if (meetingError) throw meetingError;

            // Add attendees
            if (selectedAttendees.length > 0) {
                const attendees = selectedAttendees.map(userId => ({
                    meeting_id: meeting.id,
                    user_id: userId,
                    rsvp_status: 'pending',
                }));

                const { error: attendeeError } = await supabase
                    .from('meeting_attendees')
                    .insert(attendees);

                if (attendeeError) throw attendeeError;

                // Create notifications for each attendee
                const notifications = selectedAttendees.map(userId => ({
                    user_id: userId,
                    type: 'meeting_invite',
                    title: 'Meeting Invitation',
                    message: `You have been invited to: ${formData.title} on ${new Date(formData.scheduled_at).toLocaleDateString()}`,
                    data: { meeting_id: meeting.id },
                }));

                await supabase
                    .from('notifications')
                    .insert(notifications);
            }

            (window as any).toast?.success('Meeting created and invitations sent', 'Success', 5000);
            router.push('/hr/meetings');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create meeting');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/hr/meetings">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold">Schedule Meeting</h1>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="title">Meeting Title *</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g., Monthly Team Sync"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="meeting_type">Meeting Type</Label>
                                <Select value={formData.meeting_type} onValueChange={(val) => setFormData({ ...formData, meeting_type: val })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="staff_meeting">Staff Meeting</SelectItem>
                                        <SelectItem value="performance_review">Performance Review</SelectItem>
                                        <SelectItem value="training">Training</SelectItem>
                                        <SelectItem value="disciplinary">Disciplinary</SelectItem>
                                        <SelectItem value="general">General</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="scheduled_at">Date & Time *</Label>
                                <Input
                                    id="scheduled_at"
                                    type="datetime-local"
                                    value={formData.scheduled_at}
                                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                                <Input
                                    id="duration_minutes"
                                    type="number"
                                    value={formData.duration_minutes}
                                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                                    min="15"
                                    max="480"
                                    step="15"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="location">Location</Label>
                                <Input
                                    id="location"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="Conference Room / Office"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="meeting_link">Meeting Link (Optional)</Label>
                            <Input
                                id="meeting_link"
                                type="url"
                                value={formData.meeting_link}
                                onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                                placeholder="https://meet.zoom.us/..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Meeting agenda and objectives"
                                className="min-h-24"
                            />
                        </div>

                        <div className="space-y-3">
                            <Label>Invite Attendees</Label>
                            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-3 border rounded-lg bg-muted/30">
                                {employees.map((emp) => (
                                    <label key={emp.id} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedAttendees.includes(emp.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedAttendees([...selectedAttendees, emp.id]);
                                                } else {
                                                    setSelectedAttendees(selectedAttendees.filter(id => id !== emp.id));
                                                }
                                            }}
                                            className="rounded"
                                        />
                                        <span className="text-sm">{emp.name || emp.email}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">{selectedAttendees.length} attendees selected</p>
                        </div>

                        <div className="flex gap-4 pt-6">
                            <Button type="submit" disabled={loading || !formData.title || !formData.scheduled_at}>
                                {loading ? 'Creating...' : 'Create Meeting'}
                            </Button>
                            <Link href="/hr/meetings">
                                <Button variant="outline">Cancel</Button>
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
