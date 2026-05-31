"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit2, Trash2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchRateSheets, upsertRateSheet, deleteRateSheet, RateSheetRoute } from '@/lib/rate-sheet-service';

export function RateSheetManager() {
    const { toast } = useToast();
    const [rates, setRates] = useState<RateSheetRoute[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<RateSheetRoute>({
        route_name: '',
        origin: 'DAR PORT',
        destination: '',
        container_20ft: 0,
        container_40ft: 0,
        loose_cargo: 0,
        truck_type: 'C28',
        transit_days: 0,
        currency: 'USD',
        is_active: true
    });

    useEffect(() => {
        loadRates();
    }, []);

    const loadRates = async () => {
        setLoading(true);
        try {
            const data = await fetchRateSheets();
            setRates(data);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to load rate sheets', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (rate?: RateSheetRoute) => {
        if (rate) {
            setFormData(rate);
            setEditingId(rate.id || null);
        } else {
            setFormData({
                route_name: '',
                origin: 'DAR PORT',
                destination: '',
                container_20ft: 0,
                container_40ft: 0,
                loose_cargo: 0,
                truck_type: 'C28',
                transit_days: 0,
                currency: 'USD',
                is_active: true
            });
            setEditingId(null);
        }
        setIsOpen(true);
    };

    const handleSave = async () => {
        try {
            if (!formData.route_name || !formData.destination) {
                toast({ title: 'Error', description: 'Route name and destination are required', variant: 'destructive' });
                return;
            }

            await upsertRateSheet({
                ...formData,
                id: editingId || undefined
            });

            toast({ title: 'Success', description: editingId ? 'Route updated' : 'Route created' });
            setIsOpen(false);
            loadRates();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to save rate sheet', variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this route?')) return;
        try {
            await deleteRateSheet(id);
            toast({ title: 'Success', description: 'Route deleted' });
            loadRates();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete rate sheet', variant: 'destructive' });
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Loading rate sheets...</div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle>Manage Transport Routes & Rates</CardTitle>
                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => handleOpenDialog()} className="gap-2">
                                <Plus className="size-4" />
                                Add Route
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editingId ? 'Edit Route' : 'Add New Route'}</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="routeName">Route Name *</Label>
                                        <Input
                                            id="routeName"
                                            value={formData.route_name}
                                            onChange={(e) => setFormData({ ...formData, route_name: e.target.value })}
                                            placeholder="e.g. KIGALI - RWANDA"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="destination">Destination *</Label>
                                        <Input
                                            id="destination"
                                            value={formData.destination}
                                            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                                            placeholder="e.g. Kigali"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="origin">Origin</Label>
                                        <Input
                                            id="origin"
                                            value={formData.origin}
                                            onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                                            placeholder="e.g. DAR PORT"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="truckType">Truck Type</Label>
                                        <Input
                                            id="truckType"
                                            value={formData.truck_type}
                                            onChange={(e) => setFormData({ ...formData, truck_type: e.target.value })}
                                            placeholder="e.g. C28"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Pricing</Label>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor="container20ft" className="text-xs text-gray-600">20ft Container</Label>
                                            <Input
                                                id="container20ft"
                                                type="number"
                                                value={formData.container_20ft}
                                                onChange={(e) => setFormData({ ...formData, container_20ft: Number(e.target.value) })}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="container40ft" className="text-xs text-gray-600">40ft Container</Label>
                                            <Input
                                                id="container40ft"
                                                type="number"
                                                value={formData.container_40ft}
                                                onChange={(e) => setFormData({ ...formData, container_40ft: Number(e.target.value) })}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="looseCargo" className="text-xs text-gray-600">Loose Cargo</Label>
                                            <Input
                                                id="looseCargo"
                                                type="number"
                                                value={formData.loose_cargo}
                                                onChange={(e) => setFormData({ ...formData, loose_cargo: Number(e.target.value) })}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="transitDays">Transit Days</Label>
                                        <Input
                                            id="transitDays"
                                            type="number"
                                            value={formData.transit_days}
                                            onChange={(e) => setFormData({ ...formData, transit_days: Number(e.target.value) })}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="currency">Currency</Label>
                                        <Input
                                            id="currency"
                                            value={formData.currency}
                                            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                            placeholder="USD"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4">
                                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleSave} className="flex-1">
                                        <Save className="size-4 mr-2" />
                                        {editingId ? 'Update Route' : 'Create Route'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Route</TableHead>
                                <TableHead>Destination</TableHead>
                                <TableHead className="text-right">20ft</TableHead>
                                <TableHead className="text-right">40ft</TableHead>
                                <TableHead className="text-right">Loose</TableHead>
                                <TableHead className="text-center">Days</TableHead>
                                <TableHead className="text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rates.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                        No routes configured. Add one to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rates.map((rate) => (
                                    <TableRow key={rate.id}>
                                        <TableCell className="font-medium">{rate.route_name}</TableCell>
                                        <TableCell>{rate.destination}</TableCell>
                                        <TableCell className="text-right">${rate.container_20ft.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">${rate.container_40ft.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">${rate.loose_cargo.toLocaleString()}</TableCell>
                                        <TableCell className="text-center">{rate.transit_days}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex gap-2 justify-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        handleOpenDialog(rate);
                                                    }}
                                                >
                                                    <Edit2 className="size-4 text-blue-600" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => rate.id && handleDelete(rate.id)}
                                                >
                                                    <Trash2 className="size-4 text-red-600" />
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
    );
}
