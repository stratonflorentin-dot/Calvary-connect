'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSupabase } from '@/components/supabase-provider';
import { ThemeToggle } from '@/components/theme-toggle';

/**
 * DESIGN NOTE (read before editing further):
 * This replaces a "pull-tab drawer" login that hid the actual form behind a
 * "Start Connection" button, with sci-fi copy ("Initialize Portal",
 * "Security Key", "Verifying Session") and generic blurred-orb decoration.
 * That pattern added friction with nothing to show for it.
 *
 * The left panel's route diagram is deliberately specific to this company —
 * Dar es Salaam to the Tunduma border crossing to Lusaka is a real transit
 * corridor for Tanzanian cross-border freight — rather than generic glow
 * decoration. All colors below come from the existing design tokens in
 * globals.css (primary, warning = "Delayed", success = "Delivered"); no new
 * colors were introduced.
 */

// Matches src/types/roles.ts UserRole exactly, minus CEO/ADMIN — those are
// privileged roles an administrator assigns manually, not something anyone
// should be able to self-select at signup. The original list here included
// a "Fleet Manager" role that isn't a real UserRole value at all (would
// have created accounts the rest of the app can't recognize or route), and
// was missing two roles that are real: Salesman, Warehouse Staff.
const ROLES = [
  { value: 'DRIVER', label: 'Driver' },
  { value: 'OPERATOR', label: 'Operator' },
  { value: 'MECHANIC', label: 'Mechanic' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
  { value: 'HR', label: 'HR' },
  { value: 'SALESMAN', label: 'Salesman' },
  { value: 'WAREHOUSE_STAFF', label: 'Warehouse Staff' },
];

function RouteSignature() {
  return (
    <svg viewBox="0 0 360 200" className="w-full max-w-sm" aria-hidden="true">
      <path
        d="M 24 152 C 90 152, 100 60, 180 60 S 270 152, 336 152"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeDasharray="2 8"
        strokeLinecap="round"
      />
      <path
        d="M 24 152 C 90 152, 100 60, 180 60 S 270 152, 336 152"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeDasharray="14 500"
        strokeLinecap="round"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-514" dur="7s" repeatCount="indefinite" />
      </path>

      {/* Origin */}
      <circle cx="24" cy="152" r="5" fill="hsl(var(--primary))" />
      <text x="24" y="176" textAnchor="middle" className="fill-white/70 font-mono" fontSize="9" letterSpacing="0.5">
        DAR ES SALAAM
      </text>

      {/* Border checkpoint */}
      <circle cx="180" cy="60" r="5" fill="hsl(var(--warning))" />
      <text x="180" y="42" textAnchor="middle" className="fill-white/70 font-mono" fontSize="9" letterSpacing="0.5">
        TUNDUMA BORDER
      </text>

      {/* Destination */}
      <circle cx="336" cy="152" r="5" fill="hsl(var(--success))" />
      <text x="336" y="176" textAnchor="middle" className="fill-white/70 font-mono" fontSize="9" letterSpacing="0.5">
        LUSAKA
      </text>
    </svg>
  );
}

export function AuthComponent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const { signIn, signUp } = useSupabase();

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Could not sign in. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as string;

    try {
      await signUp(email, password, name, role);
    } catch (err: any) {
      setError(err.message || 'Could not create your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row">
      {/* Left: brand panel */}
      <div className="relative md:w-[46%] bg-[#0B1F33] text-white flex flex-col justify-between p-10 md:p-14 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary/20 border border-primary/40 flex items-center justify-center">
            <span className="font-headline font-bold text-primary text-sm">CC</span>
          </div>
          <span className="font-headline font-semibold tracking-tight">Calvary Connect</span>
        </div>

        <div className="space-y-8">
          <div className="space-y-3 max-w-sm">
            <h1 className="font-headline text-3xl md:text-[2.25rem] leading-[1.1] font-bold tracking-tight">
              Fleet, freight, and finance — one system.
            </h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Trip dispatch, cross-border compliance, and accounting for one connected
              operation.
            </p>
          </div>
          <RouteSignature />
        </div>

        <p className="text-white/40 text-xs font-mono">
          Calvary Investment Company Ltd &copy; {new Date().getFullYear()}
        </p>

        <div
          className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full opacity-[0.07]"
          style={{ background: 'hsl(var(--primary))' }}
        />
      </div>

      {/* Right: sign-in form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-14 bg-background">
        <div className="absolute top-4 right-4 md:static md:self-end md:mb-8">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="font-headline text-2xl font-bold text-foreground">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Use the email and password your administrator set up for you.
            </p>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6 space-y-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@calvaryconnect.co.tz"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                  </div>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      name="password"
                      type={showSignInPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword((v) => !v)}
                      aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    >
                      {showSignInPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-md">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground text-center pt-1">
                New staff account? Confirm your role with your administrator, then use
                the <span className="font-medium text-foreground">Create account</span> tab.
              </p>
            </TabsContent>

            <TabsContent value="signup" className="mt-6 space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input id="signup-name" name="name" type="text" placeholder="Jane Mwangi" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@calvaryconnect.co.tz"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      name="password"
                      type={showSignUpPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      minLength={6}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpPassword((v) => !v)}
                      aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    >
                      {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-role">Role</Label>
                  <Select name="role" required>
                    <SelectTrigger id="signup-role">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-md">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? 'Creating account…' : 'Create account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
