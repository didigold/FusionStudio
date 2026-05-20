import * as React from "react"
import { cn } from "@/lib/utils"

const DrawerContext = React.createContext<{ onClose?: () => void }>({})

const Drawer = ({ children, ...props }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => {
  const [open, setOpen] = React.useState(props.open ?? false)

  const onOpenChange = props.onOpenChange ?? setOpen
  const isControlled = props.open !== undefined
  const isOpen = isControlled ? props.open : open

  const handleClose = () => onOpenChange(false)

  return (
    <DrawerContext.Provider value={{ onClose: handleClose }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
          <div
            className={cn(
              "relative z-50 w-full max-w-lg rounded-t-2xl border border-border/50 bg-surface-2 p-6 shadow-lg animate-in slide-in-from-bottom-2 duration-300"
            )}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            {children}
          </div>
        </div>
      )}
    </DrawerContext.Provider>
  )
}

const DrawerTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button"> & { asChild?: boolean }>(
  ({ asChild, className, ...props }, ref) => {
    if (asChild) {
      return React.cloneElement(React.Children.only(props.children) as any, { ref } as any)
    }
    return <button ref={ref} className={className} {...props} />
  }
)
DrawerTrigger.displayName = "DrawerTrigger"

const DrawerContent = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-4", className)} {...props}>
    {children}
  </div>
)
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5", className)} {...props} />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-sm font-semibold text-foreground", className)} {...props} />
  )
)
DrawerTitle.displayName = "DrawerTitle"

const DrawerDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-xs text-muted-foreground", className)} {...props} />
  )
)
DrawerDescription.displayName = "DrawerDescription"

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-2", className)} {...props} />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerClose = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button"> & { asChild?: boolean }>(
  ({ asChild, className, ...props }, ref) => {
    const { onClose } = React.useContext(DrawerContext)
    if (asChild) {
      return React.cloneElement(React.Children.only(props.children) as any, { onClick: onClose, ref } as any)
    }
    return <button ref={ref} onClick={onClose} className={className} {...props} />
  }
)
DrawerClose.displayName = "DrawerClose"

export { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger }
