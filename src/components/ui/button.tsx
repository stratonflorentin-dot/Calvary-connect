import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { motion } from "framer-motion"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { buttonTapTransition, hoverLift, pressScale } from "@/lib/animations"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground hover:border-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-md",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-md",
        ghost: "bg-transparent border-none hover:bg-accent/10 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-lg px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

// Framer Motion's HTMLMotionProps redefine a few event handlers (onDrag,
// onDragStart/End, onAnimationStart/End) with its own signatures, which
// collide with React.ButtonHTMLAttributes' DOM event types. Button doesn't
// use any of those on a <button>, so it's safe to widen just at this call
// site rather than narrow ButtonProps itself (asChild/Slot still needs the
// full, unmodified DOM attribute types below).
type MotionButtonSpreadProps = Omit<
  ButtonProps,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "asChild" | "variant" | "size"
>

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    if (asChild) {
      // Link-wrapped / custom-element buttons: motion props can't safely
      // forward through Slot onto an arbitrary child (e.g. next/link),
      // so these keep the existing CSS-only hover treatment.
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        />
      )
    }
    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        whileHover={{ ...hoverLift }}
        whileTap={{ ...pressScale }}
        transition={buttonTapTransition}
        {...(props as MotionButtonSpreadProps)}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
