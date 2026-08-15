"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { motion } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  /** Formats the current (possibly fractional, mid-animation) number for display — e.g. currency formatting. Defaults to a plain locale integer. */
  format?: (value: number) => string;
  className?: string;
  /** Seconds. Defaults to a quick, purposeful count — never a slow marketing-site reveal. */
  duration?: number;
}

/**
 * KPI number that counts up from its previous value (or 0 on first mount)
 * to `value`. Respects reduced motion — jumps straight to the final number
 * instead of animating when the OS setting is on.
 */
export function AnimatedCounter({ value, format, className, duration = 0.6 }: AnimatedCounterProps) {
  const prefersReducedMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const hasMounted = useRef(false);
  const rounded = useTransform(motionValue, (v) => (format ? format(v) : Math.round(v).toLocaleString()));

  useEffect(() => {
    if (prefersReducedMotion) {
      motionValue.set(value);
      return;
    }
    const from = hasMounted.current ? motionValue.get() : 0;
    hasMounted.current = true;
    const controls = animate(from, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => motionValue.set(v),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, prefersReducedMotion]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
