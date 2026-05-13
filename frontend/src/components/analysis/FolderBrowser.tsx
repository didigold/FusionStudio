import { useState, useEffect, useCallback, useRef } from "react"
import { Folder, HardDrive, Home, Monitor, Download, FileText, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface DirEntry {
  name: string
  is_dir: boolean
  is_drive?: boolean
  is_shortcut?: boolean
  full_path?: string
}

interface FolderBrowserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (path: string) => void
}

const shortcutIcons: Record<string, typeof Folder> = {
  Desktop: Monitor,
  Downloads: Download,
  Documents: FileText,
}

function entryIcon(entry: DirEntry) {
  if (entry.is_drive) return HardDrive
  if (entry.is_shortcut) return shortcutIcons[entry.name] || Folder
  return Folder
}

const MAX_VISIBLE_CRUMBS = 3

export function FolderBrowser({ open, onOpenChange, onSelect }: FolderBrowserProps) {
  const [currentPath, setCurrentPath] = useState("")
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const loadPath = useCallback(async (path: string) => {
    setLoading(path !== "")
    setError("")
    try {
      const res = await fetch("/api/analysis/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      })
      const data = await res.json()
      if (open || !path) {
        setCurrentPath(data.path)
        setEntries(data.entries || [])
        if (data.error) setError(data.error)
      }
    } catch {
      setError("Failed to browse directory")
    } finally {
      setLoading(false)
    }
  }, [open])

  useEffect(() => {
    const timer = setTimeout(() => loadPath(""), 0)
    return () => clearTimeout(timer)
  }, [loadPath])

  const handleOpen = useCallback((open: boolean) => {
    onOpenChange(open)
    if (open) {
      setError("")
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [onOpenChange])

  const navigateTo = (entry: DirEntry) => {
    if (entry.full_path) {
      loadPath(entry.full_path)
    } else if (currentPath) {
      const sep = currentPath.includes("\\") ? "\\" : "/"
      const trail = currentPath.endsWith("\\") || currentPath.endsWith("/") ? "" : sep
      loadPath(currentPath + trail + entry.name)
    } else {
      loadPath(entry.name)
    }
  }

  const goTo = (path: string) => loadPath(path)

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = (e.target as HTMLInputElement).value.trim()
      if (val) goTo(val)
    }
  }

  const selectCurrent = () => {
    if (currentPath) {
      onSelect(currentPath)
      onOpenChange(false)
    }
  }

  const pathParts = currentPath ? currentPath.split(/[\\/]/).filter(Boolean) : []
  const showEllipsis = pathParts.length > MAX_VISIBLE_CRUMBS
  const visibleParts = showEllipsis ? pathParts.slice(-(MAX_VISIBLE_CRUMBS - 1)) : pathParts
  const hiddenParts = showEllipsis ? pathParts.slice(0, pathParts.length - (MAX_VISIBLE_CRUMBS - 1)) : []

  const buildPath = (index: number, parts: string[]) => {
    const sep = currentPath.includes("\\") ? "\\" : "/"
    const prefix = currentPath.startsWith("\\") ? "\\" : currentPath.startsWith("/") ? "/" : ""
    return prefix + parts.slice(0, index + 1).join(sep)
  }

  const entriesList = loading && !currentPath ? null : (
    entries.length === 0 ? (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Empty folder</div>
    ) : (
      <div className="flex flex-col p-1">
        {entries.map((entry) => {
          const Icon = entryIcon(entry)
          return (
            <button
              key={entry.name + (entry.full_path || "")}
              onClick={() => navigateTo(entry)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                entry.is_drive || entry.is_shortcut
                  ? "text-muted-foreground hover:bg-surface-2/80"
                  : "text-foreground hover:bg-surface-2/80"
              )}
            >
              <Icon className="w-4 h-4 shrink-0 text-primary/60" />
              <span className="truncate">{entry.name}</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0 text-muted-foreground/50" />
            </button>
          )
        })}
      </div>
    )
  )

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Browse folders</DialogTitle>
        </DialogHeader>

        <Input
          ref={inputRef}
          placeholder="Type a path and press Enter (e.g. C:\Users\...)"
          defaultValue={currentPath}
          onKeyDown={handleInputKeyDown}
          className="h-9 text-sm"
        />

        <div className="flex items-center px-3 py-1.5 rounded-lg bg-surface-3 border border-white/5 min-h-[2rem] overflow-x-auto">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <button
                  onClick={() => goTo("")}
                  className="flex items-center gap-1 px-1 py-0.5 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-surface-2/80 transition-colors"
                >
                  <Home className="w-3.5 h-3.5" />
                </button>
              </BreadcrumbItem>
              {showEllipsis && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded">
                          <BreadcrumbEllipsis />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuGroup>
                          {hiddenParts.map((part, i) => (
                            <DropdownMenuItem key={i} onClick={() => goTo(buildPath(i, pathParts))}>
                              {part}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </BreadcrumbItem>
                </>
              )}
              {visibleParts.map((part, i) => {
                const globalIndex = showEllipsis
                  ? pathParts.length - (MAX_VISIBLE_CRUMBS - 1) + i
                  : i
                const isLast = globalIndex === pathParts.length - 1
                return (
                  <div key={globalIndex} className="flex items-center gap-1">
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage className="text-sm font-medium truncate max-w-[120px]">{part}</BreadcrumbPage>
                      ) : (
                        <button
                          onClick={() => goTo(buildPath(globalIndex, pathParts))}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px]"
                        >
                          {part}
                        </button>
                      )}
                    </BreadcrumbItem>
                  </div>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <ScrollArea className="h-64 rounded-lg border border-white/5 bg-surface-3/30">
          {error ? (
            <div className="flex items-center justify-center h-full text-sm text-red-400">{error}</div>
          ) : loading && currentPath ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading...</div>
          ) : (
            entriesList
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-sm">
            Cancel
          </Button>
          <Button size="sm" onClick={selectCurrent} disabled={!currentPath} className="h-8 text-sm">
            Select this folder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}