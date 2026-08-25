'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell, PageHeader } from '@/components/design/page-shell';
import { cn } from '@/lib/utils';
import {
  Truck,
  Route,
  Fuel,
  Wrench,
  BarChart3,
  Shield,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Clock,
  Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, listItem } from '@/lib/animations';

const features = [
  {
    icon: <Route className="w-6 h-6 text-primary" />,
    title: 'Route Optimization',
    description: 'AI-powered routing cuts fuel costs and delivery times across your entire fleet.',
  },
  {
    icon: <Fuel className="w-6 h-6 text-primary" />,
    title: 'Fuel Management',
    description: 'Track consumption, detect anomalies, and reconcile every liter with precision.',
  },
  {
    icon: <Wrench className="w-6 h-6 text-primary" />,
    title: 'Maintenance',
    description: 'Preventive schedules and real-time health alerts keep vehicles on the road.',
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-primary" />,
    title: 'Finance & ERP',
    description: 'Invoices, expenses, payroll, and fleet profitability in one connected ledger.',
  },
  {
    icon: <MapPin className="w-6 h-6 text-primary" />,
    title: 'Live Tracking',
    description: 'GPS tracking with driver mobile apps gives you visibility from depot to delivery.',
  },
  {
    icon: <Shield className="w-6 h-6 text-primary" />,
    title: 'Compliance',
    description: 'Automated document expiry alerts and inspection history for every vehicle.',
  },
];

const stats = [
  { value: '30%', label: 'Fuel savings' },
  { value: '24/7', label: 'Fleet visibility' },
  { value: '50+', label: 'Reports' },
  { value: '99.9%', label: 'Uptime' },
];

export default function LandingPage() {
  return (
    <PageShell gutter="none" className="overflow-hidden">
      {/* Hero */}
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.12),transparent_50%)]" />
        <div className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
          <PageHeader
            align="center"
            title="Fleet management built for African logistics"
            subtitle="Calvary Connect unifies dispatch, fuel, maintenance, finance, and compliance — so you can move more cargo with fewer surprises."
            eyebrow="Calvary Connect"
          >
            <Button size="lg" className="h-12 px-8">
              Get started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8">
              Request demo
            </Button>
          </PageHeader>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="mt-12 sm:mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto"
          >
            {stats.map((stat) => (
              <motion.div key={stat.label} variants={listItem}>
                <Card className="text-center py-6">
                  <CardContent className="p-0">
                    <p className="text-2xl sm:text-3xl font-black text-foreground">{stat.value}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">{stat.label}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="cv-eyebrow">Capabilities</span>
            <h2 className="mt-4 text-2xl sm:text-3xl font-bold text-foreground">Everything your fleet needs</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              From the warehouse to the final mile, every module is connected to the same real-time data.
            </p>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature) => (
              <motion.div key={feature.title} variants={listItem}>
                <Card className="h-full hover:border-primary/30 hover:shadow-md transition-all duration-200">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-accent/50 flex items-center justify-center mb-4">
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Why choose */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="cv-eyebrow">Why Calvary Connect</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Built for the realities of road freight</h2>
            <p className="text-muted-foreground">
              Offline-capable mobile apps, multi-currency finance, local compliance rules, and telematics integrations that work on the roads you operate.
            </p>
            <ul className="space-y-4">
              {[
                'Driver mobile app with trip proof-of-delivery',
                'Multi-currency accounting and FX revaluation',
                'Preventive maintenance and parts inventory',
                'Role-based access for drivers, ops, finance, and executives',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Truck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Active fleet</p>
                  <p className="text-sm text-muted-foreground">42 vehicles on the road</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'In transit', value: 28, color: 'bg-info' },
                  { label: 'Available', value: 10, color: 'bg-success' },
                  { label: 'Maintenance', value: 4, color: 'bg-warning' },
                ].map((row) => (
                  <div key={row.label} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="text-foreground">{row.value}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', row.color)}
                        style={{ width: `${(row.value / 42) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">On-time 94%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">38 drivers</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <Card className="max-w-4xl mx-auto border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardContent className="p-8 sm:p-12 text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Ready to modernize your fleet?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Join transport teams using Calvary Connect to run tighter operations, cleaner books, and safer roads.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" className="h-12 px-8">
                Start free trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8">
                Talk to sales
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
