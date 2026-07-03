import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

const SIDEBAR_COOKIE_NAME = "sidebar:state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_ICON = "3.5rem"

type SidebarContext = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider")
  return context
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }
>(({ defaultOpen = true, open: openProp, onOpenChange: setOpenProp, className, style, children, ...props }, ref) => {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open

  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) setOpenProp(openState)
      else _setOpen(openState)
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open]
  )

  const toggleSidebar = React.useCallback(() => setOpen((prev) => !prev), [setOpen])

  const state = open ? "expanded" : "collapsed"

  const contextValue: SidebarContext = { state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar }

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        ref={ref}
        style={{ "--sidebar-width": SIDEBAR_WIDTH, "--sidebar-width-icon": SIDEBAR_WIDTH_ICON, ...style } as React.CSSProperties}
        className={cn("group/sidebar-wrapper flex min-h-svh w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
})
SidebarProvider.displayName = "SidebarProvider"

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { collapsible?: "offcanvas" | "icon" | "none" }
>(({ collapsible = "icon", className, style, children, ...props }, ref) => {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === "none") {
    return (
      <div ref={ref} className={cn("flex h-full w-[--sidebar-width] flex-col bg-surface-2 text-foreground", className)} {...props}>
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpenMobile(false)}
        />
        <div
          ref={ref}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[--sidebar-width] flex-col bg-surface-2 border-r border-border/50 transition-transform duration-300",
            openMobile ? "translate-x-0" : "-translate-x-full",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </>
    )
  }

  return (
    <div
      ref={ref}
      data-state={state}
      style={{
        width: state === "expanded" ? "var(--sidebar-width)" : "var(--sidebar-width-icon)",
        transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        ...style
      }}
      className={cn(
        "flex h-full flex-col bg-surface-2 border-r border-border/50 overflow-x-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
Sidebar.displayName = "Sidebar"

const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-2 p-4", className)} {...props} />
  )
)
SidebarHeader.displayName = "SidebarHeader"

const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-2 p-4", className)} {...props} />
  )
)
SidebarFooter.displayName = "SidebarFooter"

const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1 overflow-auto px-2 py-3 [overflow-anchor:none]", className)} {...props} />
  )
)
SidebarContent.displayName = "SidebarContent"

const SidebarGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1", className)} {...props} />
  )
)
SidebarGroup.displayName = "SidebarGroup"

const SidebarGroupLabel = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground", className)} {...props} />
  )
)
SidebarGroupLabel.displayName = "SidebarGroupLabel"

const SidebarMenu = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props} />
  )
)
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
  )
)
SidebarMenuItem.displayName = "SidebarMenuItem"

const sidebarMenuButtonVariants = cva(
  "inline-flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium w-full transition-all duration-200 hover:bg-[#E6E4E1]/10 dark:hover:bg-[#E6E4E1]/20 hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&>svg]:shrink-0 focus-visible:outline-none focus-visible:ring-0 select-none",
  {
    variants: {
      variant: {
        default: "text-muted-foreground [&:active]:outline-none [&:active]:ring-0",
        active: "bg-[#E6E4E1] text-[#111110] dark:bg-primary/10 dark:text-primary [&:active]:outline-none [&:active]:ring-0",
      },
      size: {
        default: "h-9",
        sm: "h-9 text-sm",
        lg: "h-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

interface SidebarMenuButtonProps extends React.ComponentProps<"button">, VariantProps<typeof sidebarMenuButtonVariants> {
  asChild?: boolean
}

interface Ripple {
  key: number
  x: number
  y: number
  size: number
}

const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ asChild = false, variant, size, className, onClick, children, ...props }, ref) => {
    const { open: sidebarOpen } = useSidebar()
    const [ripples, setRipples] = React.useState<Ripple[]>([])

    const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
      const button = event.currentTarget
      const rect = button.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height)
      const x = event.clientX - rect.left - size / 2
      const y = event.clientY - rect.top - size / 2

      const newRipple: Ripple = {
        key: Date.now() + Math.random(),
        x,
        y,
        size,
      }

      setRipples((prev) => [...prev, newRipple])
    }

    const handleAnimationEnd = (key: number) => {
      setRipples((prev) => prev.filter((ripple) => ripple.key !== key))
    }

    const Comp = asChild ? React.Fragment : "button"
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!asChild) {
        createRipple(e)
      }
      onClick?.(e)
      ;(e.currentTarget as HTMLElement)?.blur()
    }

    if (asChild) {
      return (
        <Comp 
          ref={ref} 
          className={cn(
            sidebarMenuButtonVariants({ variant, size }), 
            !sidebarOpen && "flex w-10 h-10 p-0 justify-center mx-auto rounded-lg [&>span]:justify-center [&>span]:gap-0",
            className
          )} 
          {...props} 
          onClick={handleClick} 
        />
      )
    }

    return (
      <Comp
        ref={ref}
        className={cn(
          sidebarMenuButtonVariants({ variant, size }), 
          "relative overflow-hidden", 
          !sidebarOpen && "flex w-10 h-10 p-0 justify-center mx-auto rounded-lg [&>span]:justify-center [&>span]:gap-0",
          className
        )}
        onClick={handleClick}
        onPointerDown={(e) => { e.preventDefault(); props.onPointerDown?.(e) }}
        {...props}
      >
        <span className="relative z-10 flex items-center gap-3 w-full h-full pointer-events-none">
          {children}
        </span>
        {ripples.map((ripple) => (
          <span
            key={ripple.key}
            className="absolute rounded-full bg-white/20 pointer-events-none animate-ripple"
            style={{
              width: ripple.size,
              height: ripple.size,
              left: ripple.x,
              top: ripple.y,
            }}
            onAnimationEnd={() => handleAnimationEnd(ripple.key)}
          />
        ))}
      </Comp>
    )
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"

const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
  ({ className, onClick, ...props }, ref) => {
    const { toggleSidebar } = useSidebar()
    return (
      <button
        ref={ref}
        data-sidebar="trigger"
        onClick={(e) => { onClick?.(e); toggleSidebar() }}
        className={cn("h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-surface-2/50 hover:text-foreground transition-colors", className)}
        {...props}
      />
    )
  }
)
SidebarTrigger.displayName = "SidebarTrigger"

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
}
