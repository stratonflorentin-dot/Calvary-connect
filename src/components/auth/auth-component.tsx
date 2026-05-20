'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSupabase } from '@/components/supabase-provider';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, Lock, Shield, ArrowRight, Activity, Users, Settings } from 'lucide-react';


export function AuthComponent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signUp } = useSupabase();

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    console.log('Attempting login with email:', email);

    try {
      await signIn(email, password);
      console.log('Sign in successful');
      // Success - page will auto-redirect when user state updates
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in. Please check your credentials.');
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load Visme embed script dynamically when component mounts
  useEffect(() => {
    // Remove any existing script tag to force clean initialization
    const existingScript = document.getElementById('visme-embed-script');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = 'visme-embed-script';
    script.src = 'https://static-bundles.visme.co/forms/vismeforms-embed.js';
    script.async = true;
    
    // Append to body to trigger Visme's parser
    document.body.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById('visme-embed-script');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, []);

  const [hasStarted, setHasStarted] = useState(false);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center overflow-hidden relative">
      {/* Background glowing decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Main Cover Page Container (always rendered, dims/blurs when login is pulled open) */}
      <div className={`w-full max-w-6xl px-6 py-8 flex flex-col md:flex-row items-center justify-center gap-12 z-10 transition-all duration-500 ease-out ${hasStarted ? 'blur-md opacity-40 scale-[0.98]' : 'blur-none opacity-100 scale-100'}`}>
        
        {/* Left side: Premium Leaning Character Graphic Concept */}
        <div className="w-full md:w-1/2 flex flex-col items-center md:items-start text-center md:text-left space-y-6">
          <div className="relative inline-block">
            {/* Rotating accent border */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
              className="absolute -inset-4 border border-dashed border-blue-500/40 rounded-2xl"
            />
            
            {/* 3D graphic lookalike block */}
            <div className="relative w-24 h-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-xl shadow-blue-500/20">
              <Truck className="w-12 h-12 text-white" />
              {/* Glowing core */}
              <div className="absolute inset-0 border border-white/20 rounded-xl animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 font-headline">
              Calvary Connect
            </h1>
            <p className="text-slate-400 text-sm md:text-base">
              Professional Transport & Fleet Management System
            </p>
          </div>

          <p className="text-slate-300 text-xs md:text-sm max-w-md leading-relaxed">
            Unlock real-time logistics tracking, automated fuel approvals, dynamic trip logs, and smart fleet maintenance scheduling.
          </p>

          <div className="flex items-center gap-4 text-slate-500 text-xs pt-2">
            <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-blue-500" /> SECURE TLS</span>
            <span className="w-1 h-1 bg-slate-800 rounded-full" />
            <span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-blue-500" /> SHA-256</span>
          </div>
        </div>

        {/* Right side: Start Prompt Card */}
        <div className="w-full md:w-[380px] bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-slate-950 flex items-center justify-center border border-slate-800">
            <Activity className="w-8 h-8 text-indigo-400 animate-pulse" />
          </div>
          
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-100">Initialize Portal</h2>
            <p className="text-xs text-slate-400">
              Tap to pull the secure credentials interface.
            </p>
          </div>

          {/* Pulsing Start Button */}
          <div className="relative w-full group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt" />
            <Button 
              onClick={() => setHasStarted(true)}
              className="relative w-full py-6 bg-slate-950 hover:bg-slate-900 text-white font-semibold rounded-lg border border-slate-800 flex items-center justify-center gap-2 group-hover:border-blue-500/50 transition-all duration-300 shadow-xl"
            >
              <span>Start Connection</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <div className="text-[10px] text-slate-500">
            Calvary Investment Company Ltd &copy; {new Date().getFullYear()}
          </div>
        </div>
      </div>

      {/* Backdrop overlay to close drawer when clicking outside */}
      {hasStarted && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px] transition-opacity"
          onClick={() => setHasStarted(false)}
        />
      )}

      {/* Floating pull-tab visible on the right edge of the screen when drawer is closed */}
      {!hasStarted && (
        <button
          onClick={() => setHasStarted(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 h-32 w-10 bg-gradient-to-b from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-l-2xl flex flex-col items-center justify-center gap-2 shadow-[-4px_0_20px_rgba(59,130,246,0.3)] border-y border-l border-white/10 z-40 group transition-all duration-300 hover:w-12"
        >
          <Lock className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest [writing-mode:vertical-lr] select-none">
            Access Portal
          </span>
        </button>
      )}

      {/* Visme-style pull-out Drawer (Slides in from the right edge) */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: hasStarted ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 24, stiffness: 140 }}
        className="fixed top-0 right-0 h-full w-full sm:w-[460px] bg-slate-950/95 border-l border-slate-800/80 backdrop-blur-2xl shadow-[-10px_0_40px_rgba(0,0,0,0.7)] z-50 flex flex-col"
      >
        {/* Drawer Pull/Close handle attached to the left edge of the drawer */}
        <button
          onClick={() => setHasStarted(!hasStarted)}
          className="absolute left-[-32px] top-1/2 -translate-y-1/2 h-28 w-8 bg-slate-950 border-y border-l border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white rounded-l-xl flex flex-col items-center justify-center gap-2 shadow-[-5px_0_15px_rgba(0,0,0,0.3)] transition-all cursor-pointer group"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-blue-500 transition-colors" />
          <span className="text-[9px] font-bold uppercase tracking-widest [writing-mode:vertical-lr] select-none text-slate-500 group-hover:text-slate-300">
            {hasStarted ? 'CLOSE PANEL' : 'PULL TO ENTER'}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-blue-500 transition-colors" />
        </button>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setHasStarted(false)} 
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              &larr; Back to welcome
            </button>
            <div className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-full font-mono">
              Verifying Session
            </div>
          </div>

          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-2xl text-slate-100">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 font-headline">Portal Access</CardTitle>
                  <p className="text-xs text-slate-400 mt-1">Calvary Connect System</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-slate-950 flex items-center justify-center border border-slate-800">
                  <Lock className="w-5 h-5 text-indigo-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-950 p-1 rounded-lg">
                  <TabsTrigger value="signin" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 text-xs py-2">Sign In</TabsTrigger>
                  <TabsTrigger value="signup" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 text-xs py-2">Sign Up</TabsTrigger>
                </TabsList>
                
                <TabsContent value="signin" className="mt-4 space-y-4">
                  <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-lg text-xs text-amber-300 leading-relaxed">
                    <strong>First time logging in?</strong> If you have been added as an admin or staff, switch to the <strong>Sign Up</strong> tab to register your credentials.
                  </div>
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="text-slate-400 text-xs">Corporate Email</Label>
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="name@company.com"
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-650 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password" className="text-slate-400 text-xs">Security Key</Label>
                      <Input
                        id="signin-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-650 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm"
                        required
                      />
                    </div>
                    {error && (
                      <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 p-3 rounded-lg">
                        {error}
                      </div>
                    )}
                    <Button type="submit" className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-blue-500/20" disabled={loading}>
                      {loading ? 'Authenticating...' : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup" className="mt-4 space-y-4">
                  <div className="p-3 bg-blue-950/20 border border-blue-900/30 rounded-lg text-xs text-blue-300 leading-relaxed">
                    <strong>Direct Register:</strong> If you are newly registered by administration, please verify your email and complete credentials setup below.
                  </div>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-slate-400 text-xs">Full Name</Label>
                      <Input
                        id="signup-name"
                        name="name"
                        type="text"
                        placeholder="Enter full name"
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-650 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-slate-400 text-xs">Authorized Email</Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="name@company.com"
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-650 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-slate-400 text-xs">New Password</Label>
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        placeholder="Min 6 characters"
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-650 focus:border-blue-500 focus:ring-blue-500 h-10 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-role" className="text-slate-400 text-xs">Assigned Team Role</Label>
                      <Select name="role" required>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100 h-10 text-sm">
                          <SelectValue placeholder="Select assigned role" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                          <SelectItem value="DRIVER">Driver</SelectItem>
                          <SelectItem value="OPERATOR">Operator</SelectItem>
                          <SelectItem value="MECHANIC">Mechanic</SelectItem>
                          <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                          <SelectItem value="HR">HR</SelectItem>
                          <SelectItem value="FLEET_MANAGER">Fleet Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {error && (
                      <div className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 p-3 rounded-lg">
                        {error}
                      </div>
                    )}
                    <Button type="submit" className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-blue-500/20" disabled={loading}>
                      {loading ? 'Creating account...' : 'Complete Registration'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}

