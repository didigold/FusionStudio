import { useState, useRef, useEffect, useCallback } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  items: string[]
  groups?: { label: string; items: string[] }[]
  icon?: React.ReactNode
}

export function SearchableSelect({ value, onChange, placeholder, items, groups }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const filteredItems = useCallback(() => {
    if (groups) {
      return groups.map(g => ({
        label: g.label,
        items: g.items.filter(i => i.toLowerCase().includes(search.toLowerCase()))
      })).filter(g => g.items.length > 0)
    }
    return items.filter(i => i.toLowerCase().includes(search.toLowerCase()))
  }, [items, groups, search])

  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const displayText = searchFocused ? search : value

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => { setOpen(o => !o); if (!open) setTimeout(() => searchInputRef.current?.focus(), 0) }}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-white/5 bg-surface-3/90 backdrop-blur-md px-3 py-2 text-sm cursor-pointer",
          !value && !searchFocused && "text-muted-foreground",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 opacity-50 shrink-0 ml-2 transition-transform", open && "rotate-180")} />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-white/5 bg-surface-3/95 backdrop-blur-xl shadow-md overflow-hidden">
          <div className="p-1">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Type to search..."
              className="w-full rounded-md border border-white/5 bg-surface-2/80 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {(() => {
              const result = filteredItems()
              if (result.length === 0) {
                return <div className="px-2 py-3 text-xs text-muted-foreground text-center">No results</div>
              }
              if (groups) {
                return result.flatMap((group: { label: string; items: string[] }, gi: number) => [
                  <div key={`label-${gi}`} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</div>,
                  ...group.items.map((item) => (
                    <div
                      key={`${gi}-${item}`}
                      onClick={() => { onChange(item); setOpen(false) }}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm cursor-pointer transition-colors pl-6",
                        item === value ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:bg-surface-2/50 hover:text-foreground"
                      )}
                    >
                      {item}
                    </div>
                  )),
                ])
              }
              return result.map((item: string) => (
                <div
                  key={item}
                  onClick={() => { onChange(item); setOpen(false) }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm cursor-pointer transition-colors",
                    item === value ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:bg-surface-2/50 hover:text-foreground"
                  )}
                >
                  {item}
                </div>
              ))
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
