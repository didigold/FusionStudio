import { useState, useRef, useEffect, useCallback } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  items?: string[]
  groups?: { label: string; items: string[] }[]
  icon?: React.ReactNode
  allowCustom?: boolean
  showRadio?: boolean
}

export function SearchableSelect({ 
  value, 
  onChange, 
  placeholder, 
  items, 
  groups, 
  allowCustom = false,
  showRadio = false 
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const filteredItems = useCallback(() => {
    if (groups) {
      return groups.map(g => ({
        label: g.label,
        items: g.items.filter(i => i.toLowerCase().includes(search.toLowerCase()))
      })).filter(g => g.items.length > 0)
    }
    return (items || []).filter(i => i.toLowerCase().includes(search.toLowerCase()))
  }, [items, groups, search])

  const hasExactMatch = useCallback(() => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    if (groups) {
      return groups.some(g => g.items.some(i => i.toLowerCase() === query));
    }
    return (items || []).some(i => i.toLowerCase() === query);
  }, [items, groups, search]);

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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && allowCustom) {
      const trimmed = search.trim();
      if (trimmed) {
        onChange(trimmed);
        setOpen(false);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => { setOpen(o => !o); if (!open) setTimeout(() => searchInputRef.current?.focus(), 0) }}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-white/5 bg-surface-3/40 backdrop-blur-md px-3 py-2 text-sm cursor-pointer",
          !value && !searchFocused && "text-muted-foreground",
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 opacity-50 shrink-0 ml-2 transition-transform", open && "rotate-180")} />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-white/10 bg-surface-2/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-150 origin-top">
          <div className="p-1">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Type to search..."
              className="w-full rounded-md border border-white/5 bg-surface-2/80 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <div className="max-h-[450px] overflow-y-auto p-1">
            {allowCustom && search.trim() !== "" && !hasExactMatch() && (
              <div
                onClick={() => { onChange(search.trim()); setOpen(false) }}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm cursor-pointer bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium mb-1"
              >
                Use custom: "{search.trim()}"
              </div>
            )}
            {(() => {
              const result = filteredItems()
              if (result.length === 0 && (!allowCustom || !search.trim())) {
                return <div className="px-2 py-3 text-sm text-muted-foreground text-center">No results</div>
              }
              if (groups) {
                const groupResults = result as { label: string; items: string[] }[]
                return groupResults.flatMap((group, gi: number) => [
                  <div key={`label-${gi}`} className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.label}</div>,
                  ...group.items.map((item) => (
                    <div
                      key={`${gi}-${item}`}
                      onClick={() => { onChange(item); setOpen(false) }}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm cursor-pointer transition-colors pl-6",
                        item === value ? "bg-surface-2 text-foreground font-semibold" : "text-muted-foreground hover:bg-surface-2/50 hover:text-foreground"
                      )}
                    >
                      {showRadio && (
                        <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0 border border-white/20 rounded-full mr-1.5">
                          {item === value && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                        </span>
                      )}
                      {item}
                    </div>
                  )),
                ])
              }
              const itemResults = result as string[]
              return itemResults.map((item) => (
                <div
                  key={item}
                  onClick={() => { onChange(item); setOpen(false) }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm cursor-pointer transition-colors",
                    item === value ? "bg-surface-2 text-foreground font-semibold" : "text-muted-foreground hover:bg-surface-2/50 hover:text-foreground"
                  )}
                >
                  {showRadio && (
                    <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0 border border-white/20 rounded-full mr-1.5">
                      {item === value && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </span>
                  )}
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
