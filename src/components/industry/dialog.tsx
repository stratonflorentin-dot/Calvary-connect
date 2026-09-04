"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Dialog as UiDialog,
  DialogTrigger as UiDialogTrigger,
  DialogPortal as UiDialogPortal,
  DialogClose as UiDialogClose,
} from "@/components/ui/dialog";

/**
 * Industry design system dialog. Reuses @/components/ui/dialog's Root/
 * Trigger/Portal/Close directly — that file already solved the nontrivial
 * problem of bridging Radix's DOM-attribute-only open state into a real
 * React boolean for exit animations (see its own comment). Only Content
 * gets an Industry-styled replacement: hairline border instead of shadow/
 * radius, and this system's single easing curve instead of the app-wide
 * modal's own motion variants.
 */
export const IndustryDialog = UiDialog;
export const IndustryDialogTrigger = UiDialogTrigger;
export const IndustryDialogClose = UiDialogClose;

const EASE = [0.16, 1, 0.3, 1] as const;

export const IndustryDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { open: boolean }
>(({ className, children, open, ...props }, ref) => {
  return (
    <AnimatePresence>
      {open && (
        <UiDialogPortal forceMount>
          <DialogPrimitive.Overlay forceMount asChild>
            <motion.div
              className="fixed inset-0 z-50 bg-[color-mix(in_srgb,#2b2b2d_50%,transparent)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: EASE }}
            />
          </DialogPrimitive.Overlay>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <DialogPrimitive.Content ref={ref} forceMount asChild {...props}>
              <motion.div
                className={cn(
                  "cc-industry ci-blueprint pointer-events-auto relative flex w-full max-w-[440px] flex-col gap-[10px] bg-[var(--ci-bg)] p-[13.6px] max-h-[90vh] overflow-y-auto",
                  className
                )}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                {children}
              </motion.div>
            </DialogPrimitive.Content>
          </div>
        </UiDialogPortal>
      )}
    </AnimatePresence>
  );
});
IndustryDialogContent.displayName = "IndustryDialogContent";

export function IndustryDialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <DialogPrimitive.Title
      className={cn("text-[20px] font-semibold leading-tight", className)}
      style={{ fontFamily: "var(--font-barlow-condensed), system-ui, sans-serif" }}
    >
      {children}
    </DialogPrimitive.Title>
  );
}

export function IndustryDialogBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[14px] leading-[1.55] text-[var(--ci-text-secondary)]", className)}>{children}</div>;
}

export function IndustryDialogActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex justify-end gap-[6.8px] mt-[6.8px]", className)}>{children}</div>;
}
