/**
 * Shared animation system for Calvary Connect.
 *
 * This is a data-dense business ERP, not a marketing site — every value
 * here is tuned to feel fast and purposeful rather than decorative:
 *   - MICRO (150ms)  — hover/press feedback, small in-place changes
 *   - BASE  (250ms)  — page/section transitions, list items, cards
 *   - MODAL (350ms)  — the largest motion in the system, modal/drawer content
 * One easing curve (EASE) is used everywhere so nothing feels "off" next
 * to anything else.
 *
 * Reduced motion: wrap the app root in <MotionConfig reducedMotion="user">
 * (see src/components/motion-provider.tsx) and every motion.* component
 * everywhere automatically drops transforms (scale/x/y) and keeps only
 * opacity for users with the OS "reduce motion" setting on — no per-variant
 * handling needed. CSS-driven animations (Tailwind animate-*, .cv-skeleton)
 * are separately covered by the prefers-reduced-motion rule in globals.css.
 */
import type { Transition, Variants } from "framer-motion";

// ─── Timing tokens ──────────────────────────────────────────────────────────

export const DURATION = {
  micro: 0.15,
  base: 0.25,
  modal: 0.35,
} as const;

/** One cubic-bezier for the whole app — a crisp "ease-out-expo" feel. */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const TRANSITION = {
  micro: { duration: DURATION.micro, ease: EASE } satisfies Transition,
  base: { duration: DURATION.base, ease: EASE } satisfies Transition,
  modal: { duration: DURATION.modal, ease: EASE } satisfies Transition,
} as const;

// ─── Row/list stagger ───────────────────────────────────────────────────────

const STAGGER_PER_ROW = 0.035; // 35ms — inside the requested 30-40ms band
const STAGGER_MAX_TOTAL = 0.4; // never let a long list take longer than this to finish

/**
 * Per-item stagger delay for a list of `count` rows, shrinking as the list
 * grows so a 200-row table doesn't take 7 seconds to finish animating in.
 */
export function getListStagger(count: number, perItem = STAGGER_PER_ROW, maxTotal = STAGGER_MAX_TOTAL): number {
  if (count <= 1) return 0;
  return Math.min(perItem, maxTotal / count);
}

// ─── Core variants ──────────────────────────────────────────────────────────

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: TRANSITION.base },
  exit: { opacity: 0, transition: TRANSITION.micro },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: TRANSITION.base },
  exit: { opacity: 0, y: -8, transition: TRANSITION.micro },
};

/** Parent wrapper for a list/grid of children using `listItem`. Pass a custom `staggerChildren` via getListStagger(count). */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: STAGGER_PER_ROW, delayChildren: 0 },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: TRANSITION.micro },
  exit: { opacity: 0, transition: TRANSITION.micro },
};

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: TRANSITION.base },
  exit: { opacity: 0, transition: TRANSITION.micro },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: TRANSITION.modal },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: TRANSITION.base },
};

/** Used by src/app/template.tsx for route-to-route transitions. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: TRANSITION.base },
  exit: { opacity: 0, y: -6, transition: TRANSITION.micro },
};

// ─── Interactive element presets ───────────────────────────────────────────

/** Spread onto whileHover — subtle elevation, no bounce. */
export const hoverLift = { y: -1 };

/** Spread onto whileTap — a crisp press, not a bounce. */
export const pressScale = { scale: 0.97 };

export const buttonTapTransition: Transition = { duration: DURATION.micro, ease: EASE };

/** For a status/value chip that should pulse when its content changes — wrap with `key={value}` inside AnimatePresence mode="wait". */
export const statusChange: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: TRANSITION.micro },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.1, ease: EASE } },
};

// ─── Toasts ─────────────────────────────────────────────────────────────────

export const toastSlideIn: Variants = {
  hidden: { opacity: 0, x: 24, scale: 0.98 },
  visible: { opacity: 1, x: 0, scale: 1, transition: TRANSITION.base },
  exit: { opacity: 0, scale: 0.96, transition: TRANSITION.micro },
};

// ─── Form feedback ──────────────────────────────────────────────────────────

export const formMessage: Variants = {
  hidden: { opacity: 0, height: 0, y: -4 },
  visible: { opacity: 1, height: "auto", y: 0, transition: TRANSITION.micro },
  exit: { opacity: 0, height: 0, y: -4, transition: { duration: 0.12, ease: EASE } },
};

export const successPop: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE } },
};

// ─── Charts ─────────────────────────────────────────────────────────────────

/** A bar/column that should grow in from its base rather than pop in full-height. Animate `scaleY` with `style={{ transformOrigin: "bottom" }}`. */
export const barGrowIn: Variants = {
  hidden: { scaleY: 0 },
  visible: { scaleY: 1, transition: { duration: DURATION.modal, ease: EASE } },
};

/** A line/area chart path that should draw in. Animate `pathLength`. */
export const pathDrawIn: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: { pathLength: 1, opacity: 1, transition: { duration: 0.6, ease: EASE } },
};
