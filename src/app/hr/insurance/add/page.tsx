'use client';

import { useMemo, useState } from 'react';
import type { ChangeEvent, ElementType, FormEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  Globe2,
  Loader2,
  Route,
  ShieldCheck,
  Truck,
  WalletCards,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFleetVehicles } from '@/hooks/data/use-fleet-vehicles';
import { cn } from '@/lib/utils';

const insurers = [
  'Jubilee Insurance',
  'Alliance Insurance',
  'NIC Tanzania',
  'Sanlam General Insurance',
  'Britam Insurance Tanzania',
  'Strategis Insurance',
  'Other',
];

const regionalCountries = ['Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'Burundi', 'DRC', 'Zambia', 'Malawi', 'Mozambique'];

type FormData = {
  vehicle_id: string;
  insurer_name: string;
  policy_number: string;
  policy_type: string;
  tira_reference_number: string;
  start_date: string;
  expiry_date: string;
  annual_premium: string;
  currency: string;
  assigned_driver_id: string;
  route_coverage_area: string;
  covered_countries: string;
  is_cross_border: boolean;
  has_comesa_yellow_card: boolean;
  comesa_yellow_card_number: string;
  comesa_expiry_date: string;
  policy_document_url: string;
  policy_document_name: string;
  notes: string;
};

const initialFormData: FormData = {
  vehicle_id: '',
  insurer_name: '',
  policy_number: '',
  policy_type: 'third_party',
  tira_reference_number: '',
  start_date: '',
  expiry_date: '',
  annual_premium: '',
  currency: 'TZS',
  assigned_driver_id: '',
  route_coverage_area: '',
  covered_countries: 'Tanzania',
  is_cross_border: false,
  has_comesa_yellow_card: false,
  comesa_yellow_card_number: '',
  comesa_expiry_date: '',
  policy_document_url: '',
  policy_document_name: '',
  notes: '',
};

function getVehicleLabel(vehicle: any) {
  const plate = vehicle.plate_number || vehicle.plateNumber || vehicle.id;
  const make = vehicle.make ? ` - ${vehicle.make}` : '';
  const model = vehicle.model ? ` ${vehicle.model}` : '';
  return `${plate}${make}${model}`;
}

function daysBetween(start: string, end: string) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000);
}

export default function AddInsurancePage() {
  const router = useRouter();
  const { vehicles, loading: vehiclesLoading } = useFleetVehicles();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const policyDuration = useMemo(() => daysBetween(formData.start_date, formData.expiry_date), [formData.start_date, formData.expiry_date]);
  const selectedVehicle = vehicles.find((vehicle: any) => vehicle.id === formData.vehicle_id);
  const premiumValue = Number(formData.annual_premium || 0);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = event.target;
    const checked = (event.target as HTMLInputElement).checked;

    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };

      if (name === 'is_cross_border' && !checked) {
        next.has_comesa_yellow_card = false;
        next.comesa_yellow_card_number = '';
        next.comesa_expiry_date = '';
        next.covered_countries = 'Tanzania';
      }

      if (name === 'policy_type' && value === 'cross_border') {
        next.is_cross_border = true;
        next.covered_countries = prev.covered_countries === 'Tanzania' ? 'Tanzania, Kenya, Uganda, Rwanda' : prev.covered_countries;
      }

      return next;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    if (policyDuration !== null && policyDuration < 0) {
      setLoading(false);
      setError('Expiry date must be after the policy start date.');
      return;
    }

    if (formData.is_cross_border && formData.has_comesa_yellow_card && !formData.comesa_yellow_card_number.trim()) {
      setLoading(false);
      setError('COMESA Yellow Card number is required when Yellow Card coverage is selected.');
      return;
    }

    const payload = {
      vehicle_id: formData.vehicle_id,
      insurer_name: formData.insurer_name.trim(),
      policy_number: formData.policy_number.trim() || undefined,
      policy_type: formData.policy_type,
      tira_reference_number: formData.tira_reference_number.trim(),
      start_date: formData.start_date,
      expiry_date: formData.expiry_date,
      annual_premium: Number(formData.annual_premium),
      currency: formData.currency,
      assigned_driver_id: formData.assigned_driver_id.trim() || undefined,
      route_coverage_area: formData.route_coverage_area.trim() || undefined,
      covered_countries: formData.covered_countries
        .split(',')
        .map((country) => country.trim())
        .filter(Boolean),
      is_cross_border: formData.is_cross_border,
      has_comesa_yellow_card: formData.is_cross_border && formData.has_comesa_yellow_card,
      comesa_yellow_card_number: formData.has_comesa_yellow_card ? formData.comesa_yellow_card_number.trim() : undefined,
      comesa_expiry_date: formData.has_comesa_yellow_card && formData.comesa_expiry_date ? formData.comesa_expiry_date : undefined,
      policy_document_url: formData.policy_document_url.trim() || undefined,
      policy_document_name: formData.policy_document_name.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    };

    try {
      const response = await fetch('/api/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to create insurance record');
      }

      router.push('/hr/insurance');
    } catch (err: any) {
      console.error('Error creating insurance:', err);
      setError(err.message || 'Failed to create insurance record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <Link href="/hr/insurance">
              <Button variant="outline" size="icon" aria-label="Back to insurance">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">New Coverage</Badge>
                <Badge className="border-sky-200 bg-sky-50 text-sky-700">Fleet Ready</Badge>
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-slate-950 sm:text-3xl">Register Insurance Policy</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Add verified coverage for dispatch, TIRA compliance, cross-border clearance, and finance tracking.
              </p>
            </div>
          </div>
          <Button form="insurance-policy-form" type="submit" disabled={loading} className="gap-2 bg-slate-950 text-white hover:bg-slate-800">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Save Policy
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <form id="insurance-policy-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            )}

            <FormSection
              icon={Truck}
              title="Fleet Assignment"
              description="Connect this policy to a real truck and optional driver reference."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Vehicle" required>
                  <select name="vehicle_id" value={formData.vehicle_id} onChange={handleChange} required className={fieldClass}>
                    <option value="">{vehiclesLoading ? 'Loading fleet...' : 'Select vehicle'}</option>
                    {vehicles.map((vehicle: any) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {getVehicleLabel(vehicle)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Assigned Driver ID">
                  <input
                    type="text"
                    name="assigned_driver_id"
                    value={formData.assigned_driver_id}
                    onChange={handleChange}
                    className={fieldClass}
                    placeholder="Optional driver UUID"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection icon={ShieldCheck} title="Policy Identity" description="Core insurer, policy, and TIRA registration details.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Insurer" required>
                  <select name="insurer_name" value={formData.insurer_name} onChange={handleChange} required className={fieldClass}>
                    <option value="">Select insurer</option>
                    {insurers.map((insurer) => (
                      <option key={insurer} value={insurer}>
                        {insurer}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Policy Type" required>
                  <select name="policy_type" value={formData.policy_type} onChange={handleChange} required className={fieldClass}>
                    <option value="third_party">Third Party - TIRA Minimum</option>
                    <option value="third_party_cargo">Third Party + Cargo</option>
                    <option value="comprehensive">Comprehensive</option>
                    <option value="cross_border">Cross-Border</option>
                  </select>
                </Field>
                <Field label="TIRA Reference" required>
                  <input
                    type="text"
                    name="tira_reference_number"
                    value={formData.tira_reference_number}
                    onChange={handleChange}
                    required
                    className={fieldClass}
                    placeholder="TZ/2026/123456"
                  />
                </Field>
                <Field label="Policy Number">
                  <input
                    type="text"
                    name="policy_number"
                    value={formData.policy_number}
                    onChange={handleChange}
                    className={fieldClass}
                    placeholder="Insurer policy number"
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection icon={CalendarDays} title="Validity & Premium" description="Dates drive automatic active, expiring, and expired status.">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Start Date" required>
                  <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} required className={fieldClass} />
                </Field>
                <Field label="Expiry Date" required>
                  <input type="date" name="expiry_date" value={formData.expiry_date} onChange={handleChange} required className={fieldClass} />
                </Field>
                <Field label="Currency">
                  <select name="currency" value={formData.currency} onChange={handleChange} className={fieldClass}>
                    <option value="TZS">TZS</option>
                    <option value="USD">USD</option>
                    <option value="KES">KES</option>
                  </select>
                </Field>
                <div className="md:col-span-3">
                  <Field label="Annual Premium" required>
                    <input
                      type="number"
                      name="annual_premium"
                      value={formData.annual_premium}
                      onChange={handleChange}
                      required
                      min="0"
                      step="0.01"
                      className={fieldClass}
                      placeholder="0.00"
                    />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection icon={Globe2} title="Route & Cross-Border Coverage" description="Capture regional operating coverage and COMESA Yellow Card readiness.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Coverage Area">
                  <input
                    type="text"
                    name="route_coverage_area"
                    value={formData.route_coverage_area}
                    onChange={handleChange}
                    className={fieldClass}
                    placeholder="East Africa, domestic, port routes"
                  />
                </Field>
                <Field label="Covered Countries">
                  <input
                    type="text"
                    name="covered_countries"
                    value={formData.covered_countries}
                    onChange={handleChange}
                    className={fieldClass}
                    placeholder="Tanzania, Kenya, Uganda"
                  />
                </Field>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {regionalCountries.map((country) => (
                  <button
                    key={country}
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-slate-400"
                    onClick={() => {
                      setFormData((prev) => {
                        const current = prev.covered_countries.split(',').map((item) => item.trim()).filter(Boolean);
                        if (current.includes(country)) return prev;
                        return { ...prev, covered_countries: [...current, country].join(', ') };
                      });
                    }}
                  >
                    {country}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ToggleRow
                  title="Cross-border operations"
                  detail="Required for regional and transit assignments."
                  checked={formData.is_cross_border}
                  name="is_cross_border"
                  onChange={handleChange}
                />
                <ToggleRow
                  title="COMESA Yellow Card"
                  detail="Needed for compliant cross-border cover."
                  checked={formData.has_comesa_yellow_card}
                  name="has_comesa_yellow_card"
                  onChange={handleChange}
                  disabled={!formData.is_cross_border}
                />
              </div>

              {formData.is_cross_border && formData.has_comesa_yellow_card && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Yellow Card Number" required>
                    <input
                      type="text"
                      name="comesa_yellow_card_number"
                      value={formData.comesa_yellow_card_number}
                      onChange={handleChange}
                      className={fieldClass}
                      placeholder="COMESA reference"
                    />
                  </Field>
                  <Field label="Yellow Card Expiry">
                    <input type="date" name="comesa_expiry_date" value={formData.comesa_expiry_date} onChange={handleChange} className={fieldClass} />
                  </Field>
                </div>
              )}
            </FormSection>

            <FormSection icon={FileText} title="Documents & Notes" description="Attach policy document references and internal context.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Policy Document URL">
                  <input
                    type="url"
                    name="policy_document_url"
                    value={formData.policy_document_url}
                    onChange={handleChange}
                    className={fieldClass}
                    placeholder="https://..."
                  />
                </Field>
                <Field label="Document Name">
                  <input
                    type="text"
                    name="policy_document_name"
                    value={formData.policy_document_name}
                    onChange={handleChange}
                    className={fieldClass}
                    placeholder="Policy PDF"
                  />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Notes">
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    className={cn(fieldClass, 'min-h-28 resize-y')}
                    placeholder="Renewal terms, broker contact, special cargo clauses..."
                  />
                </Field>
              </div>
            </FormSection>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link href="/hr/insurance">
                <Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
              </Link>
              <Button type="submit" disabled={loading} className="w-full gap-2 bg-slate-950 text-white hover:bg-slate-800 sm:w-auto">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save Policy
              </Button>
            </div>
          </form>

          <aside className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Policy Preview</CardTitle>
                <CardDescription>Live compliance snapshot before saving.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <PreviewRow icon={Truck} label="Vehicle" value={selectedVehicle ? getVehicleLabel(selectedVehicle) : 'Not selected'} />
                <PreviewRow icon={ShieldCheck} label="Coverage" value={formData.policy_type.replaceAll('_', ' ')} />
                <PreviewRow icon={CalendarDays} label="Duration" value={policyDuration === null ? 'Waiting for dates' : `${Math.max(policyDuration, 0)} days`} />
                <PreviewRow icon={WalletCards} label="Premium" value={`${formData.currency} ${premiumValue.toLocaleString()}`} />
                <PreviewRow icon={Route} label="Region" value={formData.is_cross_border ? 'Cross-border route ready' : 'Domestic coverage'} />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Compliance Checks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CheckItem ok={!!formData.vehicle_id} label="Vehicle selected" />
                <CheckItem ok={!!formData.tira_reference_number} label="TIRA reference captured" />
                <CheckItem ok={policyDuration === null || policyDuration >= 0} label="Valid date range" />
                <CheckItem ok={!formData.is_cross_border || formData.has_comesa_yellow_card} label="Cross-border Yellow Card" />
                <CheckItem ok={premiumValue > 0} label="Premium amount recorded" />
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

const fieldClass =
  'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none ring-offset-white placeholder:text-slate-400 focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50';

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ElementType;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5 text-slate-700" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function ToggleRow({
  title,
  detail,
  checked,
  disabled,
  name,
  onChange,
}: {
  title: string;
  detail: string;
  checked: boolean;
  disabled?: boolean;
  name: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={cn('flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 p-4', disabled && 'cursor-not-allowed bg-slate-50 opacity-70')}>
      <span>
        <span className="block text-sm font-medium text-slate-800">{title}</span>
        <span className="mt-1 block text-xs text-slate-500">{detail}</span>
      </span>
      <input type="checkbox" name={name} checked={checked} disabled={disabled} onChange={onChange} className="h-5 w-5 rounded border-slate-300" />
    </label>
  );
}

function PreviewRow({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 p-3">
      <Icon className="h-4 w-4 text-slate-500" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="font-medium capitalize text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={cn('flex h-5 w-5 items-center justify-center rounded-full', ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
        {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <span className="text-slate-700">{label}</span>
    </div>
  );
}
