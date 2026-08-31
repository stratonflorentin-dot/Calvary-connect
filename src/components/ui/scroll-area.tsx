"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    type="always"
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport
      className="h-full w-full rounded-[inherit]"
      style={{ touchAction: "pan-y" }}
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      // Absolutely positioned so the always-visible scrollbar floats over
      // the content instead of reserving layout width, which would narrow
      // every row and force extra text truncation in tight panels.
      orientation === "vertical" &&
        "absolute right-0 top-0 bottom-0 w-2.5 p-[2px]",
      orientation === "horizontal" &&
        "absolute bottom-0 left-0 right-0 h-2.5 flex-col p-[2px]",
      className
    )}
    {...props}
  >
    {/* bg-border alone reads as near-invisible on this app's dark theme,
        which made scrollable panels look like they'd hit a hard content
        limit rather than just needing a scroll. muted-foreground at partial
        opacity keeps it unobtrusive in light mode while still being
        genuinely visible against dark surfaces. */}
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-muted-foreground/50 hover:bg-muted-foreground/80 transition-colors" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
