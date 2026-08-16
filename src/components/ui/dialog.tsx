"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { modalContent, modalOverlay } from "@/lib/animations"

// Radix's own Root only exposes open/closed via a `data-state` DOM
// attribute, but Framer Motion's AnimatePresence needs a real React boolean
// to know when to keep rendering a closing element for its exit animation.
// This context mirrors Root's open state (controlled or uncontrolled)
// without requiring any call site to change — every existing
// `<Dialog open={x} onOpenChange={setX}>` or trigger-driven
// `<Dialog><DialogTrigger/><DialogContent/></Dialog>` keeps working exactly
// as before, now with a real enter/exit animation everywhere it's used.
const DialogOpenContext = React.createContext(false)

type DialogRootProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>

const Dialog = ({ open: openProp, defaultOpen, onOpenChange, children, ...props }: DialogRootProps) => {
  const [open, setOpen] = React.useState(openProp ?? defaultOpen ?? false)

  React.useEffect(() => {
    if (openProp !== undefined) setOpen(openProp)
  }, [openProp])

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOpen(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange]
  )

  return (
    <DialogPrimitive.Root open={openProp ?? open} defaultOpen={defaultOpen} onOpenChange={handleOpenChange} {...props}>
      <DialogOpenContext.Provider value={openProp ?? open}>{children}</DialogOpenContext.Provider>
    </DialogPrimitive.Root>
  )
}

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/50", className)}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const open = React.useContext(DialogOpenContext)

  return (
    <AnimatePresence>
      {open && (
        <DialogPortal forceMount>
          <DialogPrimitive.Overlay forceMount asChild>
            <motion.div
              className="fixed inset-0 z-50 bg-black/50"
              variants={modalOverlay}
              initial="hidden"
              animate="visible"
              exit="hidden"
            />
          </DialogPrimitive.Overlay>
          {/*
            Centering via a flex wrapper (not the old fixed + top/left-50% +
            translate-[-50%] trick) so the box centers on its actual final
            height — translate-based centering silently breaks any time the
            content's height interacts with max-height/overflow/flex in a
            way the browser resolves before the transform is applied.
          */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <DialogPrimitive.Content ref={ref} forceMount asChild {...props}>
              <motion.div
                className={cn(
                  "pointer-events-auto relative grid w-full max-w-lg gap-4 border border-border bg-card p-4 sm:p-6 shadow-xl rounded-lg max-h-[90vh] overflow-y-auto",
                  className
                )}
                variants={modalContent}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                {children}
                <DialogPrimitive.Close asChild>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    className="absolute right-4 top-4 rounded-lg opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-10"
                  >
                    <X className="h-5 w-5 sm:h-4 sm:w-4" />
                    <span className="sr-only">Close</span>
                  </motion.button>
                </DialogPrimitive.Close>
              </motion.div>
            </DialogPrimitive.Content>
          </div>
        </DialogPortal>
      )}
    </AnimatePresence>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
