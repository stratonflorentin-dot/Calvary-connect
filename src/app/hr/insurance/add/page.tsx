'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AddInsurancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: '',
    insurer_name: '',
    policy_type: 'third_party',
    tira_reference_number: '',
    start_date: '',
    expiry_date: '',
    annual_premium: '',
    assigned_driver_id: '',
    route_coverage_area: '',
    is_cross_border: false,
    has_comesa_yellow_card: false,
    notes: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          annual_premium: parseFloat(formData.annual_premium),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create insurance record');
      }

      router.push('/hr/insurance');
    } catch (error) {
      console.error('Error creating insurance:', error);
      alert('Failed to create insurance record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/hr/insurance">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Add Insurance Policy</h1>
          <p className="text-gray-600">Register a new truck insurance policy</p>
        </div>
      </div>

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Insurance Policy Details</CardTitle>
          <CardDescription>All fields marked * are required</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Vehicle Selection */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Vehicle ID *
                </label>
                <input
                  type="text"
                  name="vehicle_id"
                  value={formData.vehicle_id}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Vehicle UUID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Assigned Driver
                </label>
                <input
                  type="text"
                  name="assigned_driver_id"
                  value={formData.assigned_driver_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Driver ID"
                />
              </div>
            </div>

            {/* Insurer Details */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Insurer Name *
                </label>
                <select
                  name="insurer_name"
                  value={formData.insurer_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Insurer</option>
                  <option value="Jubilee Insurance">Jubilee Insurance</option>
                  <option value="Alliance Insurance">Alliance Insurance</option>
                  <option value="NIC Tanzania">NIC Tanzania</option>
                  <option value="ILFS">ILFS</option>
                  <option value="AA Tanzania">AA Tanzania</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Policy Type *
                </label>
                <select
                  name="policy_type"
                  value={formData.policy_type}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="third_party">Third Party (TIRA Minimum)</option>
                  <option value="third_party_cargo">Third Party + Cargo</option>
                  <option value="comprehensive">Comprehensive</option>
                  <option value="cross_border">Cross-Border</option>
                </select>
              </div>
            </div>

            {/* TIRA Reference */}
            <div>
              <label className="block text-sm font-medium mb-2">
                TIRA Reference Number *
              </label>
              <input
                type="text"
                name="tira_reference_number"
                value={formData.tira_reference_number}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g., TZ/2024/123456"
              />
              <p className="text-xs text-gray-500 mt-1">Tanzanian Road Agency policy reference</p>
            </div>

            {/* Dates */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Start Date *
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Expiry Date *
                </label>
                <input
                  type="date"
                  name="expiry_date"
                  value={formData.expiry_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            {/* Premium */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Annual Premium (TZS) *
              </label>
              <input
                type="number"
                name="annual_premium"
                value={formData.annual_premium}
                onChange={handleChange}
                required
                step="0.01"
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="0.00"
              />
            </div>

            {/* Coverage Area */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Route / Coverage Area
              </label>
              <input
                type="text"
                name="route_coverage_area"
                value={formData.route_coverage_area}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g., East Africa, Regional, Cross-border"
              />
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_cross_border"
                  checked={formData.is_cross_border}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <span className="text-sm">This truck operates cross-border routes</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="has_comesa_yellow_card"
                  checked={formData.has_comesa_yellow_card}
                  onChange={handleChange}
                  className="w-4 h-4"
                  disabled={!formData.is_cross_border}
                />
                <span className="text-sm">Has COMESA Yellow Card coverage</span>
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                placeholder="Additional information..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4">
              <Link href="/hr/insurance">
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Add Policy'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
