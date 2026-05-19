import { useState } from 'react'
import { SystemBadge } from './SystemBadge'
import {
  FolderOpen,
  Loader2,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAppStore } from '@/store/useAppStore'
import { FolderBrowser } from '@/components/analysis/FolderBrowser'

declare const __USERNAME__: string | undefined

const userName = typeof __USERNAME__ !== 'undefined' ? __USERNAME__ : 'User'

export function TopNav() {
  const {
    analysisSourcePath,
    setAnalysisSourcePath,
    setAnalysisResults,
    setAnalysisAvailableCameras,
    setAllAnalysisFiles,
    setAnalysisSelectedFile,
    addLog,
  } = useAppStore()

  const [scanning, setScanning] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)

  const triggerScanForPath = async (path: string) => {
    if (!path) return
    setScanning(true)
    try {
      const res = await fetch('/api/analysis/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_dir: path }),
      })
      const data = await res.json()
      setAnalysisResults(data.results || [])
      setAnalysisAvailableCameras(data.available_cameras || [])
      setAllAnalysisFiles(true)
      addLog(`Analysis scan found ${data.results?.length || 0} participants.`)
    } catch (err) {
      addLog(`Error scanning analysis dir: ${err}`)
    } finally {
      setScanning(false)
    }
  }

  const handleFolderSelect = (path: string) => {
    setAnalysisSourcePath(path)
    triggerScanForPath(path)
  }

  const handleClearPath = () => {
    setAnalysisSourcePath('')
    setAnalysisResults([])
    setAnalysisAvailableCameras([])
    setAnalysisSelectedFile('')
    setAllAnalysisFiles(false)
    addLog('Analysis source path cleared.')
  }

  return (
    <>
      <div className="w-full flex justify-center px-6 mt-6 absolute top-0 z-50 pointer-events-none">
        <nav className="bg-[#201E1C] shadow-[0_4px_24px_rgba(0,0,0,0.25)] rounded-full px-10 py-3 flex items-center justify-between pointer-events-auto max-w-7xl w-full border border-border/50">
          
          {/* Brand / Logo */}
          <div className="flex items-center gap-2 shrink-0 w-64">
            <span className="text-[16px] font-bold text-foreground">FusionStudio</span>
            <span className="text-[16px] font-bold text-warning">Applus+ IDIADA</span>
          </div>

          {/* Data Source Capsule */}
          <div className="flex items-center justify-center flex-1 max-w-2xl mx-4">
            <div className="group flex items-center bg-[#2A2825]/40 border border-white/5 rounded-full px-2 py-1 w-full h-10 shadow-inner">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={analysisSourcePath}
                  onChange={(e) => setAnalysisSourcePath(e.target.value)}
                  onPaste={(e) => {
                    const pastedText = e.clipboardData.getData('text')
                    if (pastedText) {
                      setAnalysisSourcePath(pastedText)
                      triggerScanForPath(pastedText)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      triggerScanForPath(analysisSourcePath)
                    }
                  }}
                  onBlur={() => {
                    triggerScanForPath(analysisSourcePath)
                  }}
                  placeholder="Select analysis directory..."
                  className="bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 text-xs text-muted-foreground placeholder:text-muted-foreground/30 w-full pl-3 pr-4 min-w-0"
                  style={{
                    maskImage: 'linear-gradient(to right, white calc(100% - 24px), transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to right, white calc(100% - 24px), transparent 100%)'
                  }}
                />
              </div>
              <div className="flex items-center shrink-0 gap-0.5 mr-1">
                {analysisSourcePath && (
                  <button
                    type="button"
                    onClick={handleClearPath}
                    className="p-1.5 hover:bg-white/5 text-muted-foreground hover:text-foreground rounded-full transition-all opacity-0 group-hover:opacity-100"
                    title="Clear Path"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="flex items-center justify-center w-8 h-8">
                  {scanning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-warning" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBrowseOpen(true)}
                      className="p-1.5 hover:bg-white/5 text-muted-foreground hover:text-foreground rounded-full transition-colors"
                      title="Browse Folder"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right side: Avatar Dropdown / Badge */}
          <div className="flex items-center gap-4 shrink-0 w-64 justify-end">
            <SystemBadge />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar>
                    <AvatarFallback>{userName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-40">
                <div className="px-2 py-2 text-sm font-medium text-foreground border-b border-border/50">
                  {userName}
                </div>
                <DropdownMenuItem className="cursor-default text-muted-foreground text-xs">
                  Accredited user
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </nav>
      </div>

      <FolderBrowser open={browseOpen} onOpenChange={setBrowseOpen} onSelect={handleFolderSelect} />
    </>
  )
}
