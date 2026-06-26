'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/use-role';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Calendar, Plus, Clock, MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Meeting {
    id: string;
    title: string;
    description: string | null;
    meeting_type: string;
    scheduled_at: string;
    duration_minutes: number;
    location: string | null;
    meeting_link: string | null;
    status: string;
    created_by: string | null;
}

export default function MeetingsPage() {
    const { isAdmin } = useRole();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('upcoming');

    useEffect(() => {
        const fetchMeetings = async () => {
            try {
                const now = new Date().toISOString();
                const { data, error } = await supabase
                    .from('meetings')
                    .select('*')
                    .order('scheduled_at', { ascending: false });

                if (error) throw error;
                setMeetings(data || []);
            } catch (err) {
                console.error('Error fetching meetings:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMeetings();

        // Subscribe to real-time updates
        const channel = supabase
            .channel('meetings-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => {
                fetchMeetings();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    const now = new Date();
    const upcoming = meetings.filter(m => new Date(m.scheduled_at) > now && m.status !== 'cancelled');
    const past = meetings.filter(m => new Date(m.scheduled_at) <= now || m.status === 'cancelled');

    const getMeetingTypeColor = (type: string) => {
        switch (type) {
            case 'staff_meeting': return 'bg-primary/10 text-primary dark:bg-primary/20';
            case 'performance_review': return 'bg-accent/10 text-accent dark:bg-accent/20';
            case 'training': return 'bg-success/10 text-success dark:bg-success/20';
            case 'disciplinary': return 'bg-destructive/10 text-destructive dark:bg-destructive/20';
            default: return 'bg-muted/50 text-muted-foreground dark:bg-muted/20';
        }
    };

    const renderMeetingsList = (meetingList: Meeting[]) => {
        if (meetingList.length === 0) {
            return <div className="text-center py-8 text-muted-foreground">No meetings</div>;
        }

        return (
            <div className="space-y-4">
                {meetingList.map((meeting) => (
                    <Link key={meeting.id} href={`/hr/meetings/${meeting.id}`}>
                        <Card className="hover:shadow-md transition-shadow cursor-pointer">
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-semibold text-foreground">{meeting.title}</h3>
                                            <Badge className={getMeetingTypeColor(meeting.meeting_type)}>
                                                {meeting.meeting_type.replace('_', ' ')}
                                            </Badge>
                                            <Badge variant="outline">{meeting.status}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-3">{meeting.description}</p>
                                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4" />
                                                {format(new Date(meeting.scheduled_at), 'MMM dd, yyyy HH:mm')}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4" />
                                                {meeting.duration_minutes} mins
                                            </div>
                                            {meeting.location && (
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4" />
                                                    {meeting.location}
                                                </div>
                                            )}
                                            {meeting.meeting_link && (
                                                <div className="flex items-center gap-2 text-primary">
                                                    <Users className="w-4 h-4" />
                                                    Virtual
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" className="text-primary">
                                        View →
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        );
    };

    if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Access denied</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                        <Calendar className="w-8 h-8 text-primary" />
                        Meetings
                    </h1>
                    <p className="text-muted-foreground mt-1">Schedule and manage team meetings</p>
                </div>
                <Link href="/hr/meetings/new">
                    <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        New Meeting
                    </Button>
                </Link>
            </div>

            {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading meetings...</div>
            ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
                        <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="upcoming" className="mt-6">
                        {renderMeetingsList(upcoming)}
                    </TabsContent>
                    <TabsContent value="past" className="mt-6">
                        {renderMeetingsList(past)}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
