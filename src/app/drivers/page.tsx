"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUsersAction } from "@/app/users/actions";

export default function DriversPage() {
    const { role } = useRole();
    const { user } = useSupabase();
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDrivers = async () => {
            setLoading(true);
            try {
                const allUsers = await getUsersAction();
                const driversData = allUsers?.filter((u: any) => u.role === 'DRIVER') || [];
                setDrivers(driversData);
            } catch (error) {
                console.error("Error loading drivers:", error);
                setDrivers([]);
            } finally {
                setLoading(false);
            }
        };
        loadDrivers();
    }, []);

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar role={role!} />
            <main className="flex-1 md:ml-60 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle>Drivers</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-center py-8">Loading drivers...</div>
                            ) : drivers.length === 0 ? (
                                <div className="text-center py-8">No drivers found.</div>
                            ) : (
                                <div className="space-y-4">
                                    {drivers.map((driver) => (
                                        <div key={driver.id} className="border rounded-lg p-4 flex items-center gap-4">
                                            <div className="flex-1">
                                                <div className="font-semibold">{driver.name}</div>
                                                <div className="text-xs text-muted-foreground">{driver.email}</div>
                                            </div>
                                            <Badge variant="secondary">{driver.status || "Active"}</Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
