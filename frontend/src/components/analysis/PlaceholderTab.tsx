import { Construction } from "lucide-react"

interface PlaceholderTabProps {
  label?: string
}

export function PlaceholderTab({ label }: PlaceholderTabProps) {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Construction className="w-10 h-10 opacity-40" />
        <p className="text-sm font-medium">Coming soon</p>
        {label && <p className="text-xs opacity-60">{label}</p>}
      </div>
    </div>
  )
}
