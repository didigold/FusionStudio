import * as React from "react"
import { cn } from "@/lib/utils"

function Badge({ 
  className, 
  variant = "default", 
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }) {
  
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "bg-red-500/20 text-red-500 border-red-500/30",
    outline: "text-foreground border-border",
    success: "bg-green-500/20 text-green-500 border-green-500/30",
    warning: "bg-orange-500/20 text-orange-500 border-orange-500/30",
    info: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  }

  return (
    <div 
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )} 
      {...props} 
    />
  )
}

export { Badge }
