import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface GlowEffectProps {
  colors?: string[]
  mode?: "colorShift" | "static"
  blur?: "soft" | "medium" | "hard"
  duration?: number
  scale?: number
  className?: string
  children?: React.ReactNode
}

export function GlowEffect({
  colors = ["#FF5733", "#33FF57", "#3357FF", "#F1C40F"],
  mode = "colorShift",
  blur = "soft",
  duration = 3,
  scale = 1.0,
  className,
  children,
}: GlowEffectProps) {
  const blurClass = {
    soft: "blur-md",
    medium: "blur-xl",
    hard: "blur-2xl",
  }[blur]

  const gradientString = `linear-gradient(90deg, ${colors.join(", ")})`

  const gradientAnimation = mode === "colorShift"
    ? {
        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
      }
    : {}

  return (
    <div className={cn("relative group/glow transition-all", className)}>
      {/* 1. Behind the element: Soft ambient glow */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none rounded-full transition-all",
          blurClass
        )}
        style={{ transform: `scale(${scale})` }}
      >
        <motion.div
          className="w-full h-full rounded-full opacity-45"
          style={{
            background: gradientString,
            backgroundSize: "300% 300%",
          }}
          animate={gradientAnimation}
          transition={{
            duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>

      {/* 2. Border/Edge glow container */}
      <div 
        className="relative rounded-full p-[1px] w-full h-full overflow-hidden"
      >
        <motion.div
          className="absolute inset-[-10px]"
          style={{
            background: gradientString,
            backgroundSize: "300% 300%",
          }}
          animate={gradientAnimation}
          transition={{
            duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        {/* 3. The inner element container (solid background) */}
        <div className="relative w-full h-full rounded-full bg-surface-1 overflow-hidden flex items-center">
          {children}
        </div>
      </div>
    </div>
  )
}
