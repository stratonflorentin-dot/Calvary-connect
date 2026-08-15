"use client";

import { motion } from "framer-motion";
import { pageTransition } from "@/lib/animations";

/**
 * Route-to-route enter transition. Next.js remounts template.tsx on every
 * navigation, so `visible` fires on mount for the new page — a quick,
 * interruptible fade + slight rise using the shared timing/easing tokens
 * (see src/lib/animations.ts) instead of a bouncy spring, so fast
 * back-to-back navigation never feels like it's "catching up."
 */
export default function PageTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={pageTransition}
      className="flex-1 w-full flex flex-col"
    >
      {children}
    </motion.div>
  );
}
