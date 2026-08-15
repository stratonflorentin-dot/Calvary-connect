"use client";

import { MotionConfig } from "framer-motion";

/**
 * App-wide Framer Motion config. `reducedMotion="user"` makes every
 * motion.* component anywhere in the tree automatically drop transform
 * animations (x/y/scale/rotate) and keep only opacity when the visitor's OS
 * has "reduce motion" turned on — no per-component handling needed. This is
 * the JS-driven counterpart to the prefers-reduced-motion rule in
 * globals.css, which only covers CSS animations/transitions.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
