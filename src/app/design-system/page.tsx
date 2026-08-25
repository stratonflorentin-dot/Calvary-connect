'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell, PageHeader, PageSection } from '@/components/design/page-shell';
import { KpiCard, EmptyState } from '@/components/design/kpi-card';
import { cn } from '@/lib/utils';
import {
  Truck,
  Users,
  Fuel,
  Wrench,
  ArrowRight,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  LayoutDashboard,
  Palette,
  Type,
  Layers,
} from 'lucide-react';

const colors = [
  { name: 'Primary', class: 'bg-primary', text: 'text-primary-foreground', label: '--primary' },
  { name: 'Secondary', class: 'bg-secondary', text: 'text-secondary-foreground', label: '--secondary' },
  { name: 'Accent', class: 'bg-accent', text: 'text-accent-foreground', label: '--accent' },
  { name: 'Success', class: 'bg-success', text: 'text-success-foreground', label: '--success' },
  { name: 'Warning', class: 'bg-warning', text: 'text-warning-foreground', label: '--warning' },
  { name: 'Destructive', class: 'bg-destructive', text: 'text-destructive-foreground', label: '--destructive' },
  { name: 'Muted', class: 'bg-muted', text: 'text-muted-foreground', label: '--muted' },
  { name: 'Card', class: 'bg-card', text: 'text-card-foreground', label: '--card' },
];

const typeScale = [
  { name: 'H1', class: 'text-3xl md:text-4xl', sample: 'Fleet Operations Dashboard' },
  { name: 'H2', class: 'text-xl md:text-2xl', sample: 'Shipment Performance' },
  { name: 'H3', class: 'text-lg md:text-xl', sample: 'Active Trips' },
  { name: 'Body', class: 'text-sm sm:text-base', sample: 'Track vehicles, manage fuel, and monitor maintenance in one place.' },
  { name: 'Small', class: 'text-xs sm:text-sm', sample: 'Last updated 2 minutes ago' },
];

export default function DesignSystemPage() {
  return (
    <PageShell gutter="loose">
      <PageHeader
        title="Design System"
        subtitle="A single source of truth for Calvary Connect UI — colors, typography, components, and layout patterns."
        eyebrow="Foundations"
      >
        <Button variant="outline">
          <Palette className="w-4 h-4 mr-2" />
          Tokens
        </Button>
      </PageHeader>

      <Tabs defaultValue="colors" className="space-y-6">
        <TabsList className="bg-card border border-border p-1">
          <TabsTrigger value="colors"><Palette className="w-4 h-4 mr-2" />Colors</TabsTrigger>
          <TabsTrigger value="typography"><Type className="w-4 h-4 mr-2" />Typography</TabsTrigger>
          <TabsTrigger value="components"><Layers className="w-4 h-4 mr-2" />Components</TabsTrigger>
          <TabsTrigger value="patterns"><LayoutDashboard className="w-4 h-4 mr-2" />Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="colors" className="space-y-6">
          <PageSection>
            <Card>
              <CardHeader>
                <CardTitle>Brand Palette</CardTitle>
                <CardDescription>
                  CSS variables in globals.css drive every surface. Each token has light and dark mode values.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {colors.map((c) => (
                  <div key={c.name} className="space-y-2">
                    <div className={cn('h-20 rounded-xl border border-border shadow-sm', c.class, c.text)} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{c.label}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </PageSection>

          <PageSection>
            <Card>
              <CardHeader>
                <CardTitle>Status Chips</CardTitle>
                <CardDescription>Use cv-chip-* helpers for consistent status labeling.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <span className="cv-chip cv-chip-success"><CheckCircle2 className="w-3 h-3" /> Active</span>
                <span className="cv-chip cv-chip-warning"><Clock className="w-3 h-3" /> Pending</span>
                <span className="cv-chip cv-chip-danger"><AlertCircle className="w-3 h-3" /> Critical</span>
                <span className="cv-chip cv-chip-info"><Fuel className="w-3 h-3" /> In Transit</span>
                <span className="cv-chip cv-chip-neutral">Neutral</span>
              </CardContent>
            </Card>
          </PageSection>
        </TabsContent>

        <TabsContent value="typography" className="space-y-6">
          <PageSection>
            <Card>
              <CardHeader>
                <CardTitle>Type Scale</CardTitle>
                <CardDescription>Space Grotesk with tight tracking for headings and comfortable body copy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {typeScale.map((t) => (
                  <div key={t.name} className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6 pb-4 border-b border-border last:border-0 last:pb-0">
                    <span className="w-16 text-xs font-black uppercase tracking-widest text-muted-foreground">{t.name}</span>
                    <span className={cn('text-foreground', t.class)}>{t.sample}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </PageSection>
        </TabsContent>

        <TabsContent value="components" className="space-y-6">
          <PageSection>
            <Card>
              <CardHeader>
                <CardTitle>Buttons</CardTitle>
                <CardDescription>Primary, secondary, outline, ghost, and destructive variants.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button><Plus className="w-4 h-4 mr-2" />Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline" size="sm">Small</Button>
                <Button size="lg">Large</Button>
              </CardContent>
            </Card>
          </PageSection>

          <PageSection>
            <Card>
              <CardHeader>
                <CardTitle>Badges</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </CardContent>
            </Card>
          </PageSection>

          <PageSection>
            <Card>
              <CardHeader>
                <CardTitle>Form Inputs</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search shipments..." className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Disabled</label>
                  <Input disabled placeholder="Disabled input" />
                </div>
              </CardContent>
            </Card>
          </PageSection>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6">
          <PageSection>
            <Card>
              <CardHeader>
                <CardTitle>KPI Cards</CardTitle>
                <CardDescription>Use KpiCard for dashboard metrics with optional icon, trend, and link.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  label="Active Shipments"
                  value="24"
                  icon={<Truck className="w-5 h-5" />}
                  trend={{ value: 12, label: 'vs last week', positive: true }}
                />
                <KpiCard
                  label="Fuel Consumed"
                  value="3,420 L"
                  icon={<Fuel className="w-5 h-5" />}
                  variant="accent"
                />
                <KpiCard
                  label="Maintenance Due"
                  value="7"
                  icon={<Wrench className="w-5 h-5" />}
                  variant="warning"
                />
                <KpiCard
                  label="Drivers On Duty"
                  value="18/22"
                  icon={<Users className="w-5 h-5" />}
                  variant="success"
                />
              </CardContent>
            </Card>
          </PageSection>

          <PageSection>
            <Card>
              <CardHeader>
                <CardTitle>Empty State</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  title="No trips found"
                  description="Get started by creating your first shipment."
                  icon={<Truck className="w-7 h-7" />}
                  action={<Button><Plus className="w-4 h-4 mr-2" />Create Shipment</Button>}
                />
              </CardContent>
            </Card>
          </PageSection>

          <PageSection>
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle>CTA Pattern</CardTitle>
                <CardDescription>A highlighted action panel used for upsells, onboarding, or primary workflows.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Optimize your routes today</p>
                  <p className="text-sm text-muted-foreground">Save fuel and time with AI-powered route planning.</p>
                </div>
                <Button>
                  Try Route Optimizer
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </PageSection>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
