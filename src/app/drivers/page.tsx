"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageShell } from "@/components/shell";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUsersAction } from "@/app/users/actions";
import { getListStagger, listItem } from "@/lib/animations";

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
        <PageShell>
            <div className="max-w-4xl mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle>Drivers</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-4">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div key={i} className="cv-skeleton h-16 rounded-lg" />
                                    ))}
                                </div>
                            ) : drivers.length === 0 ? (
                                <div className="text-center py-8">No drivers found.</div>
                            ) : (
                                <motion.div
                                    variants={{ hidden: {}, visible: { transition: { staggerChildren: getListStagger(drivers.length) } } }}
                                    initial="hidden"
                                    animate="visible"
                                    className="space-y-4"
                                >
                                    {drivers.map((driver) => (
                                        <motion.div key={driver.id} variants={listItem} whileHover={{ y: -1 }} className="border rounded-lg p-4 flex items-center gap-4">
                                            <div className="flex-1">
                                                <div className="font-semibold">{driver.name}</div>
                                                <div className="text-xs text-muted-foreground">{driver.email}</div>
                                            </div>
                                            <Badge variant="secondary">{driver.status || "Active"}</Badge>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )}
                        </CardContent>
                    </Card>
                </div>
        </PageShell>
    );
}
