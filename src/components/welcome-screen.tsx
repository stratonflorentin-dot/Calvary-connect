"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, Globe, Thermometer, Package, Anchor } from 'lucide-react';

interface WelcomeScreenProps {
  onComplete?: () => void;
  minimumDuration?: number;
}

export function WelcomeScreen({ onComplete, minimumDuration = 3000 }: WelcomeScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const animateProgress = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / minimumDuration) * 100, 100);
      setProgress(newProgress);

      if (newProgress < 100) {
        requestAnimationFrame(animateProgress);
      }
    };
    animateProgress();

    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) {
        setTimeout(onComplete, 500);
      }
    }, minimumDuration);

    return () => clearTimeout(hideTimer);
  }, [minimumDuration, onComplete]);

  const services = [
    { icon: Globe, label: 'Cross-Border', color: 'from-blue-500 to-cyan-500' },
    { icon: Thermometer, label: 'Cold Chain', color: 'from-cyan-500 to-teal-500' },
    { icon: Package, label: 'Heavy Cargo', color: 'from-amber-500 to-orange-500' },
    { icon: Anchor, label: 'Regional Transit', color: 'from-purple-500 to-pink-500' },
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
          </div>

          {/* Content */}
          <div className="relative z-10 text-center px-8">
            {/* Logo Animation */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mb-8"
            >
              <div className="relative inline-block">
                {/* Outer Ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-8 border-2 border-amber-500/30 rounded-full"
                />

                {/* Icon Container */}
                <div className="relative w-32 h-32 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/20">
                  <Truck className="w-16 h-16 text-white" />

                  {/* Pulse Ring */}
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 border-2 border-white/30 rounded-2xl"
                  />
                </div>

                {/* Status Indicator */}
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-4 border-slate-900"
                >
                  <div className="w-3 h-3 bg-white rounded-full" />
                </motion.div>
              </div>
            </motion.div>

            {/* Company Name */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                Calvary
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                  {" "}Connect
                </span>
              </h1>
              <p className="text-slate-400 text-lg mb-6">
                Investment Company Ltd
              </p>
            </motion.div>

            {/* Tagline */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-slate-300 text-sm md:text-base max-w-md mx-auto mb-8"
            >
              Your gateway to seamless cross-border logistics across East Africa
            </motion.p>

            {/* Services Icons */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="flex items-center justify-center gap-4 mb-12"
            >
              {services.map((service, index) => (
                <motion.div
                  key={service.label}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8 + index * 0.1, type: "spring" }}
                  className="flex flex-col items-center gap-2"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center shadow-lg`}>
                    <service.icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[10px] text-slate-400">{service.label}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Progress Bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="w-64 mx-auto"
            >
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-slate-500 text-xs mt-2">Loading fleet systems...</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
